import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

const GEMINI_KEY = process.env.GEMINI_API_KEY;

function loadRules() {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'data', 'rules.md'), 'utf-8');
  } catch { return ''; }
}

function saveRules(content) {
  fs.writeFileSync(path.join(process.cwd(), 'data', 'rules.md'), content, 'utf-8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { originalBase64, generatedBase64, originalMime, generatedMime, errorDescription, photoName } = req.body;

  const prompt = `Você é um auditor de qualidade de imagens para marketplace.

Compare as duas imagens enviadas:
- Imagem 1: foto ORIGINAL do produto (referência)
- Imagem 2: foto GERADA pela IA para a posição "${photoName || 'desconhecida'}"

Descrição do erro relatado pelo usuário: "${errorDescription || 'não especificado'}"

Analise tecnicamente o que está errado na imagem gerada comparando com o original.

Responda APENAS com JSON válido:
{
  "errosDetectados": ["lista de erros específicos encontrados"],
  "regrasNovas": ["lista de regras em inglês para adicionar ao prompt e evitar esses erros"],
  "severidade": "leve | moderado | grave",
  "resumo": "resumo em português do que errou"
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
              { inline_data: { mime_type: originalMime || 'image/jpeg', data: originalBase64 } },
              { inline_data: { mime_type: generatedMime || 'image/jpeg', data: generatedBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Atualiza o rules.md com as novas regras
    if (parsed.regrasNovas?.length > 0) {
      let rules = loadRules();
      const timestamp = new Date().toLocaleDateString('pt-BR');
      const newRules = parsed.regrasNovas.map(r => `- ${r}`).join('\n');
      const entry = `\n### ${timestamp} — ${photoName} (${parsed.severidade})\n**Erro:** ${parsed.resumo}\n**Regras adicionadas:**\n${newRules}\n`;
      rules = rules + entry;
      saveRules(rules);
    }

    res.status(200).json({ ...parsed, rulesUpdated: parsed.regrasNovas?.length > 0 });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Erro ao processar feedback', detail: err.message });
  }
}
