import { Hono } from 'hono'
import { redis } from './redis'
import { Auction } from '../models/auctions'
import { Log } from '../models/logs'
import schedule from 'node-schedule'
import { getIO } from './socket'
import type { Socket } from 'socket.io'

const auctionConnections = new Map<number, Set<string>>()
const scheduledJobs = new Map<number, schedule.Job>()

let socketHandlersInitialized = false

export function initializeAuctionSocketHandlers() {
  if (socketHandlersInitialized) {
    return
  }

  const io = getIO()
  
  io.on('connection', (socket: Socket) => {
    console.log('New client connected:', socket.id)

    // New WebSocket handler for room info (replaces the HTTP GET route)
    socket.on('get-room-info', async (data) => {
      const { auctionId } = data
      
      if (!auctionId) {
        socket.emit('room-info-error', { message: 'Missing auctionId parameter' })
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
          if (typeof currentAuction === 'string') {
            auctionData = JSON.parse(currentAuction)
          } else if (typeof currentAuction === 'object') {
            auctionData = currentAuction
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
      
      if (!auctionId || !userId) {
        socket.emit('error', { message: 'Missing parameters' })
        return
      }

      try {
        const auction = await Auction.findByPk(auctionId)
        if (!auction || !auction.live) {
          socket.emit('error', { message: 'Auction not available' })
          return
        }

        if (userId === auction.seller) {
          socket.emit('error', { message: 'Seller cannot participate' })
          return
        }

        await handleConnection(socket, auctionId, userId)
      } catch (error) {
        console.error('Join auction error:', error)
        socket.emit('error', { message: 'Connection failed' })
      }
    })

    socket.on('bid', async (data) => {
      const { auctionId, userId, bid } = data
      await handleBid(socket, auctionId, userId, bid)
    })

    socket.on('ping', () => {
      socket.emit('pong')
    })

    socket.on('disconnect', () => {
      handleDisconnection(socket)
      console.log('Client disconnected:', socket.id)
    })
  })

  socketHandlersInitialized = true
  console.log('Auction socket handlers initialized')
}

async function handleConnection(socket: Socket, auctionId: number, userId: string) {
  try {
    socket.data.auctionId = auctionId
    socket.data.userId = userId
    
    await socket.join(`auction-${auctionId}`)
    addUserToAuction(auctionId, socket.id)
    
    const currentAuction = await redis.get(`auction:${auctionId}`)
    const auction = await Auction.findByPk(auctionId)
    const auctionData = currentAuction ? JSON.parse(currentAuction) : { 
      bid: auction?.startBid || 0, 
      bidder: null 
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
    socket.disconnect()
  }
}

function handleDisconnection(socket: Socket) {
  const auctionId = socket.data?.auctionId
  const userId = socket.data?.userId
  
  if (auctionId && userId) {
    removeUserFromAuction(auctionId, socket.id)
    console.log(`User ${userId} disconnected from auction ${auctionId}`)
  }
}

async function handleBid(socket: Socket, auctionId: number, userId: string, bid: number) {
  try {
    const auction = await Auction.findByPk(auctionId)
    if (!auction || !auction.live) {
      socket.emit('error', { message: 'Auction is not live' })
      return
    }

    const currentAuction = await redis.get(`auction:${auctionId}`)
    const currentData = currentAuction ? JSON.parse(currentAuction) : { 
      bid: auction.startBid, 
      bidder: null 
    }
    
    if (typeof bid !== 'number' || bid <= currentData.bid) {
      socket.emit('bid_error', {
        message: 'Bid too low',
        minimumRequired: currentData.bid + 1,
        currentBid: currentData.bid,
        currentBidder: currentData.bidder 
      })
      return
    }

    await redis.set(`auction:${auctionId}`, JSON.stringify({ bid, bidder: userId }))
    await auction.update({ currentBid: bid, highestBidder: userId })
    await Log.create({ auctionId, type: 'bidding', bid, bidder: userId })
    
    console.log(`New bid for auction ${auctionId}: ${bid} by ${userId}`)

    const io = getIO()
    io.to(`auction-${auctionId}`).emit('new_bid', {
      bid,
      bidder: userId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Bid error:', error)
    socket.emit('error', { message: 'Failed to process bid' })
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
    if (connections.size === 0) {
      auctionConnections.delete(auctionId)
    }
    
    const io = getIO()
    io.to(`auction-${auctionId}`).emit('user_left', {
      activeUsers: connections.size
    })
  }
}

export async function startAuction(auctionId: number) {
  // Initialize socket handlers when first auction starts
  initializeAuctionSocketHandlers()
  
  const auction = await Auction.findByPk(auctionId)
  if (!auction) {
    console.error(`Auction ${auctionId} not found`)
    return
  }

  await redis.set(`auction:${auctionId}`, JSON.stringify({ 
    bid: auction.startBid, 
    bidder: null 
  }))

  await auction.update({ live: true })
  await auction.update({ status: 'live' })
  await Log.create({ 
    auctionId, 
    type: 'bidding', 
    bid: null, 
    bidder: null 
  })

  const endTime = new Date(auction.startDate.getTime() + auction.duration * 60 * 1000)
  const job = schedule.scheduleJob(endTime, async () => {
    await endAuction(auctionId)
  })
  
  scheduledJobs.set(auctionId, job)
  console.log(`Auction ${auctionId} started, will end at ${endTime}`)
}

export async function endAuction(auctionId: number) {
  console.log(`Ending auction ${auctionId}`)
  
  const auction = await Auction.findByPk(auctionId)
  if (auction) {
    await auction.update({ live: false })
    await Log.create({ 
      auctionId, 
      type: 'bidding', 
      bid: null, 
      bidder: null 
    })
  }

  const io = getIO()
  io.to(`auction-${auctionId}`).emit('auction_ended', {
    message: 'Auction has ended'
  })

  // Disconnect all users from the auction room
  const connections = auctionConnections.get(auctionId)
  if (connections) {
    const sockets = await io.in(`auction-${auctionId}`).fetchSockets()
    sockets.forEach(socket => {
      socket.leave(`auction-${auctionId}`)
      socket.disconnect()
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
}

export function scheduleAuctionStart(auctionId: number, startTime: Date, duration: number) {
  const jobName = String(auctionId)
  const job = schedule.scheduleJob(jobName, startTime, async () => {
    await startAuction(auctionId)
  })
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000)
  console.log(`Auction ${auctionId} scheduled to start at ${startTime} for duration ${endTime}`)
  return job
}