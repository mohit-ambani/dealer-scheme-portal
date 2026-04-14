/**
 * Shared AI helper — wraps OpenAI (primary) / Anthropic (fallback) calls.
 */

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ text: string; model: string }> {
  const temp = options?.temperature ?? 0;
  const maxTokens = options?.maxTokens ?? 4096;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (openaiKey && openaiKey !== 'your-openai-api-key-here') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o', max_tokens: maxTokens, temperature: temp,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { text: data.choices?.[0]?.message?.content || '', model: 'gpt-4o' };
    }
    const err = await res.text();
    console.error('OpenAI error:', err);
  }

  if (anthropicKey && anthropicKey !== 'your-anthropic-api-key-here') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, temperature: temp,
        system: systemPrompt, messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { text: data.content?.[0]?.text || '', model: 'claude-sonnet' };
    }
  }

  throw new Error('No AI API key configured');
}

export function extractJSON(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}
