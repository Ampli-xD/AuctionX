import { Hono } from 'hono'
import { Op } from 'sequelize'
import { Auction } from '../models/auctions'
import { Log } from '../models/logs'
import { User } from '../models/users'
import { scheduleAuctionStart } from '../services/auctionRoom'
import schedule from 'node-schedule'
import { requireAuth } from '../services/middleware'
import { supabase } from '../services/supabase'

export const auctionRouter = new Hono()
auctionRouter.use('*', requireAuth)

// Helper function to store user details from Supabase
async function storeUserIfFirstTime(token: string) {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { token } })
    if (existingUser) return existingUser

    // Get user data from Supabase using the token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      console.error('Failed to fetch user from Supabase:', error)
      return null
    }

    // Create new user record
    const newUser = await User.create({
      token: token,
      username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
      email: user.email || ''
    })

    return newUser
  } catch (err) {
    console.error('Error storing user:', err)
    return null
  }
}

// GET all auctions, optionally filter by status and seller
auctionRouter.get('/', async (c) => {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    
    // Store user details if first time login
    if (token) {
      await storeUserIfFirstTime(token)
    }

    const { status, seller } = c.req.query() as { status?: string; seller?: string }

    const where: any = {}

    if (status) {
      const statuses = status.split(',')
      if (statuses.includes('live')) where.live = true
      if (statuses.includes('pending')) where.live = false
      if (statuses.includes('ended')) where.startDate = { [Op.lt]: new Date() }
    }

    if (seller) {
      where.seller = seller
    }

    const auctions = await Auction.findAll({
      where,
      order: [['startDate', 'DESC']]
    })

    return c.json(auctions)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to fetch auctions' }, 500)
  }
})

// GET auction by ID
auctionRouter.get('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const auction = await Auction.findByPk(id)
    if (!auction) return c.json({ error: 'Auction not found' }, 404)
    return c.json(auction)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to fetch auction' }, 500)
  }
})

// CREATE new auction
auctionRouter.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const requiredFields = ['item', 'startBid', 'bidIncrement', 'startDate', 'duration', 'seller']
    for (const field of requiredFields) {
      if (!body[field]) return c.json({ error: `${field} is required` }, 400)
    }

    const startDate = new Date(body.startDate)
    if (startDate <= new Date()) return c.json({ error: 'startDate must be in the future' }, 400)

    const auction = await Auction.create({
      item: body.item,
      description: body.description || '',
      startBid: body.startBid,
      bidIncrement: body.bidIncrement,
      startDate: startDate.toISOString(),
      duration: body.duration,
      live: false,
      currentBid: 0,
      seller: body.seller,
      highestBidder: null,
    })

    scheduleAuctionStart(auction.id, auction.startDate, auction.duration)

    await Log.create({
      auctionId: auction.id,
      type: 'created'
    })

    return c.json(auction, 201)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to create auction' }, 500)
  }
})

// UPDATE auction
auctionRouter.put('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const auction = await Auction.findByPk(id)
    if (!auction) return c.json({ error: 'Auction not found' }, 404)

    const allowedFields = ['item', 'description', 'duration', 'live', 'currentBid', 'highestBidder', 'bidIncrement', 'status']
    for (const field of allowedFields) {
      if (body[field] !== undefined) auction[field] = body[field]
    }

    await auction.save()

    await Log.create({
      auctionId: auction.id,
      type: body.currentBid ? 'bidding' : 'updated',
      bid: body.currentBid || null,
      bidder: body.highestBidder || null
    })

    return c.json(auction)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to update auction' }, 500)
  }
})

// DELETE auction
auctionRouter.delete('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const auction = await Auction.findByPk(id)
    if (!auction) return c.json({ error: 'Auction not found' }, 404)

    const job = schedule.scheduledJobs[id]
    if (job) job.cancel()

    await auction.destroy()

    await Log.create({
      auctionId: id,
      type: 'deleted'
    })

    return c.json({ message: 'Auction deleted and schedule canceled' })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to delete auction' }, 500)
  }
})

// ACCEPT pending auction
auctionRouter.post('/:id/accept', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const auction = await Auction.findByPk(id)
    if (!auction) return c.json({ error: 'Auction not found' }, 404)
    if (auction.status !== 'pending') return c.json({ error: 'Only pending auctions can be accepted' }, 400)

    auction.status = 'accepted'
    auction.live = false
    await auction.save()

    scheduleAuctionStart(auction.id, auction.startDate)

    await Log.create({
      auctionId: auction.id,
      type: 'updated'
    })

    return c.json({ message: 'Auction accepted', auction })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to accept auction' }, 500)
  }
})

// REJECT pending auction
auctionRouter.post('/:id/reject', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const auction = await Auction.findByPk(id)
    if (!auction) return c.json({ error: 'Auction not found' }, 404)
    if (auction.status !== 'pending') return c.json({ error: 'Only pending auctions can be rejected' }, 400)

    auction.status = 'rejected'
    auction.live = false
    await auction.save()

    await Log.create({
      auctionId: auction.id,
      type: 'deleted'
    })

    return c.json({ message: 'Auction rejected', auction })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to reject auction' }, 500)
  }
})