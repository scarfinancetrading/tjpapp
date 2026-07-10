import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, RefreshCw, Calculator as CalcIcon, EyeOff, Settings2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type RowKey = "lots" | "miniLots" | "microLots" | "units" | "pipValue" | "risk" | "margin" | "breakEven";
const ROW_LABELS: Record<RowKey, string> = {
  lots: "Lots",
  miniLots: "Mini Lots",
  microLots: "Micro Lots",
  units: "Unidades",
  pipValue: "Pip Value per Lot",
  risk: "Riesgo Total",
  margin: "Margen Requerido",
  breakEven: "Precio Break Even",
};
const VISIBILITY_KEY = "calcRowVisibility";

const PAIRS = [
  "EURUSD", "GBPUSD", "AUDUSD",
  "USDJPY", "AUDJPY", "CADJPY", "EURJPY", "GBPJPY",
  "USDCAD", "AUDCAD", "EURCAD", "GBPCAD",
  "EURAUD", "XAUUSD", "EURGBP",
];

type Rates = {
  USDJPY: number;
  USDCAD: number;
  AUDUSD: number;
  XAUUSD: number;
  EURUSD: number;
  GBPUSD: number;
};

async function fetchRates(): Promise<Rates> {
  const [fxRes, goldRes] = await Promise.all([
    fetch("https://open.er-api.com/v6/latest/USD"),
    fetch("https://api.gold-api.com/price/XAU").catch(() => null),
  ]);
  if (!fxRes.ok) throw new Error("No se pudieron obtener cotizaciones");
  const fx = await fxRes.json();
  const rates = fx.rates || {};
  let xau = 0;
  if (goldRes && goldRes.ok) {
    try {
      const g = await goldRes.json();
      xau = Number(g.price) || 0;
    } catch {}
  }
  return {
    USDJPY: Number(rates.JPY) || 0,
    USDCAD: Number(rates.CAD) || 0,
    AUDUSD: rates.AUD ? 1 / Number(rates.AUD) : 0,
    XAUUSD: xau,
    EURUSD: rates.EUR ? 1 / Number(rates.EUR) : 0,
    GBPUSD: rates.GBP ? 1 / Number(rates.GBP) : 0,
  };
}

/**
 * Pip value per 1 standard lot (100,000 units) in USD.
 * XAUUSD: pip = 0.1, contract = 100 oz → $10 per pip per lot.
 */
function pipValuePerLot(pair: string, r: Rates): number | null {
  switch (pair) {
    case "EURUSD":
    case "GBPUSD":
    case "AUDUSD":
    case "XAUUSD":
      return 10;
    case "USDJPY":
    case "AUDJPY":
    case "CADJPY":
    case "EURJPY":
    case "GBPJPY":
      return r.USDJPY ? 1000 / r.USDJPY : null;
    case "USDCAD":
    case "AUDCAD":
    case "EURCAD":
    case "GBPCAD":
      return r.USDCAD ? 10 / r.USDCAD : null;
    case "EURAUD":
      return r.AUDUSD ? 10 * r.AUDUSD : null;
    case "EURGBP":
      return r.GBPUSD ? 10 * r.GBPUSD : null;
    default:
      return null;
  }
}

/**
 * Notional value in USD for 1 standard lot of the given pair.
 * XAUUSD contract = 100 oz. FX contract = 100,000 units of base currency.
 */
function notionalUsdPerLot(pair: string, r: Rates): number | null {
  if (pair === "XAUUSD") return r.XAUUSD ? 100 * r.XAUUSD : null;
  const base = pair.slice(0, 3);
  let baseUsd = 0;
  switch (base) {
    case "USD": baseUsd = 1; break;
    case "EUR": baseUsd = r.EURUSD; break;
    case "GBP": baseUsd = r.GBPUSD; break;
    case "AUD": baseUsd = r.AUDUSD; break;
    case "CAD": baseUsd = r.USDCAD ? 1 / r.USDCAD : 0; break;
    default: return null;
  }
  return baseUsd ? 100000 * baseUsd : null;
}

