"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Bell, Home, Plus, List, LogOut, Clock, DollarSign, User, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ActiveView = "home" | "create" | "my-auctions"

interface Auction {
  id: string
  title: string
  description: string
  currentBid: number | null
  timeRemaining: string
  status: "active" | "upcoming" | "ended" | "pending" | "accepted"
  startingBid: number
  bidIncrement: number
  duration: string
  dateTime: string
  sellerName: string
}

const mockAuctions: Auction[] = [
  {
    id: "1",
    title: "Vintage Guitar Collection",
    description: "Rare 1960s Fender Stratocaster in excellent condition",
    currentBid: 2500,
    timeRemaining: "2d 14h 30m",
    status: "active",
    startingBid: 1000,
    bidIncrement: 50,
    duration: "7 days",
    dateTime: "2024-01-15 10:00",
    sellerName: "Mike Johnson",
  },
  {
    id: "2",
    title: "Modern Art Painting",
    description: "Abstract expressionist piece by emerging artist",
    currentBid: null,
    timeRemaining: "1d 8h 15m",
    status: "active",
    startingBid: 500,
    bidIncrement: 25,
    duration: "5 days",
    dateTime: "2024-01-16 14:00",
    sellerName: "Sarah Chen",
  },
  {
    id: "3",
    title: "Antique Watch",
    description: "Swiss mechanical watch from the 1940s",
    currentBid: 1200,
    timeRemaining: "Ended",
    status: "ended",
    startingBid: 800,
    bidIncrement: 50,
    duration: "3 days",
    dateTime: "2024-01-10 16:00",
    sellerName: "Robert Smith",
  },
  {
    id: "4",
    title: "Collectible Comic Books",
    description: "First edition Marvel comics from the 1970s",
    currentBid: null,
    timeRemaining: "Starting soon",
    status: "upcoming",
    startingBid: 300,
    bidIncrement: 25,
    duration: "5 days",
    dateTime: "2024-01-20 12:00",
    sellerName: "Emma Davis",
  },
  {
    id: "5",
    title: "Vintage Camera",
    description: "Classic 35mm film camera from the 1980s",
    currentBid: null,
    timeRemaining: "Pending approval",
    status: "pending",
    startingBid: 200,
    bidIncrement: 15,
    duration: "3 days",
    dateTime: "2024-01-18 09:00",
    sellerName: "Alex Turner",
  },
  {
    id: "6",
    title: "Designer Handbag",
    description: "Authentic luxury handbag in mint condition",
    currentBid: 450,
    timeRemaining: "3d 12h 45m",
    status: "accepted",
    startingBid: 400,
    bidIncrement: 20,
    duration: "5 days",
    dateTime: "2024-01-17 15:30",
    sellerName: "Lisa Wang",
  },
]

