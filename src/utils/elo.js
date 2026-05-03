// K factor controls how much ratings change per game
// 32 = new players (less than 30 games)
// 16 = established players (30+ games)
const getKFactor = (gamesPlayed) => {
  return gamesPlayed < 30 ? 32 : 16
}

// Calculate expected score (probability of winning)
const getExpectedScore = (playerElo, opponentElo) => {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
}

// Calculate new ELO for one player
const calculateNewElo = (playerElo, opponentElo, actualScore, gamesPlayed) => {
  const expected = getExpectedScore(playerElo, opponentElo)
  const k = getKFactor(gamesPlayed)
  const newElo = Math.round(playerElo + k * (actualScore - expected))

  // Never go below 100
  return Math.max(100, newElo)
}

// Calculate ELO changes for all players after a match
// players = [{ userId, username, score, elo, gamesPlayed }]
// Returns same array with eloChange added to each player
const calculateMatchElo = (players) => {
  const results = players.map(player => ({ ...player, eloChange: 0 }))

  // Compare each player against every other player
  for (let i = 0; i < results.length; i++) {
    for (let j = 0; j < results.length; j++) {
      if (i === j) continue

      const playerA = results[i]
      const playerB = results[j]

      // Actual score: 1 = win, 0.5 = draw, 0 = loss
      let actualScore
      if (playerA.score > playerB.score) actualScore = 1
      else if (playerA.score === playerB.score) actualScore = 0.5
      else actualScore = 0

      const newElo = calculateNewElo(
        playerA.elo,
        playerB.elo,
        actualScore,
        playerA.gamesPlayed
      )

      results[i].eloChange += newElo - playerA.elo
    }
  }

  // Apply total ELO change to each player
  results.forEach(p => {
    p.newElo = Math.max(100, p.elo + p.eloChange)
  })

  return results
}

module.exports = { calculateMatchElo }