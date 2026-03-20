export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, model, width, height, token } = req.body;

  if (!prompt || !model || !token) {
    return res.status(400).json({ error: 'prompt, model e token são obrigatórios' });
  }

  try {
    const hfRes = await fetch(
      `https://router.huggingface.co/hf-inference/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: width || 512,
            height: height || 512,
            num_inference_steps: 4,
          },
        }),
      }
    );

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      let parsed = {};
      try { parsed = JSON.parse(errText); } catch (_) {}
      return res.status(hfRes.status).json({
        error: parsed.error || `Erro ${hfRes.status}`,
        status: hfRes.status,
      });
    }

    const blob = await hfRes.arrayBuffer();
    const contentType = hfRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(Buffer.from(blob));

  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
