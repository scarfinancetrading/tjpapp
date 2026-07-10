import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY no configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const imageDataUrl: string | undefined = body?.imageDataUrl;
    const accountSize: number | null =
      typeof body?.accountSize === 'number' && Number.isFinite(body.accountSize) && body.accountSize > 0
        ? body.accountSize
        : null;

    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: 'imageDataUrl inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Formato de imagen no soportado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const mimeType = match[1];
    const base64Data = match[2];

    const today = new Date();
    const todayStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

    const systemPrompt = `Eres un analista de trading experto. Analiza esta captura de MetaTrader 5 y devuelve EXCLUSIVAMENTE un JSON válido (sin markdown, sin texto adicional) con esta forma exacta:
{
  "fecha": "M/d/yyyy",
  "par": "EURUSD",
  "timeframe": "M15",
  "orden": "Buy Limit | Sell Limit | Buy Stop | Sell Stop | Buy | Sell",
  "entrada": "OB 75% | OB 85% | ",
  "entryPrice": 1.08543,
  "slPrice": 1.08393,
  "tpPrice": 1.08843,
  "visibleLevels": { "entryPrice": 1.08543, "slPrice": 1.08393, "tpPrice": 1.08843 },
  "lotSize": 0.10,
  "riskUsd": 240,
  "chartTime": "14:35"
}

REGLAS ESTRICTAS:
- "fecha": si es visible úsala; si no, usa hoy (${todayStr}). SIEMPRE en formato M/d/yyyy.
- "par": ticker sin barras (EURUSD, GBPJPY, XAUUSD…).
- "timeframe": M1, M5, M15, M30, H1, H4, D1, W1, MN.
- "orden": tipo exacto según la etiqueta visible.
- "entrada": "OB 75%" si la entrada coincide con Fibo 75%, "OB 85%" si es 85%, "" si no aplica.
- "entryPrice"/"slPrice"/"tpPrice": lee EXACTAMENTE los precios de las cajas grises del eje derecho alineadas con cada línea horizontal (SL, entrada, TP). NO estimes por distancia visual. NO uses bid/ask actual.
- "visibleLevels": copia los mismos tres precios exactos.
- "lotSize": número al lado del tipo de orden (ej. "SELL LIMIT 5.35" → 5.35). NO lo confundas con un precio.
- "riskUsd": si aparece un valor USD junto al SL (ej. "-$240"), número positivo. Si no es visible, null.
- "chartTime": hora del eje horizontal correspondiente a la vela de entrada ("HH:MM" 24h). null si no se determina.
- Si un campo no puede leerse con certeza: "" para strings, null para números. NO INVENTES.
- Devuelve SOLO el JSON.`;

    const geminiResp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: 'Analiza esta captura de MetaTrader 5 y devuelve el JSON.' },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error('Gemini error', geminiResp.status, errText);
      const status = geminiResp.status === 429 ? 429 : geminiResp.status === 401 || geminiResp.status === 403 ? 401 : 500;
      const msg =
        status === 429
          ? 'Límite de uso de IA alcanzado. Intenta más tarde.'
          : status === 401
            ? 'Credencial de IA inválida.'
            : 'Error al analizar la imagen';
      return new Response(JSON.stringify({ error: msg, details: errText }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiJson = await geminiResp.json();
    const content: string = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
    }

    const toNumber = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value !== 'string') return null;
      const cleaned = value.trim().replace(/,/g, '');
      if (!cleaned) return null;
      const numeric = Number(cleaned);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const pair: string = (parsed.par ?? '').toString().toUpperCase();
    let pipSize = 0.0001;
    if (pair.includes('JPY')) pipSize = 0.01;
    else if (pair.startsWith('XAU') || pair === 'GOLD') pipSize = 0.1;

    const firstNumber = (...values: unknown[]): number | null => {
      for (const value of values) {
        const numeric = toNumber(value);
        if (numeric !== null) return numeric;
      }
      return null;
    };

    const visibleLevels = parsed.visibleLevels && typeof parsed.visibleLevels === 'object' ? parsed.visibleLevels : {};
    const entry = firstNumber(visibleLevels.entryPrice, parsed.entryPrice, parsed.orderPrice);
    const sl = firstNumber(visibleLevels.slPrice, parsed.slPrice, parsed.stopLossPrice);
    const tp = firstNumber(visibleLevels.tpPrice, parsed.tpPrice, parsed.takeProfitPrice);

    const normalizePips = (rawPips: number): number => {
      const oneDecimal = Math.round(rawPips * 10) / 10;
      const nearestWhole = Math.round(rawPips);
      if (Math.abs(oneDecimal - nearestWhole) <= 0.11) return nearestWhole;
      return oneDecimal;
    };

    parsed.entryPrice = entry;
    parsed.slPrice = sl;
    parsed.tpPrice = tp;
    parsed.visibleLevels = { entryPrice: entry, slPrice: sl, tpPrice: tp };

    parsed.slPips = entry !== null && sl !== null ? normalizePips(Math.abs(entry - sl) / pipSize) : null;
    parsed.tpPips = entry !== null && tp !== null ? normalizePips(Math.abs(entry - tp) / pipSize) : null;

    if (typeof parsed.slPips === 'number' && typeof parsed.tpPips === 'number' && parsed.slPips > 0) {
      const ratio = parsed.tpPips / parsed.slPips;
      const rounded = Math.max(0.5, Math.round(ratio * 2) / 2);
      parsed.riskReward = Number.isInteger(rounded) ? `1:${rounded}` : `1:${rounded.toFixed(1)}`;
    }

    const roundHalfPreferInt = (x: number): number => {
      if (x < 0.25) return 0;
      if (x <= 0.37) return 0.25;
      if (x <= 0.74) return 0.5;
      if (x <= 1.25) return 1;
      if (x <= 1.75) return 1.5;
      if (x <= 2.25) return 2;
      const lower = Math.floor(x * 2) / 2;
      const upper = lower + 0.5;
      const dl = x - lower;
      const du = upper - x;
      if (Math.abs(dl - du) < 1e-9) return Number.isInteger(lower) ? lower : upper;
      return dl < du ? lower : upper;
    };

    const pipValuePerLotUsd = (p: string): number => {
      if (!p) return 10;
      const up = p.toUpperCase();
      if (up.startsWith('XAU') || up === 'GOLD') return 10;
      const quote = up.slice(-3);
      switch (quote) {
        case 'USD': return 10;
        case 'JPY': return 6.5;
        case 'AUD': return 6.5;
        case 'CAD': return 7.3;
        case 'NZD': return 5.9;
        case 'CHF': return 11.0;
        case 'GBP': return 12.5;
        case 'EUR': return 10.8;
        default: return 7.5;
      }
    };

    const lotSize = toNumber(parsed.lotSize);
    const riskUsdVisual = toNumber(parsed.riskUsd);
    parsed.lotSize = lotSize;
    parsed.riskUsd = riskUsdVisual;

    let riskUsd: number | null = riskUsdVisual;
    if ((riskUsd === null || riskUsd <= 0) && lotSize && typeof parsed.slPips === 'number') {
      riskUsd = lotSize * pipValuePerLotUsd(pair) * parsed.slPips;
    }
    parsed.riesgoPct = accountSize && riskUsd && riskUsd > 0 ? roundHalfPreferInt((riskUsd / accountSize) * 100) : null;

    const chartTime: string | null =
      typeof parsed.chartTime === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.chartTime) ? parsed.chartTime : null;
    parsed.chartTime = chartTime;
    if (chartTime) {
      const [hh] = chartTime.split(':').map((n) => parseInt(n, 10));
      if (!isNaN(hh)) {
        if (hh >= 13 && hh <= 23) parsed.sesion = 'New York';
        else if (hh >= 0 && hh <= 7) parsed.sesion = 'Asia';
        else if (hh >= 8 && hh <= 12) parsed.sesion = 'Londres';
        else parsed.sesion = null;
      } else parsed.sesion = null;
    } else parsed.sesion = null;

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('analyze-trade-image fatal', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Error desconocido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
