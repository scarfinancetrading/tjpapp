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
  ReferenceLine,
} from "recharts";
import { ArrowLeft, AlertTriangle, TrendingDown, Target, ShieldAlert } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceData, FundingAccount } from "@/types/compliance";
import { useTradingPlan } from "@/hooks/useTradingPlan";

interface TradeRow {
  id: string;
  created_at: string;
  fecha: string | null;
  resultado: string | null;
  compliance_data: ComplianceData | null;
  funding_account_id: string | null;
}

const parseResult = (v: string | null): number => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { rules: planRules, loading: planLoading } = useTradingPlan();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

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
        .select("id,created_at,fecha,resultado,compliance_data,funding_account_id")
        .order("created_at", { ascending: true });
      if (!error && data) setTrades(data);
      setLoading(false);
    })();
  }, [user]);

  const accounts: FundingAccount[] = planRules.funding_accounts ?? [];

  // Default to first account if available
  useEffect(() => {
    if (selectedAccountId === "all" && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const filteredTrades = useMemo(() => {
    if (selectedAccountId === "all") return trades;
    return trades.filter((t) => t.funding_account_id === selectedAccountId);
  }, [trades, selectedAccountId]);

  // Equity curve for selected account
  const { equityData, totalPnl, maxDrawdown, dailyPnl } = useMemo(() => {
    const base = selectedAccount?.account_size ?? 0;
    let balance = base;
    let maxDd = 0;
    const rows: { idx: number; date: string; balance: number; total: number; disciplinado: number }[] = [];
    let cumAll = 0;
    let cumDisc = 0;

    // Compute daily PnL for today, matching by trade fecha ("M/d/yyyy") or created_at
    const today = new Date();
    const todayKey = today.toDateString();
    const todayMDY = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
    let daily = 0;

    filteredTrades.forEach((t, i) => {
      const pnl = parseResult(t.resultado);
      balance += pnl;
      cumAll += pnl;
      const score = t.compliance_data?.score ?? 0;
      if (score >= 80) cumDisc += pnl;
      // Max Overall Drawdown: only counts once balance dips below initial account size
      const dd = Math.max(0, base - balance);
      if (dd > maxDd) maxDd = dd;

      const fechaMatches = t.fecha && t.fecha.trim() === todayMDY;
      const createdMatches = new Date(t.created_at).toDateString() === todayKey;
      if (fechaMatches || createdMatches) daily += pnl;

      rows.push({
        idx: i + 1,
        date: new Date(t.created_at).toLocaleDateString("es-ES", {
          month: "short",
          day: "numeric",
        }),
        balance: Number(balance.toFixed(2)),
        total: Number(cumAll.toFixed(2)),
        disciplinado: Number(cumDisc.toFixed(2)),
      });
    });

    return { equityData: rows, totalPnl: cumAll, maxDrawdown: maxDd, dailyPnl: daily };
  }, [filteredTrades, selectedAccount]);

  const leaks = useMemo(() => {
    const map = new Map<string, { label: string; loss: number; count: number }>();
    for (const t of filteredTrades) {
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
  }, [filteredTrades]);

  if (authLoading || loading || planLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Prop firm metrics
  let profitTargetUsd = 0;
  let profitTargetLine = 0;
  let maxDdLine = 0;
  let dailyDdLimit = 0;
  let profitProgressPct = 0;
  let profitRemainingUsd = 0;
  let profitRemainingPct = 0;
  let dailyDdUsedPct = 0;
  let maxDdUsedPct = 0;

  if (selectedAccount) {
    const size = selectedAccount.account_size;
    profitTargetUsd = size * (selectedAccount.profit_target_pct / 100);
    profitTargetLine = size + profitTargetUsd;
    maxDdLine = size - size * (selectedAccount.max_drawdown_pct / 100);
    dailyDdLimit = size * (selectedAccount.daily_drawdown_pct / 100);
    profitProgressPct = profitTargetUsd > 0 ? Math.max(0, Math.min(100, (totalPnl / profitTargetUsd) * 100)) : 0;
    profitRemainingUsd = Math.max(0, profitTargetUsd - totalPnl);
    profitRemainingPct = size > 0 ? (profitRemainingUsd / size) * 100 : 0;
    dailyDdUsedPct = dailyDdLimit > 0 ? Math.max(0, Math.min(100, (Math.abs(Math.min(0, dailyPnl)) / dailyDdLimit) * 100)) : 0;
    const maxDdLimitUsd = size * (selectedAccount.max_drawdown_pct / 100);
    maxDdUsedPct = maxDdLimitUsd > 0 ? Math.max(0, Math.min(100, (maxDrawdown / maxDdLimitUsd) * 100)) : 0;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/trading-plan")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Plan
            </Button>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                Monitor de Cuentas de Fondeo
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Analíticas por cuenta: progreso, drawdown y disciplina.
              </p>
            </div>
          </div>

          {accounts.length > 0 && (
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="bg-secondary border-border w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.company_name} · {a.phase}
                  </SelectItem>
                ))}
                <SelectItem value="all">Todas las cuentas</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {accounts.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No has creado cuentas de fondeo aún. Ve al Plan de Trading para agregar tu primera cuenta.
            </p>
          </div>
        )}

        {/* Prop firm monitor */}
        {selectedAccount && (
          <>
            <section className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-heading font-semibold text-foreground">
                    {selectedAccount.company_name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${selectedAccount.account_size.toLocaleString()} · {selectedAccount.phase}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Balance actual</div>
                  <div
                    className={`text-2xl font-heading font-bold ${
                      totalPnl >= 0 ? "text-primary" : "text-red-400"
                    }`}
                  >
                    ${(selectedAccount.account_size + totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Profit target */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-primary" /> Profit Target ({selectedAccount.profit_target_pct}%)
                  </span>
                  <span className="text-foreground font-medium">
                    ${totalPnl.toFixed(2)} / ${profitTargetUsd.toFixed(2)}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${profitProgressPct}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Faltan <span className="text-primary font-medium">${profitRemainingUsd.toFixed(2)}</span>{" "}
                  ({profitRemainingPct.toFixed(2)}%) para pasar de fase.
                </div>
              </div>

              {/* Daily drawdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-red-400" /> Drawdown Diario ({selectedAccount.daily_drawdown_pct}%)
                  </span>
                  <span className="text-foreground font-medium">
                    ${Math.abs(Math.min(0, dailyPnl)).toFixed(2)} / ${dailyDdLimit.toFixed(2)}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden border border-border">
                  <div
                    className={`h-full transition-all ${
                      dailyDdUsedPct >= 80 ? "bg-red-500" : "bg-red-400/60"
                    }`}
                    style={{ width: `${dailyDdUsedPct}%` }}
                  />
                </div>
                {dailyDdUsedPct >= 80 && (
                  <div className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Alerta: usaste más del 80% del límite diario.
                  </div>
                )}
              </div>

              {/* Max overall drawdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-red-400" /> Max Drawdown Total ({selectedAccount.max_drawdown_pct}%)
                  </span>
                  <span className="text-foreground font-medium">
                    ${maxDrawdown.toFixed(2)} / ${(selectedAccount.account_size * selectedAccount.max_drawdown_pct / 100).toFixed(2)}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden border border-border">
                  <div
                    className={`h-full transition-all ${
                      maxDdUsedPct >= 80 ? "bg-red-500" : "bg-red-400/60"
                    }`}
                    style={{ width: `${maxDdUsedPct}%` }}
                  />
                </div>
              </div>
            </section>

            {/* Equity Curve */}
            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-heading font-semibold text-foreground mb-4">
                Curva de Capital
              </h2>
              {equityData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin operaciones registradas para esta cuenta todavía.
                </p>
              ) : (
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        domain={["dataMin - 100", "dataMax + 100"]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                      <ReferenceLine
                        y={profitTargetLine}
                        stroke="#22c55e"
                        strokeDasharray="5 5"
                        label={{ value: "Profit Target", fill: "#22c55e", fontSize: 11, position: "insideTopRight" }}
                      />
                      <ReferenceLine
                        y={maxDdLine}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                        label={{ value: "Max DD Limit", fill: "#ef4444", fontSize: 11, position: "insideBottomRight" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        name="Balance"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </>
        )}

        {/* Shadow Portfolio */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-base font-heading font-semibold text-foreground mb-4">
            Shadow Portfolio (Disciplina)
          </h2>
          {equityData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay operaciones para analizar.
            </p>
          ) : (
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
