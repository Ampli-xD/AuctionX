import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'

let io: SocketIOServer

export const initSocket = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
    path: '/api/auction/ws',
    cors: { origin: '*' },
  })

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id)
  })

  return io
}

export const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized!')
  return io
}
