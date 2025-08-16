import { Hono } from 'hono'
import { redis } from './redis'
import { Auction } from '../models/auctions'
import { Log } from '../models/logs'
import schedule from 'node-schedule'
import { getIO } from './socket'
import type { Socket } from 'socket.io'

const auctionConnections = new Map<number, Set<string>>()
const scheduledJobs = new Map<number, schedule.Job>()
const userToAuction = new Map<string, number>() // Track which auction each socket is in

let socketHandlersInitialized = false

export function initializeAuctionSocketHandlers() {
  if (socketHandlersInitialized) {
    console.log('Socket handlers already initialized, skipping...')
    return
  }

  const io = getIO()
  
  io.on('connection', (socket: Socket) => {
    console.log('New client connected:', socket.id)

    socket.on('get-room-info', async (data) => {
      console.log("room-info requested!")
      const { auctionId } = data
      
      if (!auctionId || isNaN(parseInt(auctionId))) {
        socket.emit('room-info-error', { message: 'Invalid auctionId parameter' })
        return
      }

      try {
        const auction = await Auction.findByPk(parseInt(auctionId))
        if (!auction) {
          socket.emit('room-info-error', { message: 'Auction not found' })
          return
        }

        const currentAuction = await redis.get(`auction:${auctionId}`)
        let auctionData = { bid: auction.startBid, bidder: null }

        if (currentAuction) {
          try {
            auctionData = typeof currentAuction === 'string' 
              ? JSON.parse(currentAuction) 
              : currentAuction
          } catch (parseError) {
            console.error('Redis data parse error:', parseError)
            // Use default auction data if parsing fails
          }
        }

        const activeConnections = auctionConnections.get(parseInt(auctionId))?.size || 0
        
        socket.emit('room-info', {
          auctionId: parseInt(auctionId),
          title: auction.title,
          startBid: auction.startBid,
          currentBid: auctionData.bid,
          currentBidder: auctionData.bidder,
          live: auction.live,
          activeUsers: activeConnections,
          startDate: auction.startDate,
          duration: auction.duration,
          seller: auction.seller
        })
      } catch (error) {
        console.error(`Error getting room info for auction ${auctionId}:`, error)
        socket.emit('room-info-error', { message: 'Failed to get room info' })
      }
    })

    socket.on('join-auction', async (data) => {
      const { auctionId, userId } = data
      
      if (!auctionId || !userId || isNaN(parseInt(auctionId))) {
        socket.emit('error', { message: 'Missing or invalid parameters' })
        return
      }

      try {
        // Check if user is already in another auction
        const existingAuction = userToAuction.get(socket.id)
        if (existingAuction && existingAuction !== parseInt(auctionId)) {
          await handleDisconnection(socket)
        }

        const auction = await Auction.findByPk(parseInt(auctionId))
        if (!auction) {
          socket.emit('error', { message: 'Auction not found' })
          return
        }
        
        if (!auction.live) {
          socket.emit('error', { message: 'Auction not available' })
          return
        }

        if (userId === auction.seller) {
          socket.emit('error', { message: 'Seller cannot participate in bidding' })
          return
        }

        await handleConnection(socket, parseInt(auctionId), userId)
      } catch (error) {
        console.error('Join auction error:', error)
        socket.emit('error', { message: 'Connection failed' })
      }
    })

    socket.on('bid', async (data) => {
      const { auctionId, userId, bid } = data
      
      // Validate input
      if (!auctionId || !userId || typeof bid !== 'number' || bid <= 0) {
        socket.emit('bid_error', { message: 'Invalid bid parameters' })
        return
      }
      
      await handleBid(socket, parseInt(auctionId), userId, bid)
    })

    socket.on('ping', () => {
      socket.emit('pong')
    })

    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', socket.id, 'Reason:', reason)
      handleDisconnection(socket)
    })
  })

  socketHandlersInitialized = true
  console.log('Auction socket handlers initialized')
}

