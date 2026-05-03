const express = require('express')
const router = express.Router()
const { getMatchEvents } = require('../utils/eventRecorder')
const pool = require('../db')

// Get all past matches
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.started_at, m.ended_at,
              u.username as winner,
              r.topic
       FROM matches m
       LEFT JOIN users u ON m.winner_id = u.id
       LEFT JOIN rooms r ON m.room_id = r.id
       ORDER BY m.started_at DESC
       LIMIT 20`
    )
    res.json({ matches: result.rows })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get full replay for a specific match
router.get('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params

    // Get match info
    const matchResult = await pool.query(
      `SELECT m.*, u.username as winner_username, r.topic
       FROM matches m
       LEFT JOIN users u ON m.winner_id = u.id
       LEFT JOIN rooms r ON m.room_id = r.id
       WHERE m.id = $1`,
      [matchId]
    )

    if (!matchResult.rows[0]) {
      return res.status(404).json({ error: 'Match not found' })
    }

    // Get all events in order
    const events = await getMatchEvents(matchId)

    res.json({
      match: matchResult.rows[0],
      events
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router