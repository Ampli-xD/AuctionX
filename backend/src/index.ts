import 'dotenv/config'
import { Hono } from 'hono'
import { sequelize } from './db'
import { redis } from './services/redis'
import { requireAuth } from './services/middleware'
import { createServer } from 'http'
import { initSocket } from './services/socket.ts'
import { initializeAuctionSocketHandlers } from './services/auctionRoom'


const app = new Hono()

const server = createServer(async (req, res) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Credentials': 'true', // Add this if using credentials
      })
      return res.end()
    }

    // Convert Node req to Fetch Request
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers as any,
      body: ['GET', 'HEAD'].includes(req.method!) ? undefined : req,
      duplex: ['GET', 'HEAD'].includes(req.method!) ? undefined : 'half',
    })

    const response = await app.fetch(request)
    
    // Copy status and headers
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', 'http://localhost:5173')
    headers.set('Access-Control-Allow-Credentials', 'true') // Add this if needed
    
    res.writeHead(response.status, Object.fromEntries(headers))
    const body = await response.arrayBuffer()
    res.end(Buffer.from(body))
  } catch (err) {
    console.error(err)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

// Initialize Socket.IO with proper CORS configuration
const io = initSocket(server, {
  cors: {
    origin: "http://localhost:5173", // Your frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true // Allow cookies/auth headers if needed
  }
})
initializeAuctionSocketHandlers()

sequelize.sync({ alter: true })
  .then(() => console.log('✅ Models synced'))
  .catch(err => console.error('❌ Sync error', err))

import { auctionRouter } from './apis/auctions'
app.route('/api/auction', auctionRouter)

import { userRouter } from './apis/users'
app.route('/api/user', userRouter)

app.get('/', (c) => c.text('Hono backend running'))

server.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://localhost:3000')
})