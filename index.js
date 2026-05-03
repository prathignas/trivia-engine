const leaderboardRoutes = require('./src/routes/leaderboard')
require('dotenv').config()

const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const replayRoutes = require('./src/routes/replay')
const hintRoutes = require('./src/routes/hint')

const app = express()
const httpServer = createServer(app)
const io=new Server(httpServer,{
  cors:{
    origin:'*'
  }
})

app.use(express.json())
app.use(express.static('../public'))
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/replay', replayRoutes)
app.use('/api/hint', hintRoutes)

// Connect to database
require('./src/db')
require('./src/db/redis')
require('./src/workers/questionWorker')

//routes
const authRoutes = require('./src/routes/auth')
app.use('/api/auth', authRoutes)


// Socket.io
const setupSocket = require('./src/socket')
setupSocket(io)

app.get('/test-ai', async (req, res) => {
  const { scheduleQuestionGeneration } = require('./src/workers/questionQueue')
  await scheduleQuestionGeneration('science', 'medium', 2)
  res.json({ message: 'Job added to queue' })
})

const PORT = process.env.PORT || 3000

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})