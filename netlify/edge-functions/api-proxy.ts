// Netlify Edge Function — proxies all external API calls server-side
// so API keys and custom headers are never exposed to the browser.

// Set METRO_API_KEY in Netlify → Site configuration → Environment variables
const METRO_KEY = Deno.env.get('METRO_API_KEY') ?? ''

interface Route {
  base?: string
  fixed?: string
  headers?: Record<string, string>
}

const ROUTES: Record<string, Route> = {
  '/weather-api/': {
    base: 'https://api.weather.gov/',
    headers: {
      'User-Agent': 'WorldCupDashboard/1.0 (jacksungmin@gmail.com)',
      'Accept': 'application/geo+json',
    },
  },
  // Client fetches /metro-api/GtfsRealtime/TripUpdates
  // suffix = GtfsRealtime/TripUpdates → base must NOT include GtfsRealtime
  '/metro-api/': {
    base: 'https://api.ridemetro.org/',
    headers: { 'Ocp-Apim-Subscription-Key': METRO_KEY },
  },
  '/metro-static/google_transit.zip': {
    fixed: 'https://metro.resourcespace.com/pages/download.php?ref=4835&ext=zip',
  },
  '/transtar-cams/': {
    base: 'https://traffic.houstontranstar.org/layers/cameras/images/',
    headers: { 'Referer': 'https://traffic.houstontranstar.org/' },
  },
  '/inrix-uas/':           { base: 'https://uas-api.inrix.com/' },
  '/inrix-api/':           { base: 'https://api.inrix.com/' },
  '/inrix-incident-api/':  { base: 'https://incident-api.inrix.com/' },
  '/inrix-segment-api/':   { base: 'https://segment-api.inrix.com/' },
}

export default async (request: Request): Promise<Response> => {
  const { pathname, search } = new URL(request.url)

  const routeKey = Object.keys(ROUTES).find(k =>
    pathname === k.replace(/\/$/, '') || pathname.startsWith(k)
  )
  if (!routeKey) return new Response('Route not found', { status: 404 })

  const route = ROUTES[routeKey]
  const targetUrl = route.fixed
    ? route.fixed
    : (route.base ?? '') + pathname.slice(routeKey.length) + search

  // Forward Authorization from client (INRIX uses Bearer token per-request)
  const forwarded: Record<string, string> = {}
  const auth = request.headers.get('Authorization')
  if (auth) forwarded['Authorization'] = auth

  // Route-specific headers override forwarded ones
  const headers = { ...forwarded, ...(route.headers ?? {}) }

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
    ...(request.method !== 'GET' && request.method !== 'HEAD'
      ? { body: request.body }
      : {}),
  }

  // Retry once on network failure — handles Deno cold-start on first deploy
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(targetUrl, fetchOptions)
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (err) {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 300))
        continue
      }
      console.error('[api-proxy] upstream error:', targetUrl, err)
      return new Response('Upstream request failed', { status: 502 })
    }
  }

  return new Response('Upstream request failed', { status: 502 })
}
