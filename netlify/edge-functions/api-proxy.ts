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
  '/metro-api/': {
    base: 'https://api.ridemetro.org/GtfsRealtime/',
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

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: route.headers ?? {},
    ...(request.method !== 'GET' && request.method !== 'HEAD'
      ? { body: request.body }
      : {}),
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
