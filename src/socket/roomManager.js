const pool = require('../db')
const redis = require('../db/redis')
const { scheduleQuestionGeneration, getQuestionsFromPool } = require('../workers/questionQueue')

// Generate a random 6 character room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Create a new room in PostgreSQL and store active state in Redis
const createRoom = async (hostId, hostUsername, topic) => {
  const code = generateRoomCode()

  // Save room to PostgreSQL permanently
  const result = await pool.query(
    `INSERT INTO rooms (code, host_id, topic, status)
     VALUES ($1, $2, $3, 'lobby')
     RETURNING *`,
    [code, hostId, topic]
  )

   const room = result.rows[0]

   // Store active room state in Redis
  const roomState = {
    id: room.id,
    code,
    topic,
    hostId,
    hostUsername,
    status: 'lobby',
    players: [
      { userId: hostId, username: hostUsername, score: 0 }
    ]
  }


   await redis.set(`room:${code}`, JSON.stringify(roomState), 'EX', 3600)
  // EX 3600 = auto delete after 1 hour if game never starts

  return roomState

  // Pre-generate questions as soon as room is created
// By the time game starts questions will be ready in Redis
const existingQuestions = await getQuestionsFromPool(roomState.topic, 'medium', 1)

if (!existingQuestions) {
  // No questions in pool yet — schedule generation
  await scheduleQuestionGeneration(roomState.topic, 'medium', 20)
  console.log(`📋 Pre-generating questions for topic: ${roomState.topic}`)
} else {
  // Put the question back since we only checked
  // We will handle this properly in the game
  console.log(`✅ Questions already in pool for: ${roomState.topic}`)
 } 
}

// Get room state from Redis
const getRoom = async (code) => {
  const data = await redis.get(`room:${code}`)
  if (!data) return null
  return JSON.parse(data)
}

// Update room state in Redis
const updateRoom = async (code, roomState) => {
  await redis.set(`room:${code}`, JSON.stringify(roomState), 'EX', 3600)
}

// Delete room from Redis when game ends
const deleteRoom = async (code) => {
  await redis.del(`room:${code}`)
}

module.exports = { createRoom, getRoom, updateRoom, deleteRoom }