async function handleConnection(socket: Socket, auctionId: number, userId: string) {
  try {
    // Clean up any previous connection data
    await handleDisconnection(socket)
    
    socket.data.auctionId = auctionId
    socket.data.userId = userId
    
    await socket.join(`auction-${auctionId}`)
    addUserToAuction(auctionId, socket.id)
    userToAuction.set(socket.id, auctionId)
    
    // Get current auction state with better error handling
    const currentAuction = await redis.get(`auction:${auctionId}`)
    const auction = await Auction.findByPk(auctionId)
    
    let auctionData = { bid: auction?.startBid || 0, bidder: null }
    
    if (currentAuction) {
      try {
        auctionData = typeof currentAuction === 'string' 
          ? JSON.parse(currentAuction) 
          : currentAuction
      } catch (parseError) {
        console.error('Redis parse error in handleConnection:', parseError)
      }
    }

    socket.emit('auth_success', {
      auctionId: auctionId,
      currentBid: auctionData.bid,
      currentBidder: auctionData.bidder,
      activeUsers: auctionConnections.get(auctionId)?.size || 0
    })

    socket.to(`auction-${auctionId}`).emit('user_joined', {
      activeUsers: auctionConnections.get(auctionId)?.size || 0
    })

    console.log(`User ${userId} connected to auction ${auctionId}`)
  } catch (error) {
    console.error('Connection setup error:', error)
    socket.emit('error', { message: 'Failed to join auction' })
    socket.disconnect()
  }
}

function handleDisconnection(socket: Socket) {
  const auctionId = socket.data?.auctionId
  const userId = socket.data?.userId
  
  if (auctionId && userId) {
    removeUserFromAuction(auctionId, socket.id)
    userToAuction.delete(socket.id)
    
    // Clean up socket data
    delete socket.data.auctionId
    delete socket.data.userId
    
    console.log(`User ${userId} disconnected from auction ${auctionId}`)
  }
}

async function handleBid(socket: Socket, auctionId: number, userId: string, bid: number) {
  try {
    // Verify the user is connected to this auction
    if (socket.data?.auctionId !== auctionId) {
      socket.emit('bid_error', { message: 'Not connected to this auction' })
      return
    }

    const auction = await Auction.findByPk(auctionId)
    if (!auction || !auction.live) {
      socket.emit('bid_error', { message: 'Auction is not live' })
      return
    }

    // Use Redis transaction to prevent race conditions
    const multi = redis.multi()
    const currentAuction = await redis.get(`auction:${auctionId}`)
    
    let currentData = { bid: auction.startBid, bidder: null }
    
    if (currentAuction) {
      try {
        currentData = typeof currentAuction === 'string' 
          ? JSON.parse(currentAuction) 
          : currentAuction
      } catch (parseError) {
        console.error('Redis parse error in handleBid:', parseError)
      }
    }
    
    // Validate bid amount
    if (bid <= currentData.bid) {
      socket.emit('bid_error', {
        message: 'Bid too low',
        minimumRequired: currentData.bid + 1,
        currentBid: currentData.bid,
        currentBidder: currentData.bidder 
      })
      return
    }

    // Prevent self-outbidding
    if (currentData.bidder === userId) {
      socket.emit('bid_error', {
        message: 'You already have the highest bid',
        currentBid: currentData.bid,
        currentBidder: currentData.bidder
      })
      return
    }

    // Update Redis and database
    const newBidData = { bid, bidder: userId }
    await redis.set(`auction:${auctionId}`, JSON.stringify(newBidData))
    await auction.update({ currentBid: bid, highestBidder: userId })
    await Log.create({ auctionId, type: 'bidding', bid, bidder: userId })
    
    console.log(`New bid for auction ${auctionId}: ${bid} by ${userId}`)

    const io = getIO()
    io.to(`auction-${auctionId}`).emit('new_bid', {
      bid,
      bidder: userId,
      timestamp: new Date().toISOString(),
      auctionId
    })

  } catch (error) {
    console.error('Bid error:', error)
    socket.emit('bid_error', { message: 'Failed to process bid' })
  }
}

function addUserToAuction(auctionId: number, socketId: string) {
  if (!auctionConnections.has(auctionId)) {
    auctionConnections.set(auctionId, new Set())
  }
  auctionConnections.get(auctionId)!.add(socketId)
}

