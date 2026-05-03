const { getRoom, updateRoom, deleteRoom } = require('./roomManager')
const { calculateMatchElo } = require('../utils/elo')
const pool = require('../db')
const { getQuestionsFromPool, scheduleQuestionGeneration } = require('../workers/questionQueue')
const { recordEvent } = require('../utils/eventRecorder')

const startGame = async (io, roomCode) => {
  // ─── STEP 1: COUNTDOWN ─────────────────────────────────────
  let roomState = await getRoom(roomCode)

  roomState.status = 'countdown'
  await updateRoom(roomCode, roomState)

  io.to(roomCode).emit('game:countdown', { message: 'Game starting in 3 seconds...' })
  await wait(3000)

  // ─── STEP 2: LOAD QUESTIONS FROM REDIS POOL ───────────────
  let questions = await getQuestionsFromPool(roomState.topic, 'medium', 5)

  if (!questions) {
    console.log(`⚠️ Pool empty for ${roomState.topic} — generating now...`)

    // Tell everyone to wait — use io not socket
    io.to(roomCode).emit('game:waiting', { message: 'Preparing questions, starting in a few seconds...' })

    await scheduleQuestionGeneration(roomState.topic, 'medium', 10)

    let attempts = 0
    while (!questions && attempts < 15) {
      await wait(1000)
      questions = await getQuestionsFromPool(roomState.topic, 'medium', 5)
      attempts++
    }

    if (!questions) {
      console.log('⚠️ AI failed — using fallback questions')
      questions = getHardcodedQuestions()
    }
  }

  roomState.questions = questions
  roomState.currentQuestionIndex = 0
  roomState.status = 'playing'
  await updateRoom(roomCode, roomState)

  // Create match record early so we have matchId for event recording
  const matchResult = await pool.query(
    `INSERT INTO matches (room_id, started_at)
     VALUES ($1, NOW()) RETURNING id`,
    [roomState.id]
  )
  const matchId = matchResult.rows[0].id
  roomState.matchId = matchId
  await updateRoom(roomCode, roomState)

  // 📝 Record game started
  await recordEvent(matchId, 'game_started', {
    topic: roomState.topic,
    players: roomState.players.map(p => ({ userId: p.userId, username: p.username })),
    totalQuestions: questions.length
  })

  // ─── STEP 3: QUESTION LOOP ─────────────────────────────────
  for (let i = 0; i < questions.length; i++) {
    roomState = await getRoom(roomCode)

    if (!roomState || roomState.status === 'game_over') break

    roomState.currentQuestionIndex = i
    roomState.answers = {}
    await updateRoom(roomCode, roomState)

    const question = questions[i]

    // 📝 Record question shown
    await recordEvent(matchId, 'question_shown', {
      questionNumber: i + 1,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer
    })

    // Send question — never send correctAnswer to client
    io.to(roomCode).emit('game:question', {
      questionNumber: i + 1,
      total: questions.length,
      question: question.question,
      options: question.options,
      timeLimit: 15
    })

    await wait(15000)

    // ─── STEP 4: SCORING ───────────────────────────────────────
    roomState = await getRoom(roomCode)
    const answers = roomState.answers || {}

    Object.keys(answers).forEach((userId) => {
      const { answer, timeTaken } = answers[userId]
      if (answer === question.correctAnswer) {
        const timeBonus = Math.floor((15 - timeTaken) * 10)
        const points = 100 + timeBonus
        const player = roomState.players.find(p => p.userId === parseInt(userId))
        if (player) player.score += points
      }
    })

    await updateRoom(roomCode, roomState)

    // 📝 Record scoring
    await recordEvent(matchId, 'question_scored', {
      questionNumber: i + 1,
      correctAnswer: question.correctAnswer,
      answers,
      scores: roomState.players.map(p => ({ username: p.username, score: p.score }))
    })

    io.to(roomCode).emit('game:scoring', {
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      players: roomState.players
    })

    await wait(3000)
  }

  // ─── STEP 5: GAME OVER ─────────────────────────────────────
  roomState = await getRoom(roomCode)
  const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score)

  const playerIds = sortedPlayers.map(p => p.userId)
  const dbPlayers = await pool.query(
    `SELECT id, elo, games_played FROM users WHERE id = ANY($1)`,
    [playerIds]
  )

  const playersWithElo = sortedPlayers.map(player => {
    const dbPlayer = dbPlayers.rows.find(p => p.id === player.userId)
    return {
      ...player,
      elo: dbPlayer ? dbPlayer.elo : 1000,
      gamesPlayed: dbPlayer ? dbPlayer.games_played : 0
    }
  })

  const eloResults = calculateMatchElo(playersWithElo)

  // Update match record with winner and end time
  await pool.query(
    `UPDATE matches SET ended_at = NOW(), winner_id = $1 WHERE id = $2`,
    [sortedPlayers[0].userId, matchId]
  )

  for (const player of eloResults) {
    await pool.query(
      `UPDATE users SET elo = $1, games_played = games_played + 1 WHERE id = $2`,
      [player.newElo, player.userId]
    )
    await pool.query(
      `INSERT INTO match_players (match_id, user_id, score, elo_before, elo_after)
       VALUES ($1, $2, $3, $4, $5)`,
      [matchId, player.userId, player.score, player.elo, player.newElo]
    )
  }

  // 📝 Record game over
  await recordEvent(matchId, 'game_over', {
    players: eloResults.map(p => ({
      username: p.username,
      score: p.score,
      eloChange: p.eloChange
    })),
    winner: sortedPlayers[0].username
  })

  io.to(roomCode).emit('game:over', {
    players: eloResults.map(p => ({
      username: p.username,
      score: p.score,
      eloBefore: p.elo,
      eloAfter: p.newElo,
      eloChange: p.eloChange >= 0 ? `+${p.eloChange}` : `${p.eloChange}`
    })),
    winner: eloResults[0]
  })

  await deleteRoom(roomCode)
  console.log(`🏁 Game over in room ${roomCode}. Winner: ${sortedPlayers[0].username}`)
}

// Fallback questions if AI completely fails
const getHardcodedQuestions = () => {
  return [
    {
      question: 'What planet is closest to the sun?',
      options: ['Venus', 'Mercury', 'Mars', 'Earth'],
      correctAnswer: 'Mercury',
      explanation: 'Mercury is the closest planet to the sun.'
    },
    {
      question: 'What is the chemical symbol for water?',
      options: ['H2O', 'CO2', 'O2', 'HO'],
      correctAnswer: 'H2O',
      explanation: 'Water is made of 2 hydrogen and 1 oxygen atom.'
    },
    {
      question: 'How many bones are in the human body?',
      options: ['206', '186', '256', '196'],
      correctAnswer: '206',
      explanation: 'An adult human body has 206 bones.'
    }
  ]
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

module.exports = { startGame }