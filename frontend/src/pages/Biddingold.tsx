import React, { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, Clock, DollarSign, Gavel } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const getUserId = async (): Promise<string | null> => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error fetching user:', error)
    return null
  }
  return user?.id ?? null
}

interface AuctionData {
  auctionId: number
  title: string
  startBid: number
  currentBid: number
  currentBidder: string | null
  live: boolean
  activeUsers: number
  startDate: string
  duration: number
  seller: string
}

interface BidEvent {
  bid: number
  bidder: string
  timestamp: string
}

interface BidError {
  message: string
  minimumRequired?: number
  currentBid?: number
  currentBidder?: string
}

const BiddingRoom: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [auctionId, setAuctionId] = useState<string>('1')
  const [isConnected, setIsConnected] = useState(false)
  const [joinedAuction, setJoinedAuction] = useState(false)
  const [auctionData, setAuctionData] = useState<AuctionData | null>(null)
  const [bidAmount, setBidAmount] = useState<string>('')
  const [bidHistory, setBidHistory] = useState<BidEvent[]>([])
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [activeUsers, setActiveUsers] = useState<number>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get user ID from Supabase on component mount
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (user && !error) {
          setUserId(user.id)
        }
      } catch (err) {
        console.error('Error getting user:', err)
      }
    }
    getUserId()
  }, [])

  // Initialize socket connection
  const connectSocket = () => {
    if (socket) {
      socket.disconnect()
    }

    const newSocket = io('http://localhost:3000', {
      path: '/api/prt/auction/ws'
    })

    newSocket.on('connect', () => {
      console.log('Connected to server')
      setIsConnected(true)
      setError('')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
      setIsConnected(false)
      setJoinedAuction(false)
    })

    newSocket.on('auth_success', (data) => {
      console.log('Joined auction:', data)
      setJoinedAuction(true)
      setActiveUsers(data.activeUsers)
      setSuccess('Successfully joined auction!')
      setTimeout(() => setSuccess(''), 3000)
    })

    newSocket.on('new_bid', (data: BidEvent) => {
      console.log('New bid:', data)
      setBidHistory(prev => [...prev, data])
      if (auctionData) {
        setAuctionData(prev => prev ? { ...prev, currentBid: data.bid, currentBidder: data.bidder } : null)
      }
    })

    newSocket.on('user_joined', (data) => {
      setActiveUsers(data.activeUsers)
    })

    newSocket.on('user_left', (data) => {
      setActiveUsers(data.activeUsers)
    })

    newSocket.on('auction_ended', (data) => {
      setError('Auction has ended')
      setJoinedAuction(false)
    })

    newSocket.on('error', (data) => {
      console.log('Socket error:', data)
      setError(data.message)
    })

    newSocket.on('bid_error', (data: BidError) => {
      console.log('Bid error:', data)
      setError(`${data.message}${data.minimumRequired ? ` - Minimum required: $${data.minimumRequired}` : ''}`)
    })

    newSocket.on('pong', () => {
      console.log('Pong received')
    })

    setSocket(newSocket)
  }

  // Fetch auction room data
  const fetchAuctionData = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/prt/auction/${auctionId}/room`)
      if (response.ok) {
        const data = await response.json()
        setAuctionData(data)
        setBidAmount(String(data.currentBid + 1))
      } else {
        setError('Failed to fetch auction data')
      }
    } catch (err) {
      setError('Failed to fetch auction data')
    }
  }

  // Join auction
  const joinAuction = () => {
    if (socket && userId && auctionId) {
      socket.emit('join-auction', {
        auctionId: parseInt(auctionId),
        userId: userId
      })
    }
  }

  // Place bid
  const placeBid = () => {
    if (socket && userId && auctionId && bidAmount) {
      const bid = parseFloat(bidAmount)
      if (isNaN(bid) || bid <= 0) {
        setError('Please enter a valid bid amount')
        return
      }
      
      socket.emit('bid', {
        auctionId: parseInt(auctionId),
        userId: userId,
        bid: bid
      })
      setError('')
    }
  }

  // Ping server
  const pingServer = () => {
    if (socket) {
      socket.emit('ping')
    }
  }

  // Auto-scroll to bottom of bid history
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bidHistory])

  // Clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              Auction Connection
            </CardTitle>
            <CardDescription>
              Connect to the auction server and join a bidding room
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Auction ID</label>
              <Input
                value={auctionId}
                onChange={(e) => setAuctionId(e.target.value)}
                placeholder="Enter auction ID"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">User ID</label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Your user ID"
                disabled
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={connectSocket} disabled={isConnected} className="flex-1">
                {isConnected ? 'Connected' : 'Connect'}
              </Button>
              <Button onClick={pingServer} disabled={!isConnected} variant="outline">
                Ping
              </Button>
            </div>

            <Button 
              onClick={fetchAuctionData} 
              disabled={!auctionId}
              variant="outline"
              className="w-full"
            >
              Fetch Auction Data
            </Button>

            <Button 
              onClick={joinAuction} 
              disabled={!isConnected || !userId || !auctionId || joinedAuction}
              className="w-full"
            >
              {joinedAuction ? 'Joined Auction' : 'Join Auction'}
            </Button>
          </CardContent>
        </Card>

        {/* Auction Info Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Auction Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auctionData ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{auctionData.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={auctionData.live ? 'default' : 'secondary'}>
                      {auctionData.live ? 'Live' : 'Closed'}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {activeUsers}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Start Bid</p>
                    <p className="font-semibold">${auctionData.startBid}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Current Bid</p>
                    <p className="font-semibold text-green-600">${auctionData.currentBid}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Current Bidder</p>
                    <p className="font-semibold">{auctionData.currentBidder || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Duration</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {auctionData.duration}m
                    </p>
                  </div>
                </div>

                {/* Bidding Section */}
                {joinedAuction && auctionData.live && (
                  <div className="space-y-2 pt-4 border-t">
                    <label className="text-sm font-medium">Your Bid</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="Enter bid amount"
                        min={auctionData.currentBid + 1}
                      />
                      <Button onClick={placeBid} disabled={!bidAmount}>
                        Bid
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No auction data loaded</p>
            )}
          </CardContent>
        </Card>

        {/* Bid History Panel */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Bid History</CardTitle>
            <CardDescription>Real-time bidding activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-y-auto border rounded-md p-3 bg-gray-50">
              {bidHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No bids yet</p>
              ) : (
                <div className="space-y-2">
                  {bidHistory.map((bid, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-white rounded border"
                    >
                      <div>
                        <span className="font-semibold">${bid.bid}</span>
                        <span className="text-gray-600 ml-2">by {bid.bidder}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(bid.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Messages */}
        {(error || success) && (
          <div className="md:col-span-2">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BiddingRoom