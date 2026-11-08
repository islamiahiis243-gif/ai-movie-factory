/**
 * Vercel Serverless Function: /api/ai-generate
 * Server-Side AI Provider Proxy (SSOT Part 7 Sec 17, 18 & Part 8 Sec 20)
 * Keeps GEMINI_API_KEY strictly on the server and never exposes credentials to the browser.
 */

import { GoogleGenAI } from '@google/genai';

export interface AiGenerateRequestBody {
  operation: 'script_outline' | 'character_seed' | 'continuity_audit' | 'shot_prompt';
  prompt: string;
  model?: string;
  systemInstruction?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const body: AiGenerateRequestBody = req.body || {};
  const { operation, prompt, model = 'gemini-2.5-flash', systemInstruction } = body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      error: 'Parameter "prompt" wajib diisi dan harus berupa teks valid.',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(503).json({
      status: 'unconfigured',
      error:
        'GEMINI_API_KEY belum dikonfigurasi pada environment variables server Vercel. Atur di Vercel Dashboard -> Settings -> Environment Variables.',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: prompt.trim(),
      config: systemInstruction
        ? {
            systemInstruction,
          }
        : undefined,
    });

    const text = response.text || '';

    return res.status(200).json({
      status: 'completed',
      operation: operation || 'script_outline',
      provider: 'google_gemini',
      model,
      output: text,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'failed',
      error: err?.message || 'Gagal menjalankan generasi AI di server.',
    });
  }
}
