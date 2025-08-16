import { Hono } from 'hono'
import { Auction } from '../models/auctions'
import { Log } from '../models/logs'
import schedule from 'node-schedule'
import { scheduleAuctionStart } from '../services/auctionRoom'

export const auctionRouter = new Hono()

auctionRouter.get('/', async (c) => {
  try {
    const auctions = await Auction.findAll({
      order: [['startDate', 'DESC']]
    })
    return c.json(auctions)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to fetch auctions' }, 500)
  }
})

auctionRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const auction = await Auction.findByPk(id)

    if (!auction) return c.json({ error: 'Auction not found' }, 404)

    return c.json(auction)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to fetch auction' }, 500)
  }
})

auctionRouter.post('/', async (c) => {
  try {
    const body = await c.req.json()

    const requiredFields = ['item', 'startBid', 'startDate', 'duration', 'seller']
    for (const field of requiredFields) {
      if (!body[field]) {
        return c.json({ error: `${field} is required` }, 400)
      }
    }
    const auction = await Auction.create({
      item: body.item,
      description: body.description || '',
      startBid: body.startBid,
      startDate: new Date(body.startDate),
      duration: body.duration,
      live: body.live || false,
      currentBid: body.startBid,
      seller: body.seller,
      highestBidder: null
    })

    const startTime = new Date(body.startDate)

    scheduleAuctionStart(auction.id, auction.startDate)

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

auctionRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const auction = await Auction.findByPk(id)
    if (!auction) return c.json({ error: 'Auction not found' }, 404)

    const allowedFields = ['item', 'description', 'duration', 'live', 'currentBid', 'highestBidder']
    for (const field of allowedFields) {
      if (body[field] !== undefined) auction[field] = body[field]
    }

    await auction.save()

    await Log.create({
      auctionId: auction.id,
      type: 'updated',
      bid: body.currentBid,
      bidder: body.highestBidder
    }) 

    return c.json(auction)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to update auction' }, 500)
  }
})

// auctionRouter.delete('/:id', async (c) => {
//   try {
//     const id = c.req.param('id')
//     const auction = await Auction.findByPk(id)
//     if (!auction) return c.json({ error: 'Auction not found' }, 404)

//     await auction.destroy()

//     await Log.create({
//       auctionId: Number(id),
//       type: 'deleted'
//     })

//     return c.json({ message: 'Auction deleted' })
//   } catch (err) {
//     console.error(err)
//     return c.json({ error: 'Failed to delete auction' }, 500)
//   }
// })

