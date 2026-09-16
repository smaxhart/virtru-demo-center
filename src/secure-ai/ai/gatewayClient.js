/**
 * Streaming chat client for the Virtru Cloudflare AI Gateway.
 *
 * Auth is handled by WARP at the machine level — there is no API key to configure.
 * The flip side is that the gateway is unreachable without WARP running, which is the
 * single most common reason this demo fails on a fresh machine, so that case gets a
 * named error rather than a raw fetch failure.
 */

const GATEWAY_URL = 'https://developer-ai-gateway.virtru.com/anthropic/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 700

export class GatewayUnreachableError extends Error {
  constructor() {
    super('Could not reach the Virtru AI Gateway. Check that WARP is connected, then retry.')
    this.name = 'GatewayUnreachableError'
  }
}

/**
 * Sends a message to Claude and streams the reply.
 *
 * @param {string} systemPrompt
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {(delta: string) => void} onChunk
 * @returns {Promise<string>} the full response text
 */
export async function streamChat(systemPrompt, messages, onChunk) {
  let res
  try {
    res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'virtru-gateway',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: systemPrompt,
        messages,
      }),
    })
  } catch {
    // fetch only rejects on transport failure, which here means no route to the gateway
    throw new GatewayUnreachableError()
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Gateway rejected the request (${res.status}). WARP may not be authenticated.`)
    }
    throw new Error(`Gateway error ${res.status}: ${detail.slice(0, 300)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Hold the trailing fragment — SSE events split across chunk boundaries
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          full += event.delta.text
          onChunk(event.delta.text)
        }
      } catch {
        // Non-JSON keepalive or comment line — ignore
      }
    }
  }

  return full
}
