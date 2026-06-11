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

  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`\n  World Cup Dashboard`)
  console.log(`  http://localhost:${PORT}\n`)
})
