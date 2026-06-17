import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import https from 'node:https'

function readJson(req: IncomingMessage): Promise<{ question?: string; context?: unknown }> {
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
      try {
        resolve(JSON.parse(body || '{}') as { question?: string; context?: unknown })
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function extractOpenAiText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  if ('output_text' in data && typeof data.output_text === 'string') return data.output_text
  if (!('output' in data) || !Array.isArray(data.output)) return ''

  const parts: string[] = []
  for (const item of data.output) {
    const itemRecord = item as { content?: unknown }
    if (!Array.isArray(itemRecord.content)) continue
    for (const content of itemRecord.content) {
      const contentRecord = content as { text?: unknown }
      if (typeof contentRecord.text === 'string') parts.push(contentRecord.text)
    }
  }
  return parts.join('\n').trim()
}

function aiAssistantPlugin(apiKey?: string, model = 'gpt-5.5'): Plugin {
  return {
    name: 'ai-assistant-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/ai-assistant', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' })
          return
        }
        if (!apiKey) {
          sendJson(res, 501, { error: 'OPENAI_API_KEY is not configured in .env.' })
          return
        }

        let payload: { question?: string; context?: unknown }
        try {
          payload = await readJson(req)
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON body' })
          return
        }

        const question = payload.question?.trim()
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
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              input: [
                { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
                {
                  role: 'user',
                  content: [{
                    type: 'input_text',
                    text: `Question: ${question}\n\nDashboard context:\n${JSON.stringify(payload.context ?? {}, null, 2)}`,
                  }],
                },
              ],
              max_output_tokens: 300,
            }),
          })
          const data = await upstream.json().catch(() => null)
          if (!upstream.ok) {
            console.error('[ai-assistant] OpenAI error', upstream.status, data)
            sendJson(res, 502, { error: 'OpenAI request failed.' })
            return
          }
          sendJson(res, 200, { answer: extractOpenAiText(data) || 'No answer returned.' })
        } catch (error) {
          console.error('[ai-assistant]', error)
          sendJson(res, 502, { error: 'Assistant request failed.' })
        }
      })
    },
  }
}

function metroGtfsPlugin(apiKey?: string): Plugin {
  return {
    name: 'metro-gtfs-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/metro-api/GtfsRealtime/', async (req: IncomingMessage, res: ServerResponse) => {
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'text/plain')
          res.end('METRO_GTFS_REALTIME_KEY is not configured')
          return
        }

        const feed = req.url?.replace(/^\/+/, '') || 'TripUpdates'
        if (!['TripUpdates', 'VehiclePositions'].includes(feed)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain')
          res.end('Unsupported METRO realtime feed')
          return
        }

        try {
          await new Promise<void>((resolve, reject) => {
            const req = https.get(
              {
                hostname: 'api.ridemetro.org',
                path: `/GtfsRealtime/${feed}`,
                headers: { 'Ocp-Apim-Subscription-Key': apiKey },
                rejectUnauthorized: false,
              },
              (upstream) => {
                const chunks: Buffer[] = []
                upstream.on('data', (chunk: Buffer) => chunks.push(chunk))
                upstream.on('end', () => {
                  const body = Buffer.concat(chunks)
                  res.statusCode = upstream.statusCode ?? 200
                  res.setHeader('Content-Type', upstream.headers['content-type'] ?? 'application/x-google-protobuf')
                  res.setHeader('Cache-Control', 'no-store')
                  res.end(body)
                  resolve()
                })
                upstream.on('error', reject)
              }
            )
            req.on('error', reject)
          })
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'text/plain')
          res.end(error instanceof Error ? error.message : 'METRO upstream request failed')
        }
      })

      server.middlewares.use('/metro-static/google_transit.zip', async (_req: IncomingMessage, res: ServerResponse) => {
        try {
          const upstream = await fetch('https://metro.resourcespace.com/pages/download.php?ref=4835&ext=zip')
          const body = Buffer.from(await upstream.arrayBuffer())
          res.statusCode = upstream.status
          res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/zip')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          res.end(body)
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'text/plain')
          res.end(error instanceof Error ? error.message : 'METRO static GTFS request failed')
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const metroGtfsRealtimeKey = env.METRO_GTFS_REALTIME_KEY
  const openAiApiKey = env.OPENAI_API_KEY
  const openAiModel = env.OPENAI_MODEL || 'gpt-5.5'

  return {
    plugins: [react(), tailwindcss(), metroGtfsPlugin(metroGtfsRealtimeKey), aiAssistantPlugin(openAiApiKey, openAiModel)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: {
      // INRIX UAS token endpoint
      '/inrix-uas': {
        target: 'https://uas-api.inrix.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/inrix-uas/, ''),
      },
      // INRIX Traffic API (incidents, segment speeds, tiles)
      '/inrix-api': {
        target: 'https://api.inrix.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/inrix-api/, ''),
      },
      '/inrix-incident-api': {
        target: 'https://incident-api.inrix.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/inrix-incident-api/, ''),
      },
      '/inrix-segment-api': {
        target: 'https://segment-api.inrix.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/inrix-segment-api/, ''),
      },
      // TranStar CCTV snapshots
      '/transtar-cams': {
        target: 'https://traffic.houstontranstar.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/transtar-cams/, '/layers/cameras/images'),
        headers: {
          Referer: 'https://traffic.houstontranstar.org/',
          Origin: 'https://traffic.houstontranstar.org',
        },
      },
      '/transtar-api': {
        target: 'https://traffic.houstontranstar.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/transtar-api/, '/api'),
        headers: {
          Referer: 'https://traffic.houstontranstar.org/',
        },
      },
      // NWS weather API — requires User-Agent; CORS blocks direct browser requests
      '/weather-api': {
        target: 'https://api.weather.gov',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/weather-api/, ''),
        headers: {
          'User-Agent': 'WorldCupDashboard/1.0 (jacksungmin@gmail.com)',
          Accept: 'application/geo+json',
        },
      },
      },
    },
  }
})
