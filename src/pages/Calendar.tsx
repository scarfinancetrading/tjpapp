import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Filter, RefreshCw, Eye, EyeOff, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Calendar as DayCalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Source = "forexfactory" | "investing";
type Impact = "high" | "medium" | "low" | "holiday";

interface CalEvent {
  id: string;
  title: string;
  currency: string;
  date: string;
  impact: Impact;
  forecast?: string;
  previous?: string;
  actual?: string;
  source: Source;
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];
const FF_IMPACTS: { key: Impact; label: string; dot: string }[] = [
  { key: "high", label: "Alto impacto (Roja)", dot: "bg-red-500" },
  { key: "medium", label: "Medio impacto (Naranja)", dot: "bg-orange-500" },
  { key: "low", label: "Bajo impacto (Amarilla)", dot: "bg-yellow-500" },
  { key: "holiday", label: "Feriado", dot: "bg-muted-foreground" },
];
const INV_IMPACTS: { key: Impact; label: string }[] = [
  { key: "high", label: "3 estrellas" },
  { key: "medium", label: "2 estrellas" },
  { key: "low", label: "1 estrella" },
];

const LS = {
  source: "calNewsSource",
  filters: "calNewsFilters", // per-source filters
  hidden: "calNewsHiddenIds",
  view: "calNewsView",
  day: "calNewsDay",
};

type FiltersState = {
  forexfactory: { currencies: string[]; impacts: Impact[] };
  investing: { currencies: string[]; impacts: Impact[] };
};

const DEFAULT_FILTERS: FiltersState = {
  forexfactory: { currencies: [...CURRENCIES], impacts: ["high", "medium"] },
  investing: { currencies: [...CURRENCIES], impacts: ["high", "medium"] },
};

