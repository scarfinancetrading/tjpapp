import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowLeft, AlertTriangle, TrendingDown } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceData } from "@/types/compliance";

interface TradeRow {
  id: string;
  created_at: string;
  resultado: string | null;
  compliance_data: ComplianceData | null;
}

const parseResult = (v: string | null): number => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (col: string, o: { ascending: boolean }) => Promise<{
              data: TradeRow[] | null;
              error: unknown;
            }>;
          };
        };
      })
        .from("trades")
        .select("id,created_at,resultado,compliance_data")
        .order("created_at", { ascending: true });
      if (!error && data) setTrades(data);
      setLoading(false);
    })();
  }, [user]);

  const chartData = useMemo(() => {
    let cumAll = 0;
    let cumDisc = 0;
    return trades.map((t, i) => {
      const pnl = parseResult(t.resultado);
      cumAll += pnl;
      const score = t.compliance_data?.score ?? 0;
      if (score >= 80) cumDisc += pnl;
      return {
        idx: i + 1,
        date: new Date(t.created_at).toLocaleDateString("es-ES", {
          month: "short",
          day: "numeric",
        }),
        total: Number(cumAll.toFixed(2)),
        disciplinado: Number(cumDisc.toFixed(2)),
      };
    });
  }, [trades]);

  const leaks = useMemo(() => {
    const map = new Map<string, { label: string; loss: number; count: number }>();
    for (const t of trades) {
      const pnl = parseResult(t.resultado);
      if (pnl >= 0) continue;
      const details = t.compliance_data?.details ?? {};
      for (const [key, detail] of Object.entries(details)) {
        if (detail.valid) continue;
        const entry = map.get(key) ?? { label: detail.message || key, loss: 0, count: 0 };
        entry.loss += pnl;
        entry.count += 1;
        entry.label = detail.message || key;
        map.set(key, entry);
      }
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.loss - b.loss);
  }, [trades]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/trading-plan")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Plan
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Analíticas de Disciplina
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compara tu curva real vs. la de operaciones disciplinadas (score ≥ 80).
            </p>
          </div>
        </div>

        {/* Shadow Portfolio */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-4">
            Shadow Portfolio
          </h2>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay operaciones para analizar.
            </p>
          ) : (
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="PnL Real"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="disciplinado"
                    name="PnL Disciplinado (≥80)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Leak Detector */}
        <section>
          <h2 className="text-base font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Fugas de Capital (Leak Detector)
          </h2>
          {leaks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin fugas detectadas todavía. Registra operaciones perdedoras con auditoría activa para analizar dónde estás perdiendo capital.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaks.map((l) => (
                <div
                  key={l.key}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-foreground font-medium leading-snug">
                      {l.label}
                    </div>
                    <TrendingDown className="h-4 w-4 text-red-400 shrink-0" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-heading font-bold text-red-400">
                      ${l.loss.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {l.count} {l.count === 1 ? "operación" : "operaciones"} incumplida{l.count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AnalyticsDashboard;
