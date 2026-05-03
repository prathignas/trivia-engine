const { Queue } = require('bullmq')
const redis = require('../db/redis')

const questionQueue = new Queue('question-generation', {
  connection: redis
})

module.exports = questionQueue