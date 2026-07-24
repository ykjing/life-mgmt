export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { prompt } = body;
  if (!prompt) {
    return Response.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const geminiResp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
      }),
    }
  );

  if (!geminiResp.ok) {
    const err = await geminiResp.json().catch(() => ({}));
    return Response.json(
      { error: err?.error?.message || `Gemini API error ${geminiResp.status}` },
      { status: 502 }
    );
  }

  const data = await geminiResp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return Response.json({ text });
}
