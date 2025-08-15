'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Auction {
  id: number
  item: string
  description: string
  startBid: number
  startDate: string
  duration: number
  live: boolean
  currentBid: number
  seller: string
  highestBidder: string | null
}

export default function DashboardPage() {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/auctions')
        if (!res.ok) throw new Error('Failed to fetch auctions')
        const data = await res.json()
        setAuctions(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchAuctions()
  }, [])

  if (loading) return <p className="text-center mt-10">Loading auctions...</p>
  if (auctions.length === 0) return <p className="text-center mt-10">No auctions available</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {auctions.map((auction) => (
        <Card key={auction.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              {auction.item}
              <Badge variant={auction.live ? 'success' : 'secondary'}>
                {auction.live ? 'Live' : 'Upcoming'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2">{auction.description || 'No description'}</p>
            <p>Start Bid: ${auction.startBid}</p>
            <p>Current Bid: ${auction.currentBid}</p>
            <p>Seller: {auction.seller}</p>
            <p>
              Highest Bidder: {auction.highestBidder ? auction.highestBidder : 'None yet'}
            </p>
            <p>Start Date: {new Date(auction.startDate).toLocaleString()}</p>
            <p>Duration: {auction.duration} minutes</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
