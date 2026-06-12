import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import https from 'node:https'

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

  return {
    plugins: [react(), tailwindcss(), metroGtfsPlugin(metroGtfsRealtimeKey)],
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
