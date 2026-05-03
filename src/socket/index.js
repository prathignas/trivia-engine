const { createRoom, getRoom, updateRoom } = require('./roomManager')

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`⚡ User connected: ${socket.id}`)

    // ─── CREATE ROOM ─────────────────────────────────────────
    socket.on('room:create', async (data) => {
      try {
        const { userId, username, topic } = data

        const roomState = await createRoom(userId, username, topic)

        // Join the Socket.io room
        socket.join(roomState.code)

        // Store user info on the socket for later use
        socket.userId = userId
        socket.username = username
        socket.roomCode = roomState.code

        // Tell the creator their room is ready
        socket.emit('room:created', roomState)

        console.log(`🎮 Room ${roomState.code} created by ${username}`)

      } catch (error) {
        console.error(error)
        socket.emit('error', { message: 'Failed to create room' })
      }
    })

    // ─── JOIN ROOM ───────────────────────────────────────────
    socket.on('room:join', async (data) => {
      try {
        const { userId, username, code } = data

        // Get room from Redis
        const roomState = await getRoom(code)

        if (!roomState) {
          return socket.emit('error', { message: 'Room not found' })
        }

        if (roomState.status !== 'lobby') {
          return socket.emit('error', { message: 'Game already started' })
        }

        if (roomState.players.length >= 6) {
          return socket.emit('error', { message: 'Room is full' })
        }

        // Check player not already in room
        const alreadyIn = roomState.players.find(p => p.userId === userId)
        if (alreadyIn) {
          return socket.emit('error', { message: 'Already in room' })
        }

        // Add player to room state
        roomState.players.push({ userId, username, score: 0 })
        await updateRoom(code, roomState)

        // Join the Socket.io room
        socket.join(code)
        socket.userId = userId
        socket.username = username
        socket.roomCode = code

        // Tell the joining player the full room state
        socket.emit('room:joined', roomState)

        // Tell everyone else a new player joined
        socket.to(code).emit('room:playerJoined', { username, players: roomState.players })

        console.log(`👤 ${username} joined room ${code}`)

      } catch (error) {
        console.error(error)
        socket.emit('error', { message: 'Failed to join room' })
      }
    })

    const { startGame } = require('./gameMachine')

// ─── START GAME ──────────────────────────────────────────────
socket.on('game:start', async (data) => {
  try {
    const { code, userId } = data

    const roomState = await getRoom(code)

    if (!roomState) {
      return socket.emit('error', { message: 'Room not found' })
    }

    // Only host can start the game
    if (roomState.hostId !== userId) {
      return socket.emit('error', { message: 'Only the host can start the game' })
    }

    if (roomState.players.length < 1) {
      return socket.emit('error', { message: 'Need at least 1 player' })
    }

    if (roomState.status !== 'lobby') {
      return socket.emit('error', { message: 'Game already started' })
    }

    // Start the game — this runs the full state machine
    startGame(io, code)

  } catch (error) {
    console.error(error)
    socket.emit('error', { message: 'Failed to start game' })
  }
})

// ─── PLAYER ANSWER ───────────────────────────────────────────
socket.on('game:answer', async (data) => {
  try {
    const { code, userId, answer, timeTaken } = data

    const roomState = await getRoom(code)

    if (!roomState || roomState.status !== 'playing') {
      return socket.emit('error', { message: 'No active game' })
    }

    // Prevent answering twice
    if (roomState.answers && roomState.answers[userId]) {
      return socket.emit('error', { message: 'Already answered' })
    }

    // Store the answer
    if (!roomState.answers) roomState.answers = {}
    roomState.answers[userId] = { answer, timeTaken }
    await updateRoom(code, roomState)

    // Confirm to the player their answer was received
    socket.emit('game:answerReceived', { answer })

    // Tell everyone how many have answered (not who answered what)
    const answeredCount = Object.keys(roomState.answers).length
    io.to(code).emit('game:answerCount', {
      answered: answeredCount,
      total: roomState.players.length
    })

  } catch (error) {
    console.error(error)
    socket.emit('error', { message: 'Failed to submit answer' })
  }
})

    // ─── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.id}`)

      if (socket.roomCode && socket.username) {
        const roomState = await getRoom(socket.roomCode)

        if (roomState && roomState.status === 'lobby') {
          // Remove player from room
          roomState.players = roomState.players.filter(p => p.userId !== socket.userId)
          await updateRoom(socket.roomCode, roomState)

          // Tell remaining players
          io.to(socket.roomCode).emit('room:playerLeft', {
            username: socket.username,
            players: roomState.players
          })
        }
      }
    })

  })
}

module.exports = setupSocket