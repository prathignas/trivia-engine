const pool = require('../db')

// Record a single game event
const recordEvent = async (matchId, eventType, eventData) => {
  try {
    await pool.query(
      `INSERT INTO game_events (match_id, event_type, event_data)
       VALUES ($1, $2, $3)`,
      [matchId, eventType, JSON.stringify(eventData)]
    )
  } catch (error) {
    // Never let recording fail the game
    console.error('Failed to record event:', error.message)
  }
}

// Get all events for a match in order
const getMatchEvents = async (matchId) => {
  const result = await pool.query(
    `SELECT event_type, event_data, occurred_at
     FROM game_events
     WHERE match_id = $1
     ORDER BY occurred_at ASC`,
    [matchId]
  )
  return result.rows
}

module.exports = { recordEvent, getMatchEvents }