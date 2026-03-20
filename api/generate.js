export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, aspect_ratio, google_key } = req.body;
  if (!prompt || !google_key) return res.status(400).json({ error: 'prompt e google_key obrigatorios' });

  // Ordem: Gemini 2.5 Flash (grátis 500/dia) → Gemini 2.0 Flash (grátis) → Imagen 4 Fast (pago, centavos)
  const models = [
    { id: 'gemini-2.5-flash-preview-05-20', type: 'gemini' },
    { id: 'gemini-2.0-flash-exp',           type: 'gemini' },
    { id: 'imagen-4.0-fast-generate-001',   type: 'imagen' },
  ];

  let lastError = null;

  for (const model of models) {
    try {
      let r;

      if (model.type === 'gemini') {
        // Gemini gera imagem via generateContent com responseModalities
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${google_key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
            }),
          }
        );
      } else {
        // Imagen via predict
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:predict?key=${google_key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [{ prompt }],
              parameters: { sampleCount: 1, aspectRatio: aspect_ratio || '1:1' }
            }),
          }
        );
      }

      if (r.status === 429) { lastError = `${model.id}: limite atingido`; continue; }
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        lastError = `${model.id}: ${e.error?.message || 'Erro ' + r.status}`;
        continue;
      }

      const data = await r.json();
      let b64 = null, mime = 'image/png';

      if (model.type === 'gemini') {
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find(p => p.inlineData);
        if (!imgPart) { lastError = `${model.id}: sem imagem na resposta`; continue; }
        b64  = imgPart.inlineData.data;
        mime = imgPart.inlineData.mimeType || 'image/png';
      } else {
        b64  = data.predictions?.[0]?.bytesBase64Encoded;
        mime = data.predictions?.[0]?.mimeType || 'image/png';
      }

      if (!b64) { lastError = `${model.id}: sem imagem`; continue; }

      res.setHeader('Content-Type', mime);
      res.setHeader('X-Provider-Used', model.id);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(Buffer.from(b64, 'base64'));

    } catch (err) {
      lastError = `${model.id}: ${err.message}`;
      continue;
    }
  }

  return res.status(503).json({ error: lastError || 'Todos os modelos falharam' });
}
