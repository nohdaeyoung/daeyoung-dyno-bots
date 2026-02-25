const https = require('https')

const TOKENS = {
  economy: process.env.BOT_DYNO_ECONOMY_TOKEN,
  philosophy: process.env.BOT_DYNO_PHILOSOPHY_TOKEN,
  writing: process.env.BOT_DYNO_WRITING_TOKEN,
  photo: process.env.BOT_DYNO_PHOTO_TOKEN,
  notifications: process.env.BOT_DYNO_NOTIFICATIONS_TOKEN,
  dev: process.env.BOT_DYNO_DEV_TOKEN
}

const SYSTEM_PROMPTS = {
  economy: '당신은 경제·금융 전문 AI입니다. 주식, ETF, 경제 뉴스, 투자 전략 등에 대해 명확하고 실용적으로 답변합니다. 한국어로 대화합니다.',
  philosophy: '당신은 철학 전문 AI입니다. 동서양 철학, 윤리학, 존재론, 인식론 등 깊은 사유를 돕습니다. 한국어로 대화합니다.',
  writing: '당신은 글쓰기 전문 AI입니다. 에세이, 소설, 시, 카피라이팅 등 다양한 글쓰기를 도와줍니다. 한국어로 대화합니다.',
  photo: '당신은 사진·시각예술 전문 AI입니다. 촬영 기법, 구도, 조명, 후보정, 포트폴리오 구성 등을 조언합니다. 한국어로 대화합니다.',
  notifications: '당신은 알림·일정 관리 AI입니다. 할 일, 일정, 리마인더를 관리하고 정리하는 데 도움을 줍니다. 한국어로 대화합니다.',
  dev: '당신은 개발 전문 AI입니다. 코드 작성, 디버깅, 아키텍처 설계, 기술 스택 선택 등을 도와줍니다. 한국어로 대화합니다.'
}

function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body)
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

async function askClaude(topic, userText) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const response = await httpsPost(
    'api.anthropic.com',
    '/v1/messages',
    {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPTS[topic] || '당신은 친절한 AI 어시스턴트입니다. 한국어로 대화합니다.',
      messages: [{ role: 'user', content: userText }]
    },
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  )

  return response.content?.[0]?.text || '응답을 생성할 수 없습니다.'
}

async function sendTelegram(token, chatId, text) {
  return httpsPost('api.telegram.org', `/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown'
  }, {})
}

module.exports = async (req, res) => {
  const { topic } = req.query
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = req.body || {}
    const chatId = body.message?.chat?.id || body.callback_query?.message?.chat?.id
    const text = body.message?.text || body.callback_query?.data || ''

    if (!text || !chatId) return res.status(200).json({ ok: true })

    // /start 명령어
    if (text === '/start') {
      const token = TOKENS[topic]
      if (token) {
        const greet = `안녕하세요! 저는 *${topic}* 전문 AI예요 😊\n\n무엇이든 물어보세요!`
        await sendTelegram(token, chatId, greet)
      }
      return res.status(200).json({ ok: true })
    }

    const token = TOKENS[topic]
    if (!token) return res.status(200).json({ ok: true })

    // Claude 응답 생성
    const reply = await askClaude(topic, text)
    await sendTelegram(token, chatId, reply)

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
