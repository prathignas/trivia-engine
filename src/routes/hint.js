const express = require('express')
const router = express.Router()
const { generateHintStream } = require('../utils/ai')
const { getRoom } = require('../socket/roomManager')
const authMiddleware = require('../middleware/auth')

// GET /api/hint/:roomCode
// Streams an AI hint for the current question
router.get('/:roomCode', authMiddleware, async (req, res) => {
  try {
    const { roomCode } = req.params

    // Get current game state from Redis
    const roomState = await getRoom(roomCode)

    if (!roomState) {
      return res.status(404).json({ error: 'Room not found' })
    }

    if (roomState.status !== 'playing') {
      return res.status(400).json({ error: 'No active question' })
    }

    // Get the current question
    const currentIndex = roomState.currentQuestionIndex
    const currentQuestion = roomState.questions[currentIndex]

    if (!currentQuestion) {
      return res.status(400).json({ error: 'No question found' })
    }

    console.log(`💡 Hint requested for: "${currentQuestion.question}"`)

    // Stream the hint back
    await generateHintStream(
      currentQuestion.question,
      currentQuestion.options,
      res
    )

  } catch (error) {
    console.error(error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate hint' })
    }
  }
})

module.exports = router