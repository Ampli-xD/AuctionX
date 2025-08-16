"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Home, Plus, List, LogOut, Clock, DollarSign, User, Check, X, Loader2 } from "lucide-react"

import { supabase } from "@/lib/supabaseClient"

type ActiveView = "home" | "create" | "my-auctions"

interface Auction {
  id: number
  item: string
  description: string
  currentBid: number | null
  startBid: number
  bidIncrement: number
  duration: number
  startDate: string
  seller_id: string
  sellerName?: string
  status: "pending" | "accepted" | "live" | "rejected" | "ended" | "scheduled"
}

interface User {
  id: string
  full_name?: string
  email: string
}

const API_BASE_URL = "https://auctionx.onrender.com"

export default function AuctionXDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("home")
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(false)
  const [auctionsLoading, setAuctionsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [userName, setUserName] = useState("")
  const [alert, setAlert] = useState<{ type: "success" | "error", message: string } | null>(null)
  const [userCache, setUserCache] = useState<Map<string, User>>(new Map())
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    type: "accept" | "reject" | null
    auctionId: number | null
    auctionTitle: string
  }>({ isOpen: false, type: null, auctionId: null, auctionTitle: "" })
  const [newAuction, setNewAuction] = useState({
    item: "",
    description: "",
    dateTime: "",
    duration: "",
    startBid: "",
    bidIncrement: ""
  })

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          window.location.href = "/login"
          return
        }
        if (!user) {
          window.location.href = "/login"
          return
        }
        const name = user.user_metadata?.full_name || user.email || "User"
        setUserName(name)
        setCurrentUserId(user.id)
        setUserCache(prev => new Map(prev).set(user.id, {
          id: user.id,
          full_name: user.user_metadata?.full_name,
          email: user.email || ""
        }))
      } catch (error) {
        console.error("Failed to fetch user:", error)
        window.location.href = "/login"
      }
    }
    fetchUser()
  }, [])

  const getToken = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        window.location.href = "/login"
        return ""
      }
      return session.access_token
    } catch (error) {
      window.location.href = "/login"
      return ""
    }
  }

  const fetchUserById = async (userId: string): Promise<User | null> => {
    if (!userId) return null;

    // Validate UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!isValidUUID.test(userId)) {
      console.error("Invalid UUID:", userId);
      return null;
    }

    // Check cache first
    if (userCache.has(userId)) {
      return userCache.get(userId) || null;
    }

    try {
      const token = await getToken();
      if (!token) return null;

      // Try GET request first (most common pattern)
      let response = await fetch(`${API_BASE_URL}/api/user/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // If GET doesn't work, try POST with userId in body
      if (!response.ok && response.status === 404) {
        response = await fetch(`${API_BASE_URL}/api/user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: userId }),
        });
      }

      // If POST with userId doesn't work, try the original format
      if (!response.ok) {
        response = await fetch(`${API_BASE_URL}/api/user/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: userId }),
        });
      }

      if (!response.ok) {
        console.error(`Failed to fetch user: ${response.status} ${response.statusText}`);
        return null;
      }

      const userData = await response.json();

      // Handle both single user object and array responses
      let user: User;
      
      if (Array.isArray(userData)) {
        // If API returns array, find the user with matching ID
        const foundUser = userData.find(u => u.id === userId);
        if (!foundUser) {
          console.error("No user found with ID:", userId);
          return null;
        }
        user = {
          id: foundUser.id,
          full_name: foundUser.full_name || foundUser.username || foundUser.name || foundUser.email || "Unknown",
          email: foundUser.email || "",
        };
      } else {
        // If API returns single user object
        user = {
          id: userData.id,
          full_name: userData.full_name || userData.username || userData.name || userData.email || "Unknown",
          email: userData.email || "",
        };
      }

      // Update cache
      setUserCache(prev => new Map(prev).set(userId, user));
      return user;
      
    } catch (error) {
      console.error("Failed to fetch user:", error);
      return null;
    }
  };

  const fetchAuctions = async () => {
    try {
      setAuctionsLoading(true)
      const token = await getToken()
      if (!token) return

      const response = await fetch(`${API_BASE_URL}/api/auction`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!response.ok) throw new Error('Failed to fetch auctions')
      
      const data: Auction[] = await response.json()
      
      // Fetch seller names for all auctions
      const auctionsWithNames = await Promise.all(
        data.map(async (auction) => {
          try {
            const seller = await fetchUserById(auction.seller_id)
            return {
              ...auction,
              sellerName: seller?.full_name || "Unknown Seller"
            }
          } catch (error) {
            console.error(`Failed to fetch seller for auction ${auction.id}:`, error)
            return {
              ...auction,
              sellerName: "Unknown Seller"
            }
          }
        })
      )
      
      setAuctions(auctionsWithNames)
    } catch (error) {
      console.error("Failed to fetch auctions:", error)
      setAlert({ type: "error", message: "Failed to load auctions" })
    } finally {
      setAuctionsLoading(false)
    }
  }

  useEffect(() => {
    if (currentUserId) {
      fetchAuctions()
    }
  }, [currentUserId])

  useEffect(() => {
    const interval = setInterval(() => {
      setAuctions(prev => [...prev])
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [alert])

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout error:", error)
      setAlert({ type: "error", message: "Failed to logout" })
    }
  }

  const computeTimeRemaining = (auction: Auction): string => {
    const start = new Date(auction.startDate)
    const end = new Date(start.getTime() + (auction.duration * 60 * 1000))
    const now = new Date()
    
    if (now > end) return "Ended"
    if (now < start) return "Starting soon"
    
    const diff = end.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const mins = Math.floor((diff / (1000 * 60)) % 60)
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const token = await getToken()
      if (!token) return

      const payload = {
        item: newAuction.item,
        description: newAuction.description,
        startBid: Number(newAuction.startBid),
        bidIncrement: Number(newAuction.bidIncrement),
        startDate: newAuction.dateTime,
        duration: parseInt(newAuction.duration.split(' ')[0]) * 60,
        live: false,
        currentBid: 0,
        seller: currentUserId,
        highestBidder: null,
      }
      
      const response = await fetch(`${API_BASE_URL}/api/auction`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) throw new Error('Failed to create auction')
      
      setNewAuction({
        item: "",
        description: "",
        dateTime: "",
        duration: "",
        startBid: "",
        bidIncrement: ""
      })
      
      setAlert({ type: "success", message: "Auction created successfully!" })
      setActiveView("my-auctions")
      await fetchAuctions()
    } catch (error) {
      console.error("Failed to create auction:", error)
      setAlert({ type: "error", message: "Failed to create auction" })
    } finally {
      setLoading(false)
    }
  }

  const confirmAction = async () => {
    if (!confirmDialog.auctionId || !confirmDialog.type) return
    
    try {
      const token = await getToken()
      if (!token) return

      const response = await fetch(
        `${API_BASE_URL}/api/auction/${confirmDialog.auctionId}/${confirmDialog.type}`, 
        { 
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` } 
        }
      )
      
      if (!response.ok) throw new Error(`Failed to ${confirmDialog.type} auction`)
      
      setAlert({ 
        type: "success", 
        message: `Auction ${confirmDialog.type === 'accept' ? 'accepted' : 'rejected'} successfully!` 
      })
      
      setConfirmDialog({ isOpen: false, type: null, auctionId: null, auctionTitle: "" })
      await fetchAuctions()
    } catch (error) {
      console.error(`Failed to ${confirmDialog.type} auction:`, error)
      setAlert({ type: "error", message: `Failed to ${confirmDialog.type} auction` })
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "live": return "default"
      case "pending": return "secondary"
      case "accepted": return "outline"
      case "scheduled": return "outline"
      case "ended": return "destructive"
      case "rejected": return "destructive"
      default: return "secondary"
    }
  }

  const renderAuctionCard = (auction: Auction, showActions?: "pending" | "none") => (
    <Card key={auction.id} className="hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{auction.item}</CardTitle>
            <CardDescription className="mt-1">{auction.description}</CardDescription>
          </div>
          <Badge variant={getStatusBadgeVariant(auction.status)} className="ml-2">
            {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Seller: {auction.sellerName || "Loading..."}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-lg">
              {auction.currentBid ? `$${auction.currentBid}` : "No bids yet"}
            </span>
          </div>
          <Badge variant="secondary">Current Bid</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Starting:</span>
            <span className="font-medium">${auction.startBid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Increment:</span>
            <span className="font-medium">${auction.bidIncrement}</span>
          </div>
        </div>
        {auction.status === "live" && (
          <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-md">
            <Clock className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">
              {computeTimeRemaining(auction)}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {showActions === "pending" ? (
          <>
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1" 
              onClick={() => setConfirmDialog({ 
                isOpen: true, 
                type: "accept", 
                auctionId: auction.id, 
                auctionTitle: auction.item 
              })}
            >
              <Check className="h-4 w-4 mr-1" /> Accept
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="flex-1" 
              onClick={() => setConfirmDialog({ 
                isOpen: true, 
                type: "reject", 
                auctionId: auction.id, 
                auctionTitle: auction.item 
              })}
            >
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
          </>
        ) : (
          <Button 
            className="w-full" 
            disabled={auction.status !== "live"}
            onClick={() => {
              if (auction.status === "live") {
                window.location.href = `/bid?auctionId=${auction.id}`
              }
            }}
          >
            {auction.status === "live" ? "Place Bid" : 
             auction.status === "ended" ? "Auction Ended" : "Not Started"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )

  const liveAuctions = auctions.filter(a => a.status === "live" || a.status === "scheduled")
  const myAuctions = auctions.filter(a => a.seller_id === currentUserId)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary">AuctionX</h1>
            <span className="text-muted-foreground">Hello, {userName}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
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

      <main className="container mx-auto px-4 py-8 pb-24">
        {activeView === "home" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Active Auctions</h2>
              {auctionsLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            
            {auctionsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : liveAuctions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground text-lg mb-2">No active auctions found</div>
                <div className="text-sm text-muted-foreground">Check back later for new auctions!</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {liveAuctions.map(auction => renderAuctionCard(auction))}
              </div>
            )}
          </div>
        )}

        {activeView === "create" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Create New Auction</h2>
            <Card>
              <CardHeader>
                <CardTitle>Auction Details</CardTitle>
                <CardDescription>Fill in the details for your auction</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateAuction} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="item">Item Title *</Label>
                    <Input 
                      id="item" 
                      value={newAuction.item} 
                      onChange={e => setNewAuction({ ...newAuction, item: e.target.value })} 
                      placeholder="Enter item title"
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea 
                      id="description" 
                      value={newAuction.description} 
                      onChange={e => setNewAuction({ ...newAuction, description: e.target.value })} 
                      placeholder="Describe your item in detail"
                      rows={4}
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dateTime">Start Date & Time *</Label>
                      <Input 
                        id="dateTime" 
                        type="datetime-local" 
                        value={newAuction.dateTime} 
                        onChange={e => setNewAuction({ ...newAuction, dateTime: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration *</Label>
                      <Select value={newAuction.duration} onValueChange={value => setNewAuction({ ...newAuction, duration: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1 hour">1 Hour</SelectItem>
                          <SelectItem value="3 hours">3 Hours</SelectItem>
                          <SelectItem value="5 hours">5 Hours</SelectItem>
                          <SelectItem value="7 hours">7 Hours</SelectItem>
                          <SelectItem value="14 hours">14 Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startBid">Starting Bid ($) *</Label>
                      <Input 
                        id="startBid" 
                        type="number" 
                        min="1"
                        step="0.01"
                        value={newAuction.startBid} 
                        onChange={e => setNewAuction({ ...newAuction, startBid: e.target.value })} 
                        placeholder="0.00"
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bidIncrement">Bid Increment ($) *</Label>
                      <Input 
                        id="bidIncrement" 
                        type="number" 
                        min="0.01"
                        step="0.01"
                        value={newAuction.bidIncrement} 
                        onChange={e => setNewAuction({ ...newAuction, bidIncrement: e.target.value })} 
                        placeholder="0.00"
                        required 
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Auction...
                      </>
                    ) : (
                      "Create Auction"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === "my-auctions" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">My Auctions</h2>
              {auctionsLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all">All ({myAuctions.length})</TabsTrigger>
                <TabsTrigger value="scheduled">Upcoming ({myAuctions.filter(a => a.status === "scheduled").length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({myAuctions.filter(a => a.status === "pending").length})</TabsTrigger>
                <TabsTrigger value="accepted">Accepted ({myAuctions.filter(a => a.status === "accepted").length})</TabsTrigger>
                <TabsTrigger value="live">Live ({myAuctions.filter(a => a.status === "live").length})</TabsTrigger>
                <TabsTrigger value="ended">Ended ({myAuctions.filter(a => a.status === "ended").length})</TabsTrigger>
              </TabsList>

              {["all","scheduled","pending","accepted","live","ended"].map(status => (
                <TabsContent key={status} value={status} className="space-y-4">
                  {auctionsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                          <CardHeader>
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myAuctions
                        .filter(a => status === "all" ? true : a.status === status)
                        .map(auction => renderAuctionCard(
                          auction, 
                          auction.status === "pending" ? "pending" : "none"
                        ))}
                      {myAuctions.filter(a => status === "all" ? true : a.status === status).length === 0 && (
                        <div className="col-span-full text-center py-12">
                          <div className="text-muted-foreground">
                            {status === "all" ? "No auctions found" : status === "scheduled" ? "No upcoming auctions" : `No ${status} auctions`}
                          </div>
                          {status === "all" && (
                            <Button 
                              variant="outline" 
                              className="mt-4"
                              onClick={() => setActiveView("create")}
                            >
                              Create Your First Auction
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </main>

      <Dialog open={confirmDialog.isOpen} onOpenChange={open => !open && setConfirmDialog({ ...confirmDialog, isOpen: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === "accept" ? "Accept Auction" : "Reject Auction"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmDialog.type} the auction "{confirmDialog.auctionTitle}"?
              {confirmDialog.type === "accept" 
                ? " This will make the auction live and visible to bidders." 
                : " This action cannot be undone and will permanently reject the auction."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            >
              Cancel
            </Button>
            <Button 
              variant={confirmDialog.type === "accept" ? "default" : "destructive"} 
              onClick={confirmAction}
            >
              {confirmDialog.type === "accept" ? "Accept Auction" : "Reject Auction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 w-full border-t bg-background/95 backdrop-blur p-2 flex justify-around z-40">
        <Button 
          variant={activeView === "home" ? "default" : "ghost"} 
          onClick={() => setActiveView("home")}
          className="flex flex-col items-center gap-1 h-auto py-2"
        >
          <Home className="h-5 w-5" />
          <span className="text-xs">Home</span>
        </Button>
        <Button 
          variant={activeView === "create" ? "default" : "ghost"} 
          onClick={() => setActiveView("create")}
          className="flex flex-col items-center gap-1 h-auto py-2"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs">Create</span>
        </Button>
        <Button 
          variant={activeView === "my-auctions" ? "default" : "ghost"} 
          onClick={() => setActiveView("my-auctions")}
          className="flex flex-col items-center gap-1 h-auto py-2"
        >
          <List className="h-5 w-5" />
          <span className="text-xs">My Auctions</span>
        </Button>
      </div>
    </div>
  )
}