const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  try {
    // 1. Get token from header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    // 2. Extract just the token part
    const token = authHeader.split(' ')[1]

    // 3. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 4. Attach user info to request
    req.user = decoded

    next()

  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = authMiddleware