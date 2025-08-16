"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Gavel, Github } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md border border-border shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Gavel className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Welcome to AuctionX</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Discover, bid, and sell unique items in real-time auctions. Join our vibrant community today!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
            onClick={() => window.location.href = "/dashboard"}
          >
            Get Started
          </Button>
          <Button 
            variant="outline" 
            className="w-full border-border text-muted-foreground hover:bg-accent"
            onClick={() => window.location.href = "https://github.com/Ampli-xD/AuctionX"}
          >
            <Github className="h-5 w-5 mr-2" />
            View on GitHub
          </Button>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} AuctionX. All rights reserved.</p>
      </footer>
    </div>
  )
}