const Calculator = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, profileStatus, profileLoading } = useAuth();

  const [pair, setPair] = useState("EURUSD");
  const [accountBalance, setAccountBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const [riskAmount, setRiskAmount] = useState("");
  const [stopPips, setStopPips] = useState("");
  const [leverage, setLeverage] = useState("");
  const [commission, setCommission] = useState("");

  const [rates, setRates] = useState<Rates | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [result, setResult] = useState<{
    lots: number;
    units: number;
    pipValue: number;
    riskUsed: number;
    margin: number | null;
    leverageUsed: number | null;
    breakEven: number | null;
    stopPips: number;
    commission: number;
  } | null>(null);

  const [adjustForCommission, setAdjustForCommission] = useState(false);

  const [visibleRows, setVisibleRows] = useState<Record<RowKey, boolean>>(() => {
    try {
      const stored = localStorage.getItem(VISIBILITY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          lots: true, miniLots: true, microLots: true,
          units: true, pipValue: true, risk: true, margin: true, breakEven: true,
          ...parsed,
        };
      }
    } catch {}
    return { lots: true, miniLots: true, microLots: true, units: true, pipValue: true, risk: true, margin: true, breakEven: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(visibleRows));
    } catch {}
  }, [visibleRows]);

  const toggleRow = (key: RowKey) =>
    setVisibleRows((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !profileLoading && user && profileStatus !== "approved") {
      navigate("/");
    }
  }, [user, authLoading, profileStatus, profileLoading, navigate]);

  const loadRates = async () => {
    setLoadingRates(true);
    try {
      const r = await fetchRates();
      setRates(r);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "No se pudieron obtener los precios",
        variant: "destructive",
      });
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (!user || profileStatus !== "approved") return null;

  const handleCalculate = () => {
    if (!rates) {
      toast({ title: "Espera", description: "Cargando cotizaciones...", variant: "destructive" });
      return;
    }
    const balance = Number(accountBalance) || 0;
    const pct = Number(riskPercent) || 0;
    let risk = Number(riskAmount) || 0;
    if (!risk && balance > 0 && pct > 0) risk = balance * (pct / 100);
    const stops = Number(stopPips) || 0;

    if (!risk || !stops) {
      toast({
        title: "Faltan datos",
        description: "Ingresa Riesgo (o Balance + %) y Stop Loss en pips.",
        variant: "destructive",
      });
      return;
    }

    const pv = pipValuePerLot(pair, rates);
    if (!pv) {
      toast({ title: "Error", description: "Par no soportado", variant: "destructive" });
      return;
    }

    const lots = risk / (stops * pv);
    const units = lots * 100000;

    const lev = Number(leverage) || 0;
    let margin: number | null = null;
    if (lev > 0) {
      const notional = notionalUsdPerLot(pair, rates);
      if (notional) margin = (lots * notional) / lev;
    }
    const comm = Number(commission) || 0;
    const breakEven = comm > 0 ? lots * comm : null;
    setResult({ lots, units, pipValue: pv, riskUsed: risk, margin, leverageUsed: lev > 0 ? lev : null, breakEven, stopPips: stops, commission: comm });
  };

  const handleReset = () => {
    setAccountBalance("");
    setRiskPercent("");
    setRiskAmount("");
    setStopPips("");
    setLeverage("");
    setCommission("");
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-3xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Menú
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRates}
            disabled={loadingRates}
            className="border-border"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingRates ? "animate-spin" : ""}`} />
            Actualizar precios
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-xl font-heading text-foreground flex items-center gap-2">
              <CalcIcon className="h-5 w-5 text-primary" />
              Calculadora de Lotaje
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Calcula el tamaño exacto de tu posición usando precios en tiempo real
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Account Currency</Label>
                <div className="h-10 px-3 flex items-center bg-secondary border border-border rounded-md text-foreground font-medium">
                  USD
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Instrument</Label>
                <Select value={pair} onValueChange={setPair}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-72">
                    {PAIRS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Account Balance</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  placeholder="Opcional"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Risk Percent (%)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  placeholder="Opcional"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Risk Amount ($)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={riskAmount}
                  onChange={(e) => setRiskAmount(e.target.value)}
                  placeholder="Opcional"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Stop Loss Pips</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={stopPips}
                  onChange={(e) => setStopPips(e.target.value)}
                  placeholder="Requerido"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Apalancamiento{" "}
                  <span className="text-xs text-muted-foreground/70">(opcional)</span>
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  placeholder="ej: 100, 500"
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Comisión ($){" "}
                  <span className="text-xs text-muted-foreground/70">(opcional)</span>
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="ej: 7"
                  className="bg-secondary border-border"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCalculate}
                disabled={loadingRates || !rates}
                className="flex-1 bg-primary text-primary-foreground hover:bg-gold-hover font-semibold"
              >
                Calculate
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-border"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {!rates && !loadingRates && (
              <p className="text-xs text-loss text-center">
                No se pudieron cargar las cotizaciones. Toca "Actualizar precios".
              </p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-heading text-foreground">
                Resultados
              </CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <Settings2 className="h-4 w-4 mr-1" />
                    Mostrar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 bg-popover border-border" align="end">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Filas visibles
                  </p>
                  <div className="space-y-2">
                    {(Object.keys(ROW_LABELS) as RowKey[]).map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                      >
                        <Checkbox
                          checked={visibleRows[key]}
                          onCheckedChange={() => toggleRow(key)}
                        />
                        {ROW_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </CardHeader>
            <CardContent>
              {(() => {
                const canAdjust = result.commission > 0;
                const isAdjusted = adjustForCommission && canAdjust;
                const displayLots = isAdjusted
                  ? result.riskUsed / (result.stopPips * result.pipValue + result.commission)
                  : result.lots;
                const displayUnits = displayLots * 100000;
                const displayBreakEven = result.commission > 0 ? displayLots * result.commission : null;
                const displayMargin = result.margin !== null && result.leverageUsed
                  ? (result.margin * displayLots) / result.lots
                  : null;
                const cells: { key: RowKey; label: React.ReactNode; value: React.ReactNode; valueClass?: string }[] = [];
                if (visibleRows.lots) cells.push({
                  key: "lots",
                  label: (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>Lots</span>
                      {canAdjust && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAdjustForCommission((v) => !v); }}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                            isAdjusted
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                          }`}
                          title="Ajustar lotaje considerando comisiones"
                        >
                          {isAdjusted ? "Con comisión ✓" : "+ Comisión"}
                        </button>
                      )}
                    </span>
                  ),
                  value: displayLots.toFixed(2),
                  valueClass: "text-primary font-heading font-bold text-lg",
                });
                if (visibleRows.miniLots) cells.push({ key: "miniLots", label: "Mini Lots", value: (displayLots * 10).toFixed(2) });
                if (visibleRows.microLots) cells.push({ key: "microLots", label: "Micro Lots", value: (displayLots * 100).toFixed(2) });
                if (visibleRows.units) cells.push({ key: "units", label: "Unidades", value: Math.round(displayUnits).toLocaleString() });
                if (visibleRows.pipValue) cells.push({ key: "pipValue", label: "Pip Value per Lot", value: `$${result.pipValue.toFixed(2)}` });
                if (visibleRows.risk) cells.push({ key: "risk", label: "Riesgo Total", value: `$${result.riskUsed.toFixed(2)}` });
                if (visibleRows.margin && displayMargin !== null) cells.push({
                  key: "margin",
                  label: (<>Margen Requerido <span className="text-xs text-muted-foreground/70">(1:{result.leverageUsed})</span></>),
                  value: `$${displayMargin.toFixed(2)}`,
                  valueClass: "text-primary font-heading font-bold",
                });
                if (visibleRows.breakEven && displayBreakEven !== null) cells.push({
                  key: "breakEven",
                  label: "Precio Break Even",
                  value: `$${displayBreakEven.toFixed(2)}`,
                  valueClass: "text-primary font-heading font-bold",
                });
                if (cells.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Todas las filas están ocultas. Usa "Mostrar" para activarlas.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-2 gap-2 items-stretch">
                    {cells.map((c) => (
                      <div
                        key={c.key}
                        className="group flex flex-col h-full rounded-md border border-border bg-secondary/40 px-2 py-1.5"
                      >
                        <span className="text-xs text-muted-foreground flex items-start gap-2 min-h-[2rem]">
                          <span className="flex-1 leading-tight">{c.label}</span>
                          <button
                            onClick={() => toggleRow(c.key)}
                            className="opacity-60 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground shrink-0"
                            aria-label="Ocultar"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        </span>
                        <span className={`${c.valueClass || "text-foreground font-medium text-sm"} leading-normal mt-auto`}>
                          {c.value}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {false && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Todas las filas están ocultas. Usa "Mostrar" para activarlas.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {rates && (
          <p className="text-xs text-muted-foreground text-center">
            Precios actualizados · USDJPY {rates.USDJPY.toFixed(3)} · USDCAD{" "}
            {rates.USDCAD.toFixed(4)} · AUDUSD {rates.AUDUSD.toFixed(4)}
            {rates.XAUUSD ? ` · XAUUSD ${rates.XAUUSD.toFixed(2)}` : ""}
          </p>
        )}
      </main>
    </div>
  );
};

export default Calculator;