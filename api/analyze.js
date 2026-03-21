import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const PHOTO_TYPES = [
  { id: 1, name: 'Hero shot',             desc: 'produto centralizado, fundo branco limpo, iluminação de estúdio profissional' },
  { id: 2, name: 'Benefício principal',   desc: 'destaque visual do maior benefício do produto, elemento gráfico clean' },
  { id: 3, name: 'Como usar',             desc: 'sequência visual de uso, mãos segurando o produto, sem rosto' },
  { id: 4, name: 'Tamanho e quantidade',  desc: 'destaque da quantidade de unidades e dimensões físicas do produto' },
  { id: 5, name: 'Cenário casual',        desc: 'ambiente cotidiano doméstico, produto em uso natural, sem rosto' },
  { id: 6, name: 'Cenário elegante',      desc: 'mesa posta sofisticada, ambiente premium, produto em destaque' },
  { id: 7, name: 'Especificações',        desc: 'infográfico com dados técnicos: quantidade, tamanho, material, diferenciais' },
  { id: 8, name: 'Destaque competitivo',  desc: 'comparativo visual mostrando vantagem sobre alternativa genérica' },
  { id: 9, name: 'CTA',                   desc: 'produto em destaque com chamada para ação, fundo colorido vibrante' },
];

function loadRules() {
  try {
    const rulesPath = path.join(process.cwd(), 'data', 'rules.md');
    return fs.readFileSync(rulesPath, 'utf-8');
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType, productName } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Imagem obrigatória' });

  const rules = loadRules();

  const systemPrompt = `Você é um especialista em criação de imagens para marketplace brasileiro.
Analise a foto do produto enviada e gere 9 prompts em inglês (para modelo de imagem FLUX), um para cada tipo de foto de marketplace.

REGRAS ABSOLUTAS (inclua em todos os prompts):
- Use EXATAMENTE o produto da imagem de referência, sem alterar cor, forma, proporção ou embalagem
- Não invente informações ou elementos que não existem no produto
- Não mostre rostos de pessoas
- 1200x1200px, estilo profissional de e-commerce
- Texto em português brasileiro nos elementos gráficos

REGRAS APRENDIDAS COM ERROS ANTERIORES:
${rules}

Produto: ${productName || 'conforme imagem'}

Responda APENAS com JSON válido neste formato exato:
{
  "productDescription": "descrição objetiva do produto identificado na imagem",
  "prompts": [
    { "id": 1, "name": "Hero shot", "prompt": "..." },
    { "id": 2, "name": "Benefício principal", "prompt": "..." },
    { "id": 3, "name": "Como usar", "prompt": "..." },
    { "id": 4, "name": "Tamanho e quantidade", "prompt": "..." },
    { "id": 5, "name": "Cenário casual", "prompt": "..." },
    { "id": 6, "name": "Cenário elegante", "prompt": "..." },
    { "id": 7, "name": "Especificações", "prompt": "..." },
    { "id": 8, "name": "Destaque competitivo", "prompt": "..." },
    { "id": 9, "name": "CTA", "prompt": "..." }
  ]
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
              { text: systemPrompt }
            ]
          }],
          generationConfig: { temperature: 0.3 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', response.status, errText);
      return res.status(500).json({ error: `Gemini retornou erro ${response.status}`, detail: errText.slice(0, 200) });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.status(200).json(parsed);
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: 'Erro ao analisar produto', detail: err.message });
  }
}
