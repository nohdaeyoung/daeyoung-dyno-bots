const https = require('https')

const TOKENS = {
  economy: process.env.BOT_DYNO_ECONOMY_TOKEN,
  philosophy: process.env.BOT_DYNO_PHILOSOPHY_TOKEN,
  writing: process.env.BOT_DYNO_WRITING_TOKEN,
  photo: process.env.BOT_DYNO_PHOTO_TOKEN,
  notifications: process.env.BOT_DYNO_NOTIFICATIONS_TOKEN,
  dev: process.env.BOT_DYNO_DEV_TOKEN
}

function sendMessage(token, chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text })
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

module.exports = async (req, res) => {
  const { topic } = req.query
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = req.body || {}
    const chatId = body.message?.chat?.id || body.callback_query?.message?.chat?.id
    const text = body.message?.text || body.callback_query?.data || ''

    console.log(`[${topic}] chatId=${chatId} text=${text}`)

    if (text && text.toLowerCase().startsWith('ping')) {
      const token = TOKENS[topic]
      if (token && chatId) {
        await sendMessage(token, chatId, `pong (${topic}) 🤖`)
      }
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
