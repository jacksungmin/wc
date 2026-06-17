function envValue(key: string) {
  const value = (globalThis as any).Netlify?.env?.get?.(key)
  return typeof value === 'string' ? value : Deno.env.get(key) ?? ''
}

const OPENAI_API_KEY = envValue('OPENAI_API_KEY')
const OPENAI_MODEL = envValue('OPENAI_MODEL') || 'gpt-5.5'

const SYSTEM_PROMPT = `
You are the World Cup 2026 Houston mobility dashboard assistant.
Use only the dashboard context provided by the app.
The dashboard context includes live sections for dataStatus, selections, weather, alerts, traffic, transit, cameras, map extent, and nextMatch. Inspect the relevant section before saying data is unavailable.
Give concise operational briefings for transportation staff.
For a traffic summary, use this format with no intro paragraph:
Overall: one sentence.
Watch:
- 2 to 4 bullets, highest operational risk first.
Next: one sentence with the most useful next action or monitoring focus.
Prioritize current map-view traffic, TranStar lane closures, flood risks, weather alerts, METRO status, and next NRG match timing.
For METRO bus delay questions, use transit.busToNrg delayedTrips, maxDelayMinutes, and nextTrips. A delayMinutes value of 0 means on time; null means scheduled/unknown.
For highway delay or speed-segment questions, use traffic.inrixSegments when records exist. If INRIX segment records lack readable road names or geometry, say INRIX speed records are available but use traffic.corridors delayMin, avgSpeed, slowSegments, and segmentDetails for named highway summaries. Do not say speed data is unavailable when TranStar corridor data is present.
Mention at most 3 specific roads/incidents unless asked for details.
If data is missing, say it is not available in the dashboard context.
Do not invent incident locations, routes, closures, or recommendations.
Keep answers under 110 words unless the user explicitly asks for more.
`

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function extractText(data: any): string {
  if (typeof data?.output_text === 'string') return data.output_text
  const parts: string[] = []
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('\n').trim()
}

export default async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return json({}, 204)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY is not configured in Netlify environment variables.' }, 501)

  let payload: { question?: string; context?: unknown }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const question = payload.question?.trim()
  if (!question) return json({ error: 'Question is required' }, 400)

  const dashboardContext = JSON.stringify(payload.context ?? {}, null, 2)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
        {
          role: 'user',
          content: [{
            type: 'input_text',
            text: `Question: ${question}\n\nDashboard context:\n${dashboardContext}`,
          }],
        },
      ],
      max_output_tokens: 300,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('[ai-assistant] OpenAI error', response.status, data)
    return json({ error: 'OpenAI request failed.' }, 502)
  }

  const answer = extractText(data)
  return json({ answer: answer || 'No answer returned.' })
}