function loadFilters(): FiltersState {
  try {
    const raw = localStorage.getItem(LS.filters);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      forexfactory: { ...DEFAULT_FILTERS.forexfactory, ...(parsed.forexfactory || {}) },
      investing: { ...DEFAULT_FILTERS.investing, ...(parsed.investing || {}) },
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function impactColor(i: Impact) {
  switch (i) {
    case "high": return "bg-red-500/15 text-red-500 border-red-500/30";
    case "medium": return "bg-orange-500/15 text-orange-500 border-orange-500/30";
    case "low": return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

const Calendar = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, profileStatus, profileLoading } = useAuth();

  const [source, setSource] = useState<Source>(
    (localStorage.getItem(LS.source) as Source) || "forexfactory",
  );
  const [filters, setFilters] = useState<FiltersState>(loadFilters());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS.hidden) || "[]"); } catch { return []; }
  });
  // Default to "day" view showing today's news each time the user enters.
  const [view, setView] = useState<"week" | "day">(
    (localStorage.getItem(LS.view) as "week" | "day") || "day",
  );
  const [day, setDay] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);
  useEffect(() => {
    if (!authLoading && !profileLoading && user && profileStatus !== "approved") {
      navigate("/");
    }
  }, [user, authLoading, profileStatus, profileLoading, navigate]);

  useEffect(() => { localStorage.setItem(LS.source, source); }, [source]);
  useEffect(() => { localStorage.setItem(LS.filters, JSON.stringify(filters)); }, [filters]);
  useEffect(() => { localStorage.setItem(LS.hidden, JSON.stringify(hidden)); }, [hidden]);
  useEffect(() => { localStorage.setItem(LS.view, view); }, [view]);
  useEffect(() => { localStorage.setItem(LS.day, day.toISOString()); }, [day]);

  // Pick which FF weekly feed to pull based on the selected day relative to today.
  // Note: Forex Factory only reliably publishes "thisweek"; the edge function
  // falls back to thisweek when nextweek/lastweek aren't available.
  const weekParam = useMemo<"thisweek" | "nextweek" | "lastweek">(() => {
    const today = new Date();
    const startOfWeek = (d: Date) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      x.setDate(x.getDate() - x.getDay()); // Sunday
      return x;
    };
    const diff =
      (startOfWeek(day).getTime() - startOfWeek(today).getTime()) /
      (7 * 24 * 60 * 60 * 1000);
    if (diff <= -1) return "lastweek";
    if (diff >= 1) return "nextweek";
    return "thisweek";
  }, [day]);

  // For the TradingView-backed Investing source we send an explicit date range.
  const range = useMemo(() => {
    if (view === "day") {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    start.setDate(start.getDate() - start.getDay()); // Sunday
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [view, day]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        source,
        range: view,
        week: weekParam,
        from: range.from,
        to: range.to,
      });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/economic-calendar?${params.toString()}`;
      const res = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      const result = await res.json();
      if (result?.error) toast.error(`No se pudieron cargar las noticias: ${result.error}`);
      setEvents(result?.events || []);
    } catch (e: any) {
      toast.error(`Error: ${e?.message || e}`);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user && profileStatus === "approved") load(); /* eslint-disable-next-line */ }, [source, user, profileStatus, weekParam, range.from, range.to]);

  const current = filters[source];
  const setCurrent = (patch: Partial<FiltersState["forexfactory"]>) =>
    setFilters((f) => ({ ...f, [source]: { ...f[source], ...patch } }));

  const toggleCurrency = (c: string) => {
    const set = new Set(current.currencies);
    set.has(c) ? set.delete(c) : set.add(c);
    setCurrent({ currencies: [...set] });
  };
  const toggleImpact = (i: Impact) => {
    const set = new Set(current.impacts);
    set.has(i) ? set.delete(i) : set.add(i);
    setCurrent({ impacts: [...set] as Impact[] });
  };

  const filtered = useMemo(() => {
    let list = events
      .filter((e) => current.impacts.includes(e.impact))
      .filter((e) => current.currencies.includes(e.currency))
      .filter((e) => !hidden.includes(e.id));
    if (view === "day") {
      const y = day.getFullYear(), m = day.getMonth(), d = day.getDate();
      list = list.filter((e) => {
        const ed = new Date(e.date);
        if (isNaN(ed.getTime())) return false;
        return ed.getFullYear() === y && ed.getMonth() === m && ed.getDate() === d;
      });
    }
    return list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [events, current, hidden, view, day]);

  const impactOptions = source === "forexfactory" ? FF_IMPACTS : INV_IMPACTS;

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user || profileStatus !== "approved") return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
            Calendario de Noticias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Eventos económicos de Forex Factory e Investing.com
          </p>
        </div>

        <Card className="bg-card border-border mb-4">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Fuente</label>
                  <Select value={source} onValueChange={(v) => setSource(v as Source)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forexfactory">Forex Factory</SelectItem>
                      <SelectItem value="investing">Investing.com (TradingView)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 sm:mt-5">
                      <Filter className="h-4 w-4" /> Impacto ({current.impacts.length})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-2">
                      {impactOptions.map((opt) => (
                        <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={current.impacts.includes(opt.key)}
                            onCheckedChange={() => toggleImpact(opt.key)}
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 sm:mt-5">
                      <Filter className="h-4 w-4" /> Divisas ({current.currencies.length})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="grid grid-cols-2 gap-2">
                      {CURRENCIES.map((c) => (
                        <label key={c} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={current.currencies.includes(c)}
                            onCheckedChange={() => toggleCurrency(c)}
                          />
                          <span className="text-sm">{c}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="ghost" className="flex-1"
                        onClick={() => setCurrent({ currencies: [...CURRENCIES] })}>Todas</Button>
                      <Button size="sm" variant="ghost" className="flex-1"
                        onClick={() => setCurrent({ currencies: [] })}>Ninguna</Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Vista</label>
                  <Select value={view} onValueChange={(v) => setView(v as "week" | "day")}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Semana</SelectItem>
                      <SelectItem value="day">Día</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {view === "day" && (
                  <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="sm:mt-5"
                    onClick={() => setDay(new Date())}
                  >
                    Hoy
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("gap-2 sm:mt-5")}>
                        <CalendarIcon className="h-4 w-4" />
                        {format(day, "M/d/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DayCalendar
                        mode="single"
                        selected={day}
                        onSelect={(d) => d && setDay(d)}
                        locale={es}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                {hidden.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setHidden([])} className="gap-2">
                    <Eye className="h-4 w-4" /> Mostrar ocultas ({hidden.length})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {filtered.length} eventos {loading && "(cargando…)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 && !loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No hay eventos con los filtros actuales.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((e) => {
                  const isPast = new Date(e.date).getTime() < Date.now();
                  return (
                  <div
                    key={e.id}
                    className={`p-3 sm:p-4 flex items-start gap-3 hover:bg-accent/30 group border-l-4 ${
                      isPast
                        ? "border-l-muted-foreground/40 bg-muted/40 grayscale"
                        : "border-l-primary bg-primary/5"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 min-w-[68px]">
                      <Badge variant="outline" className={`text-xs font-mono ${isPast ? "opacity-60" : ""}`}>
                        {e.currency}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${impactColor(e.impact)} ${isPast ? "opacity-60" : ""}`}>
                        {e.impact === "high" ? "ALTO" : e.impact === "medium" ? "MEDIO" : e.impact === "low" ? "BAJO" : "FERIADO"}
                      </Badge>
                      {isPast ? (
                        <Badge className="text-[9px] px-1.5 py-0 bg-muted-foreground/80 text-background border-transparent">
                          ✓ PASÓ
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] px-1.5 py-0 bg-primary text-primary-foreground border-transparent animate-pulse">
                          ● PRÓXIMO
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium flex items-center gap-2 flex-wrap ${isPast ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        <span>{e.title}</span>
                      </div>
                      <div className={`text-xs mt-0.5 ${isPast ? "text-muted-foreground/70" : "text-primary font-medium"}`}>
                        {formatDateTime(e.date)}
                      </div>
                      {(e.forecast || e.previous || e.actual) && (
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {e.actual && <span>Actual: <span className="text-foreground">{e.actual}</span></span>}
                          {e.forecast && <span>Pron.: <span className="text-foreground">{e.forecast}</span></span>}
                          {e.previous && <span>Prev.: <span className="text-foreground">{e.previous}</span></span>}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8"
                      onClick={() => setHidden((h) => [...h, e.id])}
                      title="Ocultar"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Calendar;