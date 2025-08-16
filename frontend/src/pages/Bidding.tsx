"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bell, LogOut, Clock, DollarSign, User, Users, Gavel, ArrowLeft } from "lucide-react"
import io, { Socket } from "socket.io-client"
import { supabase } from "@/lib/supabaseClient"

interface AuctionData {
  auctionId: number;
  title: string;
  description?: string;
  startBid: number;
  bidIncrement?: number;
  currentBid: number;
  currentBidder: string | null;
  live: boolean;
  activeUsers: number;
  startDate: string;
  duration: number;
  seller: string;
  status?: 'live' | 'pending' | 'accepted' | 'rejected' | 'scheduled';
}

interface BidEvent {
  bid: number;
  bidder: string;
  timestamp: string;
}

interface BidError {
  message: string;
  minimumRequired?: number;
  currentBid?: number;
  currentBidder?: string;
}

interface User {
  id: string;
  full_name?: string;
  email: string;
}

const SOCKET_URL = "https://auctionx.onrender.com"
const SOCKET_PATH = "/api/auction/ws"

export default function BiddingRoom() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [notificationCount] = useState(3)
  const [bidAmount, setBidAmount] = useState("")
  const [hasJoined, setHasJoined] = useState(false)
  const [isPlacingBid, setIsPlacingBid] = useState(false)
  const [auction, setAuction] = useState<AuctionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [userCache, setUserCache] = useState<Map<string, User>>(new Map())
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [bidHistory, setBidHistory] = useState<BidEvent[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const bidHistoryRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const bidTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const auctionId = new URLSearchParams(window.location.search).get("auctionId")

  // Debug logging
  useEffect(() => {
    console.log("Component state:", {
      auctionId,
      userId,
      loading,
      isConnected,
      auction: auction ? { ...auction, description: auction.description?.substring(0, 50) } : null,
      connectionError
    })
  }, [auctionId, userId, loading, isConnected, auction, connectionError])

  useEffect(() => {
    if (!auctionId) {
      setConnectionError("No auction ID provided")
      setLoading(false)
      return
    }

    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          setConnectionError("User not authenticated")
          setLoading(false)
          window.location.href = "/login"
          return
        }
        const name = user.user_metadata?.full_name || user.email || "User"
        setUserName(name)
        setUserId(user.id)
        setUserCache((prev) => new Map(prev).set(user.id, {
          id: user.id,
          full_name: user.user_metadata?.full_name,
          email: user.email || ""
        }))
      } catch (error) {
        console.error("Failed to fetch user:", error)
        setConnectionError("Failed to authenticate user")
        setLoading(false)
      }
    }

    fetchUser()
  }, [auctionId])

  // Socket connection management
  const initializeSocket = () => {
    if (!userId || !auctionId || socketRef.current?.connected) return

    console.log("Initializing socket connection...")
    
    // Clean up existing socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
    }

    const newSocket = io(SOCKET_URL, { 
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    // Connection event handlers
    newSocket.on("connect", () => {
      console.log("Connected to server, requesting room info...")
      setIsConnected(true)
      setConnectionError(null)
      
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      newSocket.emit("get-room-info", { auctionId: Number(auctionId) })
    })

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      setIsConnected(false)
      setConnectionError(`Connection failed: ${error.message}`)
      
      // Don't set loading to false immediately, allow reconnection attempts
      if (!auction) {
        setLoading(false)
      }
    })

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason)
      setIsConnected(false)
      setHasJoined(false)
      
      // Reset bid state
      setIsPlacingBid(false)
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current)
        bidTimeoutRef.current = null
      }
      
      if (reason === "io server disconnect") {
        // Server initiated disconnect, redirect to dashboard
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 2000)
      } else {
        // Client disconnect, attempt reconnection
        setAlert({ type: "error", message: "Connection lost. Attempting to reconnect..." })
        
        // Set a timeout for reconnection
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!socketRef.current?.connected) {
            setConnectionError("Unable to reconnect. Please refresh the page.")
          }
        }, 10000)
      }
    })

    newSocket.on("reconnect", (attemptNumber) => {
      console.log("Reconnected after", attemptNumber, "attempts")
      setIsConnected(true)
      setConnectionError(null)
      setAlert({ type: "success", message: "Reconnected successfully!" })
      
      // Re-request room info and rejoin if previously joined
      newSocket.emit("get-room-info", { auctionId: Number(auctionId) })
      if (hasJoined) {
        newSocket.emit("join-auction", { auctionId: Number(auctionId), userId })
      }
    })

    newSocket.on("reconnect_error", (error) => {
      console.error("Reconnection failed:", error)
      setAlert({ type: "error", message: "Reconnection failed. Please refresh the page." })
    })

    newSocket.on("reconnect_failed", () => {
      console.error("All reconnection attempts failed")
      setConnectionError("Connection lost. Please refresh the page.")
      setIsConnected(false)
    })

    // Room and auction event handlers
    newSocket.on("room-info", async (data: AuctionData) => {
      console.log("Received room info:", data)
      try {
        const seller = await fetchUserById(data.seller)
        setAuction({
          ...data,
          bidIncrement: data.bidIncrement || 1,
          description: data.description || "No description available",
          seller: seller?.full_name || seller?.email || "Unknown Seller",
          status: data.live ? 'live' : 'pending'
        })
        setLoading(false)
        
        // Set initial bid amount
        const increment = data.bidIncrement || 1
        setBidAmount(String(data.currentBid + increment))
      } catch (error) {
        console.error("Error processing room info:", error)
        setConnectionError("Failed to load auction details")
        setLoading(false)
      }
    })

    newSocket.on("room-info-error", (data: { message: string }) => {
      console.error("Room info error:", data)
      setConnectionError(data.message)
      setLoading(false)
    })

    newSocket.on("auth_success", (data: { auctionId: number; currentBid: number; currentBidder: string | null; activeUsers: number }) => {
      console.log("Authentication successful:", data)
      setHasJoined(true)
      setAlert({ type: "success", message: "Joined auction successfully" })
      setAuction((prev) => prev ? { 
        ...prev, 
        activeUsers: data.activeUsers, 
        currentBid: data.currentBid, 
        currentBidder: data.currentBidder 
      } : null)
    })

    // Bid event handlers
    newSocket.on("bid_success", (data: { bid: number; bidder: string; timestamp: string }) => {
      console.log("Bid placed successfully:", data)
      setIsPlacingBid(false)
      setAlert({ type: "success", message: "Bid placed successfully!" })
      
      // Clear bid timeout
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current)
        bidTimeoutRef.current = null
      }
      
      // This will be handled by new_bid event as well, but we handle it here for immediate feedback
      if (data.bidder === userId) {
        const increment = auction?.bidIncrement || 1
        setBidAmount(String(data.bid + increment))
      }
    })

    newSocket.on("new_bid", async (data: { bid: number; bidder: string; timestamp: string }) => {
      console.log("New bid received:", data)
      const bidderName = await fetchUserById(data.bidder)
      setBidHistory((prev) => [...prev, {
        bid: data.bid,
        bidder: bidderName?.full_name || bidderName?.email || "Unknown",
        timestamp: data.timestamp
      }])
      setAuction((prev) => prev ? { 
        ...prev, 
        currentBid: data.bid, 
        currentBidder: data.bidder 
      } : null)
      
      // Update suggested bid amount
      const increment = auction?.bidIncrement || 1
      setBidAmount(String(data.bid + increment))
    })

    newSocket.on("user_joined", (data: { activeUsers: number }) => {
      setAuction((prev) => prev ? { ...prev, activeUsers: data.activeUsers } : null)
    })

    newSocket.on("user_left", (data: { activeUsers: number }) => {
      setAuction((prev) => prev ? { ...prev, activeUsers: data.activeUsers } : null)
    })

    newSocket.on("auction_ended", (data: { message: string }) => {
      setAlert({ type: "error", message: data.message })
      setHasJoined(false)
      setIsPlacingBid(false)
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 3000)
    })

    newSocket.on("bid_error", (data: BidError) => {
      console.log("Bid error:", data)
      setAlert({ type: "error", message: data.message })
      setIsPlacingBid(false)
      
      // Clear bid timeout
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current)
        bidTimeoutRef.current = null
      }
    })

    newSocket.on("error", (data: { message: string }) => {
      console.error("Socket error:", data)
      setAlert({ type: "error", message: data.message })
      setIsPlacingBid(false)
    })
  }

  useEffect(() => {
    if (userId && auctionId) {
      initializeSocket()
    }

    return () => {
      // Cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current)
      }
      if (socketRef.current) {
        console.log("Cleaning up socket connection")
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [userId, auctionId])

  useEffect(() => {
    if (bidHistoryRef.current) {
      bidHistoryRef.current.scrollTop = bidHistoryRef.current.scrollHeight
    }
  }, [bidHistory])

  useEffect(() => {
    if (!auction) return

    const interval = setInterval(() => {
      const start = new Date(auction.startDate)
      const end = new Date(start.getTime() + auction.duration * 60 * 1000)
      const now = new Date()
      const diff = end.getTime() - now.getTime()

      if (diff <= 0) {
        clearInterval(interval)
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining({ days, hours, minutes, seconds })
    }, 1000)

    return () => clearInterval(interval)
  }, [auction])

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), alert.type === "success" ? 3000 : 5000)
      return () => clearTimeout(timer)
    }
  }, [alert])

  const fetchUserById = async (userId: string): Promise<User | null> => {
    if (!userId) return null

    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!isValidUUID.test(userId)) {
      console.error("Invalid UUID:", userId)
      return null
    }

    if (userCache.has(userId)) {
      return userCache.get(userId) || null
    }

    try {
      const { data, error } = await supabase.auth.admin.getUserById(userId)
      if (error || !data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", userId)
          .single()

        if (profile) {
          const user: User = {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email
          }
          setUserCache((prev) => new Map(prev).set(userId, user))
          return user
        }
        return null
      }

      const user: User = {
        id: data.user.id,
        full_name: data.user.user_metadata?.full_name || "",
        email: data.user.email || ""
      }
      setUserCache((prev) => new Map(prev).set(userId, user))
      return user
    } catch (error) {
      console.error("Failed to fetch user:", error)
      return null
    }
  }

  const formatTimeRemaining = () => {
    const { days, hours, minutes, seconds } = timeRemaining
    if (days + hours + minutes + seconds === 0) return "Ended"
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
    return `${minutes}m ${seconds}s`
  }

  const handleJoinAuction = () => {
    if (!socket || !auctionId || !userId || !auction?.live || auction?.seller === userId) return

    if (!socket.connected) {
      console.log("Socket not connected, attempting to reconnect...")
      setAlert({ type: "error", message: "Connection lost. Attempting to reconnect..." })
      initializeSocket()
      return
    }

    console.log("Joining auction:", { auctionId: Number(auctionId), userId })
    socket.emit("join-auction", { auctionId: Number(auctionId), userId })
  }

  const handlePlaceBid = () => {
    if (!socket || !auctionId || !userId || !auction || !bidAmount || isPlacingBid) return

    const bid = Number(bidAmount)
    const increment = auction.bidIncrement || 1
    const minBid = auction.currentBid + increment
    
    if (bid <= 0 || bid < minBid) {
      setAlert({ type: "error", message: `Bid must be at least $${minBid.toLocaleString()}` })
      return
    }

    if (!socket.connected) {
      setAlert({ type: "error", message: "Connection lost. Please wait for reconnection or refresh the page." })
      return
    }

    setIsPlacingBid(true)
    console.log("Placing bid:", { auctionId: Number(auctionId), userId, bid })
    socket.emit("bid", { auctionId: Number(auctionId), userId, bid })
    
    // Set a timeout to reset placing bid state if no response
    bidTimeoutRef.current = setTimeout(() => {
      console.warn("Bid timeout - no response received")
      setIsPlacingBid(false)
      setAlert({ type: "error", message: "Bid timeout. Please try again." })
    }, 10000) // 10 second timeout
  }

  // Connection status indicator
  const getConnectionStatus = () => {
    if (!isConnected && !loading) {
      return (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <div className="w-2 h-2 bg-red-600 rounded-full" />
          Disconnected
        </div>
      )
    }
    if (isConnected) {
      return (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
          Connected
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <div className="text-muted-foreground">Loading auction...</div>
        {connectionError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md max-w-md text-center">
            <p className="text-red-800 text-sm">{connectionError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (connectionError || !auction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-red-600">Unable to Load Auction</h2>
          <p className="text-muted-foreground">{connectionError || "Auction not found"}</p>
          <div className="space-x-2">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const increment = auction.bidIncrement || 1
  const minBid = auction.currentBid + increment
  const isEnded = timeRemaining.days + timeRemaining.hours + timeRemaining.minutes + timeRemaining.seconds === 0
  const canJoin = auction.live && !hasJoined && userId !== auction.seller && !isEnded && isConnected
  const canBid = hasJoined && auction.live && !isEnded && isConnected

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => window.location.href = "/dashboard"}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">AuctionX</h1>
            <span className="text-muted-foreground">Hello, {userName}</span>
            {getConnectionStatus()}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">{notificationCount}</Badge>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              try {
                await supabase.auth.signOut()
                window.location.href = "/login"
              } catch (error) {
                setAlert({ type: "error", message: "Failed to logout" })
              }
            }}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {alert && (
        <div className="container mx-auto px-4 pt-4">
          <Alert className={alert.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
            <AlertDescription className={alert.type === "error" ? "text-red-800" : "text-green-800"}>
              {alert.message}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {!hasJoined ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">{auction.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{auction.seller}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{auction.activeUsers} watching</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                    LIVE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed mb-6">{auction.description}</p>

                <div className="text-center space-y-4">
                  <div className="text-3xl font-bold text-green-600">
                    ${auction.currentBid.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Current highest bid</p>

                  <div className="flex items-center justify-center gap-2 p-3 bg-orange-50 rounded-lg">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-800 font-mono text-lg">{formatTimeRemaining()}</span>
                  </div>

                  <Button onClick={handleJoinAuction} className="w-full h-12 text-lg" size="lg" disabled={!canJoin}>
                    <Users className="h-5 w-5 mr-2" />
                    {canJoin ? "Join Auction" : 
                     !isConnected ? "Connecting..." :
                     isEnded ? "Auction Ended" : 
                     userId === auction.seller ? "You're the Seller" : "Cannot Join"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-1/2 order-2 lg:order-1">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-xl">{auction.title}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{auction.seller}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{auction.activeUsers} watching</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-green-600">
                        <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                        LIVE
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{auction.description}</p>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Starting bid</p>
                        <p className="font-semibold">${auction.startBid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bid increment</p>
                        <p className="font-semibold">${increment}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="w-full lg:w-1/2 order-1 lg:order-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gavel className="h-5 w-5" />
                      Place Your Bid
                    </CardTitle>
                    <CardDescription>
                      Current bid: ${auction.currentBid.toLocaleString()} • Minimum bid: $
                      {minBid.toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-600 mb-2">
                        ${auction.currentBid.toLocaleString()}
                      </div>
                      <div className="flex items-center justify-center gap-2 p-4 bg-orange-50 rounded-lg">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <span className="font-bold text-orange-800 font-mono text-xl">{formatTimeRemaining()}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="bidAmount">Your bid amount</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="bidAmount"
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            min={minBid}
                            step={increment}
                            className="pl-10 h-12 text-lg"
                            placeholder={minBid.toString()}
                            disabled={isPlacingBid || !isConnected}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setBidAmount(String(minBid))} 
                          className="h-10"
                          disabled={isPlacingBid || !isConnected}
                        >
                          Min Bid
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setBidAmount(String(minBid + increment * 2))}
                          className="h-10"
                          disabled={isPlacingBid || !isConnected}
                        >
                          +${increment * 2}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setBidAmount(String(minBid + increment * 5))}
                          className="h-10"
                          disabled={isPlacingBid || !isConnected}
                        >
                          +${increment * 5}
                        </Button>
                      </div>

                      <Button
                        onClick={handlePlaceBid}
                        disabled={!canBid || !bidAmount || Number(bidAmount) < minBid || isPlacingBid}
                        className="w-full h-12 text-lg"
                        size="lg"
                      >
                        {isPlacingBid ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Placing Bid...
                          </>
                        ) : !isConnected ? (
                          "Connecting..."
                        ) : (
                          <>
                            <Gavel className="h-5 w-5 mr-2" />
                            Place Bid - ${bidAmount ? Number(bidAmount).toLocaleString() : minBid.toLocaleString()}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Bid History */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Bid History</CardTitle>
              </CardHeader>
              <CardContent>
                <div ref={bidHistoryRef} className="h-40 overflow-y-auto space-y-2">
                  {bidHistory.map((bid, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{bid.bidder}</span> bid ${bid.bid.toLocaleString()} at {new Date(bid.timestamp).toLocaleTimeString()}
                    </div>
                  ))}
                  {bidHistory.length === 0 && <div className="text-muted-foreground">No bids yet since you joined</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}