function removeUserFromAuction(auctionId: number, socketId: string) {
  const connections = auctionConnections.get(auctionId)
  if (connections) {
    connections.delete(socketId)
    
    // Emit user count update
    const io = getIO()
    io.to(`auction-${auctionId}`).emit('user_left', {
      activeUsers: connections.size
    })
    
    // Clean up empty auction rooms
    if (connections.size === 0) {
      auctionConnections.delete(auctionId)
      console.log(`Auction room ${auctionId} is now empty`)
    }
  }
}

export async function startAuction(auctionId: number) {
  // Initialize socket handlers when first auction starts
  
  const auction = await Auction.findByPk(auctionId)
  if (!auction) {
    console.error(`Auction ${auctionId} not found`)
    return
  }

  await redis.set(`auction:${auctionId}`, JSON.stringify({ 
    bid: auction.startBid, 
    bidder: null 
  }))

  await auction.update({ live: true, status: 'live' })
  await Log.create({ 
    auctionId, 
    type: 'start', // Changed from 'bidding' to be more specific
    bid: null, 
    bidder: null 
  })

  const endTime = new Date(auction.startDate.getTime() + auction.duration * 60 * 1000)
  const job = schedule.scheduleJob(endTime, async () => {
    await endAuction(auctionId)
  })
  
  scheduledJobs.set(auctionId, job)
  console.log(`Auction ${auctionId} started, will end at ${endTime}`)
  
  // Notify all connected clients that auction has started
  const io = getIO()
  io.to(`auction-${auctionId}`).emit('auction_started', {
    auctionId,
    startTime: new Date().toISOString(),
    duration: auction.duration
  })
}

export async function endAuction(auctionId: number) {
  console.log(`Ending auction ${auctionId}`)
  
  const auction = await Auction.findByPk(auctionId)
  if (auction) {
    await auction.update({ live: false, status: 'ended' })
    await Log.create({ 
      auctionId, 
      type: 'end', // Changed from 'bidding' to be more specific
      bid: null, 
      bidder: null 
    })
  }

  const io = getIO()
  
  // Get final bid information
  const finalAuction = await redis.get(`auction:${auctionId}`)
  let finalData = null
  if (finalAuction) {
    try {
      finalData = typeof finalAuction === 'string' 
        ? JSON.parse(finalAuction) 
        : finalAuction
    } catch (parseError) {
      console.error('Redis parse error in endAuction:', parseError)
    }
  }
  
  io.to(`auction-${auctionId}`).emit('auction_ended', {
    auctionId,
    message: 'Auction has ended',
    finalBid: finalData?.bid,
    winner: finalData?.bidder,
    endTime: new Date().toISOString()
  })

  // Give clients time to process the end event before disconnecting
  setTimeout(async () => {
    // Disconnect all users from the auction room
    const connections = auctionConnections.get(auctionId)
    if (connections) {
      const sockets = await io.in(`auction-${auctionId}`).fetchSockets()
      sockets.forEach(socket => {
        socket.leave(`auction-${auctionId}`)
        // Don't disconnect the socket entirely, just remove from room
        if (socket.data?.auctionId === auctionId) {
          delete socket.data.auctionId
          delete socket.data.userId
          userToAuction.delete(socket.id)
        }
      })
      auctionConnections.delete(auctionId)
    }

    await redis.del(`auction:${auctionId}`)
    const job = scheduledJobs.get(auctionId)
    if (job) {
      job.cancel()
      scheduledJobs.delete(auctionId)
    }

    console.log(`Auction ${auctionId} ended and cleaned up`)
  }, 2000) // 2 second delay
}

export function scheduleAuctionStart(auctionId: number, startTime: Date, duration: number) {
  const job = schedule.scheduleJob(`auction-${auctionId}`, startTime, async () => {
    await startAuction(auctionId)
  })
  
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000)
  console.log(`Auction ${auctionId} scheduled to start at ${startTime}, end at ${endTime}`)
  return job
}

// Utility function to get auction statistics
export function getAuctionStats() {
  return {
    activeAuctions: auctionConnections.size,
    totalConnections: Array.from(auctionConnections.values()).reduce((sum, set) => sum + set.size, 0),
    scheduledJobs: scheduledJobs.size
  }
}