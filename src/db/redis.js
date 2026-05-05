const Redis = require('ioredis')

const redis = new Redis(process.env.REDIS_URL, {
  tls: {
    rejectUnauthorized: false
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    if (times > 3) return null
    return Math.min(times * 200, 1000)
  },
  reconnectOnError(err) {
    return err.message.includes('ECONNRESET')
  }
})

redis.on('connect', () => console.log('✅ Connected to Redis'))
redis.on('error', (err) => {
  if (!err.message.includes('ECONNRESET')) {
    console.error('❌ Redis error:', err.message)
  }
})

module.exports = redis