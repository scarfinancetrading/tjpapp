import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Acepta cualquier formato de clave de Google AI Studio ("AIza..." o "AQ....")
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY no configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const text: string | undefined = body?.text;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Texto vacío' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date();
    const todayStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

    const systemPrompt = `Eres el copiloto de un diario de trading. El usuario describe una operación (trade) en español, hablado o escrito de forma natural. Extrae los datos y devuelve EXCLUSIVAMENTE un JSON válido (sin markdown, sin texto adicional) con esta forma exacta:
{
  "fecha": "M/d/yyyy",
  "par": "EURUSD",
  "sesion": "Londres | New York | Asia | ",
  "estrategia": "Silver Bullet",
  "entrada": "Order Block al 75%",
  "orden": "Buy | Sell | Buy Limit | Sell Limit | Buy Stop | Sell Stop | ",
  "riskReward": "1:2",
  "riesgo": "1.00",
  "stopLoss": "15.0",
  "lotaje": "0.10",
  "resultado": "-50.00",
  "salidaOperacion": "Take Profit | Stop Loss | Break Even | Parciales | Cierre Manual | "
}

REGLAS ESTRICTAS:
- "fecha": si el usuario menciona una fecha úsala; si dice "hoy" o no menciona nada, usa ${todayStr}. SIEMPRE formato M/d/yyyy.
- "par": ticker en mayúsculas sin barras (EURUSD, GBPJPY, XAUUSD, US30…). "oro" = XAUUSD, "euro dólar" = EURUSD, "libra yen" = GBPJPY, etc.
- "sesion": una de "Londres", "New York", "Asia". "NY"/"Nueva York" → "New York". "" si no se menciona.
- "estrategia": nombre de la estrategia o concepto (Silver Bullet, SMC, ICT, etc.). "" si no se menciona.
- "entrada": detalle técnico del punto de entrada (Order Block al 75%, FVG, etc.). "" si no se menciona.
- "orden": "compra"/"long" → "Buy", "venta"/"short" → "Sell"; usa las variantes Limit/Stop solo si se mencionan explícitamente. "" si no se determina.
- "riskReward": formato "1:N" (ej. "ratio uno a dos" → "1:2"). "" si no se menciona.
- "riesgo": porcentaje de riesgo como número con 2 decimales SIN símbolo % (ej. "1% de riesgo" → "1.00", "medio por ciento" → "0.50"). "" si no se menciona.
- "stopLoss": tamaño del stop loss EN PIPS como número (ej. "stop de 15 pips" → "15.0"). "" si no se menciona.
- "lotaje": lotaje usado (ej. "0.10"). "" si no se menciona.
- "resultado": resultado monetario neto en USD como número con 2 decimales, negativo si fue pérdida (ej. "perdí 50 dólares" → "-50.00", "gané 200" → "200.00"). "" si no se menciona.
- "salidaOperacion": "TP"/"take profit" → "Take Profit"; "SL"/"me sacó el stop" → "Stop Loss"; "break even"/"BE" → "Break Even"; "parciales" → "Parciales"; "cerré manual" → "Cierre Manual". "" si no se menciona.
- Si un campo no se menciona ni se puede deducir con certeza: "". NO INVENTES DATOS.
- Devuelve SOLO el JSON.`;

    const geminiResp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY.trim(),
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }, { text: `Texto del usuario:\n"""${text.trim()}"""` }],
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
            : 'Error al procesar el texto';
      return new Response(JSON.stringify({ error: msg, details: errText }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiJson = await geminiResp.json();
    const content: string = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
    }

    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

    const data = {
      fecha: str(parsed.fecha) || todayStr,
      par: str(parsed.par).toUpperCase(),
      sesion: str(parsed.sesion),
      estrategia: str(parsed.estrategia),
      entrada: str(parsed.entrada),
      orden: str(parsed.orden),
      riskReward: str(parsed.riskReward),
      riesgo: str(parsed.riesgo),
      stopLoss: str(parsed.stopLoss),
      lotaje: str(parsed.lotaje),
      resultado: str(parsed.resultado),
      salidaOperacion: str(parsed.salidaOperacion),
    };

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('copilot-parse-trade fatal', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Error desconocido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
