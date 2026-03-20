export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, aspect_ratio, google_key } = req.body;
  if (!prompt || !google_key) return res.status(400).json({ error: 'prompt e google_key obrigatorios' });

  const models = [
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${google_key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio: aspect_ratio || '1:1' }
          }),
        }
      );

      if (r.status === 429) {
        lastError = `${model}: limite diário atingido`;
        continue;
      }

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        lastError = `${model}: ${e.error?.message || 'Erro ' + r.status}`;
        continue;
      }

      const data = await r.json();
      const b64  = data.predictions?.[0]?.bytesBase64Encoded;
      const mime = data.predictions?.[0]?.mimeType || 'image/png';

      if (!b64) { lastError = `${model}: sem imagem na resposta`; continue; }

      res.setHeader('Content-Type', mime);
      res.setHeader('X-Provider-Used', model);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(Buffer.from(b64, 'base64'));

    } catch (err) {
      lastError = `${model}: ${err.message}`;
      continue;
    }
  }

  return res.status(503).json({ error: lastError || 'Todos os modelos Imagen falharam' });
}