export default function AuctionXDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("home")
  const [userName] = useState("John Doe")
  const [notificationCount] = useState(3)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    type: "accept" | "reject" | null
    auctionId: string | null
    auctionTitle: string
  }>({
    isOpen: false,
    type: null,
    auctionId: null,
    auctionTitle: "",
  })

  const [newAuction, setNewAuction] = useState({
    title: "",
    description: "",
    dateTime: "",
    duration: "",
    startingBid: "",
    bidIncrement: "",
  })

  const handleCreateAuction = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Creating auction:", newAuction)
    setNewAuction({
      title: "",
      description: "",
      dateTime: "",
      duration: "",
      startingBid: "",
      bidIncrement: "",
    })
    setActiveView("my-auctions")
  }

  const handleAcceptReject = (action: "accept" | "reject", auctionId: string, auctionTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      type: action,
      auctionId,
      auctionTitle,
    })
  }

  const confirmAction = () => {
    console.log(`${confirmDialog.type} auction:`, confirmDialog.auctionId)
    setConfirmDialog({
      isOpen: false,
      type: null,
      auctionId: null,
      auctionTitle: "",
    })
  }

  const renderAuctionCard = (auction: Auction, showActions?: "pending" | "none") => (
    <Card key={auction.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">{auction.title}</CardTitle>
        <CardDescription>{auction.description}</CardDescription>
        <div className="flex items-center gap-2 mt-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Seller: {auction.sellerName}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-lg">{auction.currentBid ? `$${auction.currentBid}` : "No bid"}</span>
          </div>
          <Badge variant="secondary">Current Bid</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Starting Bid:</span>
          <span className="text-sm font-medium">${auction.startingBid}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bid Increment:</span>
          <span className="text-sm font-medium">${auction.bidIncrement}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-600" />
          <span className="text-sm text-muted-foreground">{auction.timeRemaining}</span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        {showActions === "pending" ? (
          <>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() => handleAcceptReject("accept", auction.id, auction.title)}
            >
              <Check className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => handleAcceptReject("reject", auction.id, auction.title)}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </>
        ) : (
          <Button className="w-full">{auction.status === "active" ? "Place Bid" : "View Details"}</Button>
        )}
      </CardFooter>
    </Card>
  )

  const renderHomeView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Active Auctions</h2>
        <p className="text-muted-foreground">Browse and bid on available auctions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockAuctions.filter((auction) => auction.status === "active").map((auction) => renderAuctionCard(auction))}
      </div>
    </div>
  )

  const renderCreateView = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Create New Auction</h2>
        <p className="text-muted-foreground">List your item for auction</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAuction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter auction title"
                value={newAuction.title}
                onChange={(e) => setNewAuction({ ...newAuction, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your item"
                value={newAuction.description}
                onChange={(e) => setNewAuction({ ...newAuction, description: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateTime">Date & Time</Label>
                <Input
                  id="dateTime"
                  type="datetime-local"
                  value={newAuction.dateTime}
                  onChange={(e) => setNewAuction({ ...newAuction, dateTime: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Select onValueChange={(value) => setNewAuction({ ...newAuction, duration: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 day">1 Day</SelectItem>
                    <SelectItem value="3 days">3 Days</SelectItem>
                    <SelectItem value="5 days">5 Days</SelectItem>
                    <SelectItem value="7 days">7 Days</SelectItem>
                    <SelectItem value="14 days">14 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startingBid">Starting Bid ($)</Label>
                <Input
                  id="startingBid"
                  type="number"
                  placeholder="0.00"
                  value={newAuction.startingBid}
                  onChange={(e) => setNewAuction({ ...newAuction, startingBid: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bidIncrement">Bid Increment ($)</Label>
                <Input
                  id="bidIncrement"
                  type="number"
                  placeholder="0.00"
                  value={newAuction.bidIncrement}
                  onChange={(e) => setNewAuction({ ...newAuction, bidIncrement: e.target.value })}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full">
              Create Auction
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  const renderMyAuctionsView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Auctions</h2>
        <p className="text-muted-foreground">Manage your auction listings</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="ended">Ended</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAuctions.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">No auctions found</p>
                <Button variant="outline" className="mt-4 bg-transparent" onClick={() => setActiveView("create")}>
                  Create Your First Auction
                </Button>
              </div>
            ) : (
              mockAuctions.map((auction) => renderAuctionCard(auction))
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAuctions.filter((auction) => auction.status === "pending").length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">No pending auctions</p>
              </div>
            ) : (
              mockAuctions
                .filter((auction) => auction.status === "pending")
                .map((auction) => renderAuctionCard(auction, "pending"))
            )}
          </div>
        </TabsContent>

        <TabsContent value="accepted" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAuctions.filter((auction) => auction.status === "accepted").length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">No accepted auctions</p>
              </div>
            ) : (
              mockAuctions
                .filter((auction) => auction.status === "accepted")
                .map((auction) => renderAuctionCard(auction))
            )}
          </div>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAuctions.filter((auction) => auction.status === "upcoming").length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">No upcoming auctions</p>
                <Button variant="outline" className="mt-4 bg-transparent" onClick={() => setActiveView("create")}>
                  Create Your First Auction
                </Button>
              </div>
            ) : (
              mockAuctions
                .filter((auction) => auction.status === "upcoming")
                .map((auction) => renderAuctionCard(auction))
            )}
          </div>
        </TabsContent>

        <TabsContent value="ended" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockAuctions.filter((auction) => auction.status === "ended").length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">No ended auctions</p>
              </div>
            ) : (
              mockAuctions.filter((auction) => auction.status === "ended").map((auction) => renderAuctionCard(auction))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, isOpen: false })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.type === "accept" ? "Accept Auction" : "Reject Auction"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmDialog.type} the auction "{confirmDialog.auctionTitle}"?
              {confirmDialog.type === "accept"
                ? " This will make the auction live and available for bidding."
                : " This action cannot be undone and the auction will be permanently rejected."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}>
              Cancel
            </Button>
            <Button variant={confirmDialog.type === "accept" ? "default" : "destructive"} onClick={confirmAction}>
              {confirmDialog.type === "accept" ? "Accept" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
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

      <main className="container mx-auto px-4 py-8 pb-24">
        {activeView === "home" && renderHomeView()}
        {activeView === "create" && renderCreateView()}
        {activeView === "my-auctions" && renderMyAuctionsView()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            <Button
              variant={activeView === "home" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("home")}
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-4 transition-all",
                activeView === "home" && "bg-primary text-primary-foreground",
              )}
            >
              <Home className="h-5 w-5" />
              <span className="text-xs">Home</span>
            </Button>

            <Button
              variant={activeView === "create" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("create")}
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-4 transition-all",
                activeView === "create" && "bg-primary text-primary-foreground",
              )}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">Create</span>
            </Button>

            <Button
              variant={activeView === "my-auctions" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("my-auctions")}
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-4 transition-all",
                activeView === "my-auctions" && "bg-primary text-primary-foreground",
              )}
            >
              <List className="h-5 w-5" />
              <span className="text-xs">My Auctions</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  )
}
