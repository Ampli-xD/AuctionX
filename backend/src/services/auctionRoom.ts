import { Hono } from 'hono'
import { redis } from './redis'
import WebSocket, { WebSocketServer } from 'ws'

const wssMap = new Map<number, WebSocketServer>() // auctionId -> ws server

export function setupAuction(auctionId: number, app: Hono) {
  app.get(`/auction/${auctionId}/join`, (c) => {
    return c.json({ message: 'Auction joined! Connect to WebSocket to bid.' })
  })

  const wss = new WebSocketServer({ noServer: true })
  wssMap.set(auctionId, wss)

  wss.on('connection', (ws) => {
    console.log(`User connected to auction ${auctionId}`)
    ws.on('message', async (msg) => {
      const data = JSON.parse(msg.toString())
      const { bid, bidder } = data

      await redis.set(`auction:${auctionId}`, JSON.stringify({ bid, bidder }))
      console.log(`Updated Redis for auction ${auctionId}: bid=${bid}`)
      
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ bid, bidder }))
        }
      })
    })
  })

  // Optional: remove route / ws server after auction ends
  // setTimeout(() => cleanupAuction(auctionId, app), auctionDuration)
}


export function cleanupAuction(auctionId: number, app: Hono) {
  console.log(`Cleaning up auction ${auctionId}`)
  wssMap.get(auctionId)?.close()
  wssMap.delete(auctionId)
}
