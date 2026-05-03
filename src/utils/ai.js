const Groq = require('groq-sdk')

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

const generateQuestions = async (topic, difficulty, amount) => {
  const prompt = `Generate ${amount} trivia questions about "${topic}".
Difficulty: ${difficulty}.

Rules:
- Each question must have exactly 4 options
- Only one correct answer
- Include a short explanation for the correct answer
- Questions must be unique

Respond ONLY with a valid JSON array. No extra text. No markdown. Just the array.

Format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Short explanation why this is correct."
  }
]`

  const response = await groq.chat.completions.create({
model: "llama-3.3-70b-versatile",
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  })

  const raw = response.choices[0].message.content.trim()
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const questions = JSON.parse(cleaned)

  return questions
}

const generateHintStream = async (question, options, res) => {
  const prompt = `A student is stuck on this trivia question:

Question: "${question}"
Options: ${options.join(', ')}

Give a helpful hint in 2-3 sentences. Do not reveal the answer directly. Guide their thinking.`

  const stream = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    stream: true
  })

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Stream each chunk to client as it arrives
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || ''
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`)
    }
  }

  // Signal stream is done
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  res.end()
}

module.exports = { generateQuestions, generateHintStream }