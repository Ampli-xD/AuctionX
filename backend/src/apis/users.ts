import { Hono } from 'hono'
import { User } from '../models/users'
import { requireAuth } from '../services/middleware'

export const userRouter = new Hono()
userRouter.use('*', requireAuth)

// GET user by token from body
userRouter.get('/', async (c) => {
  try {
    // Authorization header token for verification is handled by requireAuth middleware

    const { token } = await c.req.json() as { token?: string }

    if (!token) {
      return c.json({ error: 'Token in request body required' }, 400)
    }

    const users = await User.findAll({
      where: { token },
      attributes: ['id', 'token', 'username', 'email'],
      order: [['username', 'ASC']]
    })

    return c.json(users)
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})