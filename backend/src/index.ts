import 'dotenv/config'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { sequelize } from './db'
import { redis } from './services/redis'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors({ origin: '*' }))

sequelize.sync({ alter: true })
  .then(() => console.log('✅ Models synced'))
  .catch(err => console.error('❌ Sync error', err))

import { auctionRouter } from './apis/auctions'

app.route('/api/auction', auctionRouter)


app.get('/', (c) => c.text('Hono backend running'))

// Example Redis route
app.get('/cache', async (c) => {
  await redis.set('hello', 'world')
  return c.json({ value: await redis.get('hello') })
})

const server = serve({ fetch: app.fetch, port: 3000, hostname: '0.0.0.0' })


// WebSocket support
const wss = new WebSocketServer({ server })
wss.on('connection', (ws) => {
  ws.send('Connected to WS server')
  ws.on('message', (msg) => ws.send(`Echo: ${msg}`))
})

console.log('Server running on http://localhost:3000')
