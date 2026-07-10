const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Impact = "high" | "medium" | "low" | "holiday";

interface CalEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  date: string; // ISO
  impact: Impact;
  forecast?: string;
  previous?: string;
  actual?: string;
  source: "forexfactory" | "investing";
}

function mapFFImpact(s: string): Impact {
  const v = (s || "").toLowerCase();
  if (v.includes("high")) return "high";
  if (v.includes("medium")) return "medium";
  if (v.includes("holiday")) return "holiday";
  return "low";
}

async function fetchForexFactory(week: "thisweek" | "nextweek" | "lastweek" = "thisweek"): Promise<CalEvent[]> {
  let res = await fetch(`https://nfs.faireconomy.media/ff_calendar_${week}.json`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  // Forex Factory only consistently exposes the current week.
  // Fall back to thisweek if the requested feed is not published.
  if (!res.ok && week !== "thisweek") {
    res = await fetch(`https://nfs.faireconomy.media/ff_calendar_thisweek.json`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
  }
  if (!res.ok) return [];
  const data = await res.json();
  return (data as any[]).map((e, i) => ({
    id: `ff-${i}-${e.title}-${e.date}`,
    title: e.title,
    country: e.country,
    currency: e.country,
    date: e.date,
    impact: mapFFImpact(e.impact),
    forecast: e.forecast || "",
    previous: e.previous || "",
    actual: e.actual || "",
    source: "forexfactory" as const,
  }));
}

// Investing.com blocks server-side requests via Cloudflare.
// We use TradingView's public economic-calendar API as a reliable
// equivalent that exposes importance levels and the same major currencies.
const TV_COUNTRIES = ["US", "EU", "GB", "JP", "AU", "CA", "CH", "NZ", "CN"];
const TV_COUNTRY_TO_CCY: Record<string, string> = {
  US: "USD", EU: "EUR", GB: "GBP", JP: "JPY", AU: "AUD",
  CA: "CAD", CH: "CHF", NZ: "NZD", CN: "CNY",
};

async function fetchInvesting(from?: string, to?: string): Promise<CalEvent[]> {
  // Default: current week (Sun → next Sun) in UTC.
  if (!from || !to) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    from = start.toISOString();
    to = end.toISOString();
  }
  const url =
    `https://economic-calendar.tradingview.com/events` +
    `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
    `&countries=${TV_COUNTRIES.join(",")}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Origin": "https://www.tradingview.com",
      "Referer": "https://www.tradingview.com/",
    },
  });
  if (!res.ok) throw new Error(`Investing(TV) ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.result) ? data.result : [];
  return list.map((e: any, i: number) => {
    const imp = e.importance;
    const impact: Impact = imp === 1 ? "high" : imp === 0 ? "medium" : "low";
    const currency = e.currency || TV_COUNTRY_TO_CCY[e.country] || e.country || "";
    return {
      id: `inv-${e.id || i}`,
      title: e.title || e.indicator || "",
      country: e.country || "",
      currency,
      date: e.date || "",
      impact,
      forecast: e.forecast != null ? String(e.forecast) : "",
      previous: e.previous != null ? String(e.previous) : "",
      actual: e.actual != null ? String(e.actual) : "",
      source: "investing" as const,
    };
  }).filter((e: CalEvent) => e.title && e.currency);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const source = url.searchParams.get("source") || "forexfactory";
    const range = (url.searchParams.get("range") || "week") as "week" | "day";
    const week = (url.searchParams.get("week") || "thisweek") as
      | "thisweek" | "nextweek" | "lastweek";
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;
    const events =
      source === "investing"
        ? await fetchInvesting(from, to)
        : await fetchForexFactory(week);
    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message || e), events: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});