import { useMemo, useState } from "react";
import { Trade } from "@/types/trade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Target, Activity, Percent, Receipt } from "lucide-react";

interface TradingStatsProps {
  trades: Trade[];
  accountSize?: number;
  commissionPerLot?: number;
}

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function parseTradeDate(s: string): Date | null {
  if (!s) return null;
  const isoTry = new Date(s);
  if (!isNaN(isoTry.getTime())) return isoTry;
  const parts = s.split(/[\/\-]/).map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    const [a, b, c] = parts;
    const year = c < 100 ? 2000 + c : c;
    return new Date(year, a - 1, b);
  }
  return null;
}

const TradingStats = ({ trades: allTrades, accountSize = 0, commissionPerLot = 0 }: TradingStatsProps) => {
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [includeCommission, setIncludeCommission] = useState(false);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    allTrades.forEach((t) => {
      const d = parseTradeDate(t.fecha);
      if (d) set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return [...set].sort().reverse();
  }, [allTrades]);

  const trades = useMemo(() => {
    if (monthFilter === "all") return allTrades;
    return allTrades.filter((t) => {
      const d = parseTradeDate(t.fecha);
      if (!d) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }, [allTrades, monthFilter]);

  // Calculate statistics on filtered trades
  const totalTrades = trades.length;
  
  const tradesWithResult = trades.filter((t) => t.resultado && Number(t.resultado) !== 0);
  const winningTrades = tradesWithResult.filter((t) => Number(t.resultado) > 0);
  const losingTrades = tradesWithResult.filter((t) => Number(t.resultado) < 0);
  
  const winRate = tradesWithResult.length > 0 
    ? ((winningTrades.length / tradesWithResult.length) * 100).toFixed(1)
    : "0.0";
  
  const rawTotalPnL = trades.reduce((acc, t) => acc + (Number(t.resultado) || 0), 0);
  const totalWins = winningTrades.reduce((acc, t) => acc + Number(t.resultado), 0);
  const rawTotalLosses = losingTrades.reduce((acc, t) => acc + Number(t.resultado), 0);

  // Commissions (always negative)
  const totalCommissions = trades.reduce(
    (acc, t) => acc - (Number(t.lotaje) || 0) * commissionPerLot,
    0
  );
  const totalLosses = includeCommission ? rawTotalLosses + totalCommissions : rawTotalLosses;
  const totalPnL = includeCommission ? rawTotalPnL + totalCommissions : rawTotalPnL;
  const returnPct = accountSize > 0 ? (totalPnL / accountSize) * 100 : 0;
  
  // Session performance
  const sessions = ["Londres", "New York", "Asia"];
  const sessionData = sessions.map((session) => {
    const sessionTrades = trades.filter((t) => t.sesion === session);
    const pnl = sessionTrades.reduce((acc, t) => acc + (Number(t.resultado) || 0), 0);
    return {
      name: session,
      pnl: Number(pnl.toFixed(2)),
      trades: sessionTrades.length,
    };
  });

  // Par (currency pair) performance
  const uniquePars = [...new Set(trades.map((t) => t.par).filter(Boolean))];
  const parData = uniquePars.map((par) => {
    const parTrades = trades.filter((t) => t.par === par);
    const pnl = parTrades.reduce((acc, t) => acc + (Number(t.resultado) || 0), 0);
    return {
      name: par,
      pnl: Number(pnl.toFixed(2)),
      trades: parTrades.length,
    };
  }).sort((a, b) => b.pnl - a.pnl);

  // Strategy performance
  const uniqueStrategies = [...new Set(trades.map((t) => t.estrategia).filter(Boolean))];
  const strategyData = uniqueStrategies.map((strategy) => {
    const strategyTrades = trades.filter((t) => t.estrategia === strategy);
    const pnl = strategyTrades.reduce((acc, t) => acc + (Number(t.resultado) || 0), 0);
    return {
      name: strategy,
      pnl: Number(pnl.toFixed(2)),
      trades: strategyTrades.length,
    };
  }).sort((a, b) => b.pnl - a.pnl);

  if (allTrades.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Month filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          Estadísticas
          {monthFilter !== "all" && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              · {MONTHS_ES[parseInt(monthFilter.split("-")[1], 10) - 1]} {monthFilter.split("-")[0]}
            </span>
          )}
        </h2>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[200px] h-9 bg-secondary border-border">
            <SelectValue placeholder="Filtrar por mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los meses</SelectItem>
            {monthOptions.map((k) => {
              const [y, m] = k.split("-");
              return (
                <SelectItem key={k} value={k}>
                  {MONTHS_ES[parseInt(m, 10) - 1]} {y}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {trades.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          No hay operaciones para el mes seleccionado.
        </div>
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Operaciones
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalTrades}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {winningTrades.length} ganadoras · {losingTrades.length} perdedoras
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Win Rate
            </CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{winRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tradesWithResult.length} operaciones con resultado
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ganancia Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              ${totalWins.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {winningTrades.length} operaciones positivas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pérdidas Totales
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-loss" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-loss">
              ${totalLosses.toFixed(2)}
            </div>
            <div className="flex items-center justify-between mt-1 gap-2">
              <p className="text-xs text-muted-foreground">
                {losingTrades.length} operaciones negativas
              </p>
              <Button
                type="button"
                size="sm"
                variant={includeCommission ? "default" : "outline"}
                onClick={() => setIncludeCommission((v) => !v)}
                className={`h-6 px-2 text-[10px] ${includeCommission ? "bg-primary text-primary-foreground hover:bg-gold-hover" : "border-primary/40 text-primary hover:bg-primary/10"}`}
              >
                + Comisión
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comisiones ($)
            </CardTitle>
            <Receipt className="h-4 w-4 text-loss" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-loss">
              {totalCommissions < 0
                ? `-$${Math.abs(totalCommissions).toFixed(2)}`
                : `$${totalCommissions.toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {commissionPerLot > 0 ? `$${commissionPerLot.toFixed(2)} por lote` : "Sin comisión configurada"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              P&L Acumulado
            </CardTitle>
            {totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? "text-success" : "text-loss"}`}>
              ${totalPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Balance neto de todas las operaciones
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              % Retorno
            </CardTitle>
            <Percent className={`h-4 w-4 ${returnPct >= 0 ? "text-success" : "text-loss"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${returnPct >= 0 ? "text-success" : "text-loss"}`}>
              {accountSize > 0 ? `${returnPct.toFixed(2)}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {accountSize > 0
                ? `Sobre cuenta de $${accountSize.toLocaleString()}`
                : "Define el tamaño de la cuenta"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Session Performance Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-heading font-semibold text-foreground">
              Rendimiento por Sesión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(2)}`,
                      name === "pnl" ? "P&L" : name,
                    ]}
                    labelFormatter={(label) => `Sesión: ${label}`}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {sessionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--loss))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
              {sessionData.map((session) => (
                <div key={session.name} className="text-center">
                  <div className="font-medium text-foreground">{session.name}</div>
                  <div>{session.trades} ops</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Par Performance Chart */}
        {parData.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-heading font-semibold text-foreground">
                Rendimiento por Par
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={parData.slice(0, 6)} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number, name: string) => [
                        `$${value.toFixed(2)}`,
                        name === "pnl" ? "P&L" : name,
                      ]}
                      labelFormatter={(label) => `Par: ${label}`}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {parData.slice(0, 6).map((entry, index) => (
                        <Cell
                          key={`cell-par-${index}`}
                          fill={entry.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--loss))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center mt-2 text-xs text-muted-foreground">
                {parData.length} pares · Top 6 mostrados
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strategy Performance Chart */}
        {strategyData.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-heading font-semibold text-foreground">
                Rendimiento por Estrategia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyData.slice(0, 6)} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickMargin={8}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number, name: string) => [
                        `$${value.toFixed(2)}`,
                        name === "pnl" ? "P&L" : name,
                      ]}
                      labelFormatter={(label) => `Estrategia: ${label}`}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {strategyData.slice(0, 6).map((entry, index) => (
                        <Cell
                          key={`cell-strategy-${index}`}
                          fill={entry.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--loss))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center mt-2 text-xs text-muted-foreground">
                {strategyData.length} estrategias · Top 6 mostradas
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default TradingStats;
