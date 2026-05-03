const { Worker } = require('bullmq')
const redis = require('../db/redis')
const { generateQuestions } = require('../utils/ai')

const worker = new Worker(
  'question-generation',
  async (job) => {
    const { topic, difficulty, amount } = job.data

    console.log(`🤖 Generating ${amount} questions for topic: ${topic}, difficulty: ${difficulty}`)

    // Call AI to generate questions
    const questions = await generateQuestions(topic, difficulty, amount)

    // Store in Redis with a key based on topic and difficulty
    const key = `questions:${topic}:${difficulty}`

    // Get existing questions from Redis
    const existing = await redis.get(key)
    const existingQuestions = existing ? JSON.parse(existing) : []

    // Add new questions to the pool
    const updatedPool = [...existingQuestions, ...questions]
    await redis.set(key, JSON.stringify(updatedPool))

    console.log(`✅ Stored ${questions.length} questions. Pool size: ${updatedPool.length}`)

    return { topic, difficulty, count: questions.length }
  },
  {
    connection: redis
  }
)

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`)
})

worker.on('failed', (job, error) => {
  console.error(`❌ Job ${job.id} failed:`, error.message)
})

module.exports = worker