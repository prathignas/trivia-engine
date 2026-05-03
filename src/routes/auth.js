const express = require('express')
const router = express.Router()
const { register,login ,getMe} = require('../controllers/authController')
const authMiddleware = require('../middleware/auth')

// Public routes — no token needed
router.post('/register', register)
router.post('/login', login)

// Protected route — token required
router.get('/me', authMiddleware, getMe)

module.exports = router