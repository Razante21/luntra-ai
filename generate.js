const HF_TOKEN = process.env.HF_TOKEN;
const MODEL = 'black-forest-labs/FLUX.1-schnell';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, photoId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

  try {
    const response = await fetch(
      `https://router.huggingface.co/hf-inference/models/${MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { width: 1024, height: 1024, num_inference_steps: 4 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'Erro no FLUX', detail: err });
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    res.status(200).json({ imageBase64: base64, photoId });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Erro ao gerar imagem', detail: err.message });
  }
}
