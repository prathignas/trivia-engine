const { Queue } = require('bullmq')
const redis = require('../db/redis')

const questionQueue = new Queue('question-generation', {
  connection: redis
})

// Add a job to generate questions
const scheduleQuestionGeneration = async (topic, difficulty, amount = 10) => {
  await questionQueue.add('generate', { topic, difficulty, amount })
  console.log(`📋 Job added: generate ${amount} ${difficulty} questions for ${topic}`)
}

// Pull questions from Redis pool for a game
const getQuestionsFromPool = async (topic, difficulty, amount) => {
  const key = `questions:${topic}:${difficulty}`
  const data = await redis.get(key)

  if (!data) return null

  const pool = JSON.parse(data)

  if (pool.length < amount) return null

  // Take questions from the front of the pool
  const questions = pool.splice(0, amount)

  // Save remaining questions back to Redis
  await redis.set(key, JSON.stringify(pool))

  // If pool is running low schedule more generation
  if (pool.length < 10) {
    await scheduleQuestionGeneration(topic, difficulty, 20)
    console.log(`⚠️ Pool low for ${topic}:${difficulty} — scheduled refill`)
  }

  return questions
}

module.exports = { questionQueue, scheduleQuestionGeneration, getQuestionsFromPool }