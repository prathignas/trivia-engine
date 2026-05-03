const Redis = require('ioredis')

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
})

redis.on('connect', () => console.log('✅ Connected to Redis'))
redis.on('error', (err) => console.error('❌ Redis error:', err.message))

module.exports = redis