"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Bell, LogOut, Clock, DollarSign, User, Users, Gavel, ArrowLeft } from "lucide-react"

interface BidHistoryItem {
  id: string
  bidder: string
  amount: number
  timestamp: string
  isYou?: boolean
}

const mockAuctionData = {
  id: "1",
  title: "Vintage 1960s Fender Stratocaster",
  description:
    "Rare sunburst finish Fender Stratocaster in excellent condition. This guitar has been professionally maintained and comes with original case. Perfect for collectors and musicians alike.",
  sellerName: "Mike Johnson",
  sellerRating: 4.8,
  currentBid: 2500,
  startingBid: 1000,
  bidIncrement: 50,
  timeRemaining: "2d 14h 30m",
  totalBids: 47,
  activeUsers: 12,
  status: "live" as const,
  images: ["/vintage-fender-stratocaster.png"],
}

const mockBidHistory: BidHistoryItem[] = [
  { id: "1", bidder: "User123", amount: 2500, timestamp: "2 minutes ago" },
  { id: "2", bidder: "GuitarLover", amount: 2450, timestamp: "5 minutes ago", isYou: true },
  { id: "3", bidder: "MusicFan88", amount: 2400, timestamp: "8 minutes ago" },
  { id: "4", bidder: "VintageCollector", amount: 2350, timestamp: "12 minutes ago" },
  { id: "5", bidder: "RockStar2024", amount: 2300, timestamp: "15 minutes ago" },
]

export default function BiddingRoom() {
  const [userName] = useState("John Doe")
  const [notificationCount] = useState(3)
  const [bidAmount, setBidAmount] = useState("")
  const [hasJoined, setHasJoined] = useState(false)
  const [isPlacingBid, setIsPlacingBid] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState({
    days: 2,
    hours: 14,
    minutes: 30,
    seconds: 0,
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        let { days, hours, minutes, seconds } = prev

        if (seconds > 0) {
          seconds--
        } else if (minutes > 0) {
          minutes--
          seconds = 59
        } else if (hours > 0) {
          hours--
          minutes = 59
          seconds = 59
        } else if (days > 0) {
          days--
          hours = 23
          minutes = 59
          seconds = 59
        }

        return { days, hours, minutes, seconds }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTimeRemaining = () => {
    const { days, hours, minutes, seconds } = timeRemaining
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else {
      return `${minutes}m ${seconds}s`
    }
  }

  const handleJoinAuction = () => {
    setHasJoined(true)
    setBidAmount(String(mockAuctionData.currentBid + mockAuctionData.bidIncrement))
  }

  const handlePlaceBid = () => {
    setIsPlacingBid(true)
    // Simulate bid placement
    setTimeout(() => {
      setIsPlacingBid(false)
      setBidAmount(String(Number(bidAmount) + mockAuctionData.bidIncrement))
    }, 1000)
  }

  const minBid = mockAuctionData.currentBid + mockAuctionData.bidIncrement

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navbar - Same as main dashboard */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">AuctionX</h1>
            <span className="text-muted-foreground">Hello, {userName}</span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">{notificationCount}</Badge>
              )}
            </Button>
            <Button variant="ghost" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {!hasJoined ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">{mockAuctionData.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{mockAuctionData.sellerName}</span>
                        <Badge variant="outline" className="ml-1">
                          ★ {mockAuctionData.sellerRating}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{mockAuctionData.activeUsers} watching</span>
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
                <p className="text-muted-foreground leading-relaxed mb-6">{mockAuctionData.description}</p>

                <div className="text-center space-y-4">
                  <div className="text-3xl font-bold text-green-600">
                    ${mockAuctionData.currentBid.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Current highest bid</p>

                  <div className="flex items-center justify-center gap-2 p-3 bg-orange-50 rounded-lg">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-800 font-mono text-lg">{formatTimeRemaining()}</span>
                  </div>

                  <Button onClick={handleJoinAuction} className="w-full h-12 text-lg" size="lg">
                    <Users className="h-5 w-5 mr-2" />
                    Join Auction
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Auction Details - Mobile: below bid area, Desktop: left side */}
              <div className="w-full lg:w-1/2 order-2 lg:order-1">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-xl">{mockAuctionData.title}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{mockAuctionData.sellerName}</span>
                            <Badge variant="outline" className="ml-1">
                              ★ {mockAuctionData.sellerRating}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{mockAuctionData.activeUsers} watching</span>
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
                    <p className="text-muted-foreground leading-relaxed">{mockAuctionData.description}</p>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Starting bid</p>
                        <p className="font-semibold">${mockAuctionData.startingBid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bid increment</p>
                        <p className="font-semibold">${mockAuctionData.bidIncrement}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bidding Interface - Mobile: top, Desktop: right side */}
              <div className="w-full lg:w-1/2 order-1 lg:order-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gavel className="h-5 w-5" />
                      Place Your Bid
                    </CardTitle>
                    <CardDescription>
                      Current bid: ${mockAuctionData.currentBid.toLocaleString()} • Minimum bid: $
                      {minBid.toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-600 mb-2">
                        ${mockAuctionData.currentBid.toLocaleString()}
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
                            step={mockAuctionData.bidIncrement}
                            className="pl-10 h-12 text-lg"
                            placeholder={minBid.toString()}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" onClick={() => setBidAmount(String(minBid))} className="h-10">
                          Min Bid
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setBidAmount(String(minBid + mockAuctionData.bidIncrement * 2))}
                          className="h-10"
                        >
                          +${mockAuctionData.bidIncrement * 2}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setBidAmount(String(minBid + mockAuctionData.bidIncrement * 5))}
                          className="h-10"
                        >
                          +${mockAuctionData.bidIncrement * 5}
                        </Button>
                      </div>

                      <Button
                        onClick={handlePlaceBid}
                        disabled={!bidAmount || Number(bidAmount) < minBid || isPlacingBid}
                        className="w-full h-12 text-lg"
                        size="lg"
                      >
                        {isPlacingBid ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Placing Bid...
                          </>
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
          </div>
        )}
      </main>
    </div>
  )
}
