/**
 * Streaming chat client via the Virtru Cloudflare AI Gateway.
 * Auth is handled by WARP at the machine level — no API key needed.
 */

const GATEWAY_URL = 'https://developer-ai-gateway.virtru.com/anthropic/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

/**
 * Send a message to Claude and stream the response.
 *
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {function(string): void} onChunk  - called with each text delta
 * @returns {Promise<string>} full response text
 */
export async function streamChat(systemPrompt, messages, onChunk) {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': 'virtru-gateway',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gateway error ${res.status}: ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          full += event.delta.text
          onChunk(event.delta.text)
        }
      } catch {}
    }
  }

  return full
}
