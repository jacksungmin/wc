// World Cup Dashboard - standalone Node.js server
// No npm install needed — uses only built-in Node.js modules
// Run: node server.cjs
// Access: http://localhost:3000

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3000
const DIST_DIR = path.join(__dirname, 'dist')
// Set METRO_API_KEY as an environment variable before running
const METRO_API_KEY = process.env.METRO_API_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.webp': 'image/webp',
}

const PROXY_RULES = [
  {
    prefix: '/weather-api/',
    base:   'https://api.weather.gov/',
    headers: {
      'User-Agent': 'WorldCupDashboard/1.0 (jacksungmin@gmail.com)',
      'Accept': 'application/geo+json',
    },
  },
  {
    prefix: '/metro-api/',
    base:   'https://api.ridemetro.org/GtfsRealtime/',
    headers: { 'Ocp-Apim-Subscription-Key': METRO_API_KEY },
  },
  {
    prefix: '/metro-static/google_transit.zip',
    fixed:  'https://metro.resourcespace.com/pages/download.php?ref=4835&ext=zip',
    headers: {},
  },
  {
    prefix: '/transtar-api/',
    base:   'https://traffic.houstontranstar.org/api/',
    headers: { 'Referer': 'https://traffic.houstontranstar.org/' },
  },
  {
    prefix: '/transtar-cams/',
    base:   'https://traffic.houstontranstar.org/layers/cameras/images/',
    headers: { 'Referer': 'https://traffic.houstontranstar.org/' },
  },
  {
    prefix: '/inrix-uas/',
    base:   'https://uas-api.inrix.com/',
    headers: {},
  },
  {
    prefix: '/inrix-api/',
    base:   'https://api.inrix.com/',
    headers: {},
  },
  {
    prefix: '/inrix-incident-api/',
    base:   'https://incident-api.inrix.com/',
    headers: {},
  },
  {
    prefix: '/inrix-segment-api/',
    base:   'https://segment-api.inrix.com/',
    headers: {},
  },
]

function proxy(req, res, rule) {
  const suffix  = req.url.slice(rule.prefix.length)
  const target  = rule.fixed ? rule.fixed : rule.base + suffix
  let parsed
  try { parsed = new URL(target) } catch { res.writeHead(400); res.end('Bad proxy URL'); return }

  const options = {
    hostname: parsed.hostname,
    port:     443,
    path:     parsed.pathname + parsed.search,
    method:   req.method,
    headers:  { ...rule.headers },
  }

  const upstream = https.request(options, (uRes) => {
    const ct = uRes.headers['content-type'] || 'application/octet-stream'
    res.writeHead(uRes.statusCode, {
      'Content-Type': ct,
      'Access-Control-Allow-Origin': '*',
    })
    uRes.pipe(res)
  })

  upstream.on('error', (err) => {
    console.error('[proxy]', err.message)
    if (!res.headersSent) { res.writeHead(502); res.end('Upstream error') }
  })

  req.pipe(upstream)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1_000_000) {
        req.destroy()
        reject(new Error('Request body too large'))
      }
    })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch (err) { reject(err) }
    })
    req.on('error', reject)
  })
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === 'string') return data.output_text
  const parts = []
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('\n').trim()
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

function openAiErrorMessage(status, data) {
  const message = data?.error?.message || data?.message
  if (typeof message === 'string' && message.trim()) return `OpenAI ${status}: ${message}`
  return `OpenAI request failed with status ${status}.`
}

async function handleAiAssistant(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }
  if (!OPENAI_API_KEY) {
    sendJson(res, 501, { error: 'OPENAI_API_KEY is not configured.' })
    return
  }

  let payload
  try {
    payload = await readJson(req)
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const question = String(payload.question || '').trim()
  if (!question) {
    sendJson(res, 400, { error: 'Question is required' })
    return
  }

  const systemPrompt = [
    'You are the World Cup 2026 Houston mobility dashboard assistant.',
    'Use only the dashboard context provided by the app.',
    'The dashboard context includes live sections for dataStatus, selections, weather, alerts, traffic, transit, cameras, map extent, and nextMatch. Inspect the relevant section before saying data is unavailable.',
    'Give concise operational briefings for transportation staff.',
    'For a traffic summary, use this format with no intro paragraph: Overall: one sentence. Watch: 2 to 4 bullets, highest operational risk first. Next: one sentence with the most useful next action or monitoring focus.',
    'Prioritize current map-view traffic, TranStar lane closures, flood risks, weather alerts, METRO status, and next NRG match timing.',
    'For METRO bus delay questions, use transit.busToNrg delayedTrips, maxDelayMinutes, and nextTrips. A delayMinutes value of 0 means on time; null means scheduled/unknown.',
    'For highway delay or speed-segment questions, use traffic.inrixSegments when records exist. If INRIX segment records lack readable road names or geometry, say INRIX speed records are available but use traffic.corridors delayMin, avgSpeed, slowSegments, and segmentDetails for named highway summaries. Do not say speed data is unavailable when TranStar corridor data is present.',
    'Mention at most 3 specific roads/incidents unless asked for details.',
    'If data is missing, say it is not available in the dashboard context.',
    'Do not invent incident locations, routes, closures, or recommendations.',
    'Keep answers under 110 words unless the user explicitly asks for more.',
  ].join(' ')

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: systemPrompt,
        input: `Question: ${question}\n\nDashboard context:\n${JSON.stringify(payload.context || {}, null, 2)}`,
        reasoning: { effort: 'low' },
        text: { verbosity: 'low' },
        max_output_tokens: 300,
      }),
    })
    const data = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      console.error('[ai-assistant] OpenAI error', upstream.status, data)
      const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502
      sendJson(res, status, { error: openAiErrorMessage(upstream.status, data) })
      return
    }
    sendJson(res, 200, { answer: extractOpenAiText(data) || 'No answer returned.' })
  } catch (err) {
    console.error('[ai-assistant]', err.message)
    sendJson(res, 502, { error: 'Assistant request failed.' })
  }
}

function serveStatic(req, res) {
  // Strip query string for file lookup
  const pathname = req.url.split('?')[0]
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname)

  // SPA fallback
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return }
    const ext = path.extname(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(data)
  })
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    })
    res.end()
    return
  }

  const rule = PROXY_RULES.find(r => req.url === r.prefix.replace(/\/$/, '') || req.url.startsWith(r.prefix))
  if (rule) { proxy(req, res, rule); return }
  if (req.url.split('?')[0] === '/ai-assistant') { handleAiAssistant(req, res); return }

  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`\n  World Cup Dashboard`)
  console.log(`  http://localhost:${PORT}\n`)
})
