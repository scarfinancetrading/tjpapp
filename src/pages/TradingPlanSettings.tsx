import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Save, X, BarChart3, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useTradingPlan } from "@/hooks/useTradingPlan";
import { CustomRule, DEFAULT_PLAN_RULES, PlanRules } from "@/types/compliance";
import { toast } from "sonner";

const PAIR_OPTIONS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "XAUUSD",
  "BTCUSD",
  "NAS100",
];
const SESSION_OPTIONS = ["Londres", "New York", "Asia"];
const ORDER_TYPE_OPTIONS = [
  "Buy",
  "Sell",
  "Buy Limit",
  "Sell Limit",
  "Buy Stop",
  "Sell Stop",
];

const TradingPlanSettings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { rules, loading, savePlan } = useTradingPlan();

  const [form, setForm] = useState<PlanRules>(DEFAULT_PLAN_RULES);
  const [newRule, setNewRule] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setForm(rules);
  }, [rules]);

  const toggleArray = (field: "allowed_pairs" | "allowed_sessions" | "allowed_order_types", value: string) => {
    setForm((f) => {
      const has = f[field].includes(value);
      return {
        ...f,
        [field]: has ? f[field].filter((v) => v !== value) : [...f[field], value],
      };
    });
  };

  const addCustomRule = () => {
    const name = newRule.trim();
    if (!name) return;
    const rule: CustomRule = { id: crypto.randomUUID(), name };
    setForm((f) => ({ ...f, custom_rules: [...f.custom_rules, rule] }));
    setNewRule("");
  };

  const removeCustomRule = (id: string) => {
    setForm((f) => ({ ...f, custom_rules: f.custom_rules.filter((r) => r.id !== id) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await savePlan(form);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el plan");
    } else {
      toast.success("Plan guardado correctamente");
    }
  };

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
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button asChild variant="ghost" size="sm">
            <a href="/app">
              <ArrowLeft className="h-4 w-4 mr-1" /> Menú
            </a>
          </Button>
          <Button
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => navigate("/analytics")}
          >
            <BarChart3 className="h-4 w-4 mr-2" /> Ver Analíticas
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Plan de Trading
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define tus reglas de disciplina. Cada operación se auditará contra este plan.
          </p>
        </div>

        {/* General */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="text-base font-heading font-semibold text-foreground">
            Reglas Generales
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">R:R mínimo</Label>
              <Input
                type="number"
                step="0.1"
                value={form.min_risk_reward || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, min_risk_reward: parseFloat(e.target.value) || 0 }))
                }
                placeholder="2"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">% Riesgo máximo</Label>
              <Input
                type="number"
                step="0.1"
                value={form.max_risk_percent || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_risk_percent: parseFloat(e.target.value) || 0 }))
                }
                placeholder="1"
                className="bg-secondary border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Pares permitidos</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {PAIR_OPTIONS.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 text-sm text-foreground bg-secondary/60 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-primary/40"
                >
                  <Checkbox
                    checked={form.allowed_pairs.includes(p)}
                    onCheckedChange={() => toggleArray("allowed_pairs", p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Sesiones permitidas</Label>
            <div className="grid grid-cols-3 gap-2">
              {SESSION_OPTIONS.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 text-sm text-foreground bg-secondary/60 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-primary/40"
                >
                  <Checkbox
                    checked={form.allowed_sessions.includes(s)}
                    onCheckedChange={() => toggleArray("allowed_sessions", s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Tipos de orden permitidos</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ORDER_TYPE_OPTIONS.map((o) => (
                <label
                  key={o}
                  className="flex items-center gap-2 text-sm text-foreground bg-secondary/60 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-primary/40"
                >
                  <Checkbox
                    checked={form.allowed_order_types.includes(o)}
                    onCheckedChange={() => toggleArray("allowed_order_types", o)}
                  />
                  {o}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Custom rules */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-heading font-semibold text-foreground">
              Reglas Personalizadas
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Reglas cualitativas que confirmarás manualmente en cada operación.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomRule();
                }
              }}
              placeholder="Ej: Confluencia con HTF"
              className="bg-secondary border-border"
            />
            <Button
              type="button"
              onClick={addCustomRule}
              className="bg-primary text-primary-foreground hover:bg-gold-hover"
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir
            </Button>
          </div>

          {form.custom_rules.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.custom_rules.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs rounded-full px-3 py-1"
                >
                  {r.name}
                  <button
                    type="button"
                    onClick={() => removeCustomRule(r.id)}
                    className="hover:text-primary-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-gold-hover font-semibold"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Guardar Plan</>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default TradingPlanSettings;
