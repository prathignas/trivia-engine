const pool = require('../db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')


const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // 1. Check fields exist
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // 2. Find user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    const user = result.rows[0]

    // 3. If no user found
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // 4. Compare password with stored hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // 5. Create JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
}

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body

    // 1. Check all fields are provided
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    if(password.length <6){
        return res.status(400).josn({error:'all feilds are required'});
    }

    const hashedPassword = await bcrypt.hash(password, 10);


    const result = await pool.query(
       `Insert into users(username,email,password_hash)
       VALUES($1,$2,$3)
       RETURNING id,username,email,created_at`,
       [username,email,hashedPassword]
    )

    const user = result.rows[0];

    const token=jwt.sign(
      {userId:user.id,username:user.username},
      process.env.JWT_SECRET,
      {expiresIn: '7d' }
    )

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    })

} catch (error) {
 if (error.code === '23505') {
      return res.status(400).json({ error: 'Email or username already exists' })
    }
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
}

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.userId]
    )

    const user = result.rows[0]

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
}

module.exports = { register , login ,getMe}

