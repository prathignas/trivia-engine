const express = require('express')
const router = express.Router()
const pool = require('../db')

// Get top 10 players by ELO
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, elo, games_played
       FROM users
       ORDER BY elo DESC
       LIMIT 10`
    )

    res.json({ leaderboard: result.rows })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router