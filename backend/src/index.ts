import 'dotenv/config'
import { Hono } from 'hono'
import { WebSocketServer } from 'ws'
import { sequelize } from './db'
import { redis } from './services/redis'
import cors from 'cors'
import { requireAuth } from './services/middleware'
import { createServer } from 'http'
import { initSocket } from './services/socket.ts'


const app = new Hono()

const server = createServer(async (req, res) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': 'http://localhost:5173', // frontend origin
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      })
      return res.end()
    }

    // Convert Node req to Fetch Request
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers as any,
      body: ['GET', 'HEAD'].includes(req.method!) ? undefined : req,
      duplex: ['GET', 'HEAD'].includes(req.method!) ? undefined : 'half', // required for POST/PUT
    })

    const response = await app.fetch(request)

    // Copy status and headers
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', 'http://localhost:5173') // Add CORS header

    res.writeHead(response.status, Object.fromEntries(headers))
    const body = await response.arrayBuffer()
    res.end(Buffer.from(body))
  } catch (err) {
    console.error(err)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
})


const io = initSocket(server)

sequelize.sync({ alter: true })
  .then(() => console.log('✅ Models synced'))
  .catch(err => console.error('❌ Sync error', err))


import { auctionRouter } from './apis/auctions'
app.route('/api/prt/auction', auctionRouter)



app.get('/', (c) => c.text('Hono backend running'))
server.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://localhost:3000')
})

