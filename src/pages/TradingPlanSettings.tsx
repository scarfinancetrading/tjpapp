import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Save,
  X,
  BarChart3,
  Loader2,
  Trash2,
  Building2,
  Pencil,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useTradingPlan } from "@/hooks/useTradingPlan";
import {
  CustomRule,
  DEFAULT_PLAN_RULES,
  FundingAccount,
  FundingPhase,
  PlanRules,
} from "@/types/compliance";
import { toast } from "sonner";
import TagInput from "@/components/TagInput";
import { supabase } from "@/integrations/supabase/client";

const SESSION_OPTIONS = ["Londres", "New York", "Asia"];
const ORDER_TYPE_OPTIONS = [
  "Buy",
  "Sell",
  "Buy Limit",
  "Sell Limit",
  "Buy Stop",
  "Sell Stop",
];
const PHASES: FundingPhase[] = ["Fase 1", "Fase 2", "Fondeada"];

const emptyAccount = (): FundingAccount => ({
  id: crypto.randomUUID(),
  company_name: "",
  account_size: 0,
  phase: "Fase 1",
  profit_target_pct: 8,
  daily_drawdown_pct: 5,
  max_drawdown_pct: 10,
});

const TradingPlanSettings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { rules, loading, savePlan } = useTradingPlan();

  const [form, setForm] = useState<PlanRules>(DEFAULT_PLAN_RULES);
  const [newRule, setNewRule] = useState("");
  const [saving, setSaving] = useState(false);

  // Funding account form
  const [editingAccount, setEditingAccount] = useState<FundingAccount | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setForm(rules);
  }, [rules]);

  const toggleArray = (
    field: "allowed_sessions" | "allowed_order_types",
    value: string
  ) => {
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

  const saveAccount = () => {
    if (!editingAccount) return;
    if (!editingAccount.company_name.trim()) {
      toast.error("Ingresa el nombre de la empresa");
      return;
    }
    if (!editingAccount.account_size || editingAccount.account_size <= 0) {
      toast.error("Tamaño de cuenta inválido");
      return;
    }
    setForm((f) => {
      const exists = f.funding_accounts.some((a) => a.id === editingAccount.id);
      return {
        ...f,
        funding_accounts: exists
          ? f.funding_accounts.map((a) => (a.id === editingAccount.id ? editingAccount : a))
          : [...f.funding_accounts, editingAccount],
      };
    });
    setEditingAccount(null);
  };

  const deleteAccount = (id: string) => {
    setForm((f) => ({
      ...f,
      funding_accounts: f.funding_accounts.filter((a) => a.id !== id),
    }));
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
            Define tus reglas de disciplina y gestiona tus cuentas de fondeo.
          </p>
        </div>

        {/* Funding Accounts (Prop Firms) */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-base font-heading font-semibold text-foreground">
                Cuentas de Fondeo
              </h2>
            </div>
            {!editingAccount && (
              <Button
                type="button"
                size="sm"
                onClick={() => setEditingAccount(emptyAccount())}
                className="bg-primary text-primary-foreground hover:bg-gold-hover"
              >
                <Plus className="h-4 w-4 mr-1" /> Agregar Nueva Cuenta
              </Button>
            )}
          </div>

          {editingAccount && (
            <div className="border border-primary/30 bg-secondary/40 rounded-lg p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Empresa</Label>
                  <Input
                    value={editingAccount.company_name}
                    onChange={(e) =>
                      setEditingAccount({ ...editingAccount, company_name: e.target.value })
                    }
                    placeholder="FTMO, MyForexFunds, etc."
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Tamaño de Cuenta ($)</Label>
                  <Input
                    type="number"
                    value={editingAccount.account_size || ""}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        account_size: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="100000"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Fase Actual</Label>
                  <Select
                    value={editingAccount.phase}
                    onValueChange={(v) =>
                      setEditingAccount({ ...editingAccount, phase: v as FundingPhase })
                    }
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {PHASES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Profit Target (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingAccount.profit_target_pct || ""}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        profit_target_pct: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="8"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Daily Drawdown (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingAccount.daily_drawdown_pct || ""}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        daily_drawdown_pct: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="5"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Max Overall Drawdown (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingAccount.max_drawdown_pct || ""}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        max_drawdown_pct: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="10"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingAccount(null)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={saveAccount}
                  className="bg-primary text-primary-foreground hover:bg-gold-hover"
                >
                  <Save className="h-4 w-4 mr-1" /> Guardar Cuenta
                </Button>
              </div>
            </div>
          )}

          {form.funding_accounts.length === 0 && !editingAccount && (
            <p className="text-sm text-muted-foreground">
              Aún no tienes cuentas de fondeo. Crea la primera para empezar a trackear tu progreso.
            </p>
          )}

          {form.funding_accounts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {form.funding_accounts.map((a) => (
                <div
                  key={a.id}
                  className="relative bg-secondary/50 border border-border rounded-lg p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-heading font-semibold text-foreground">
                        {a.company_name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ${a.account_size.toLocaleString()} · {a.phase}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingAccount(a)}
                        className="text-muted-foreground hover:text-primary p-1"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteAccount(a.id)}
                        className="text-muted-foreground hover:text-red-400 p-1"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wide">
                    <div className="bg-background/60 border border-border rounded px-2 py-1.5">
                      <div className="text-muted-foreground">Target</div>
                      <div className="text-primary font-semibold text-sm normal-case">
                        {a.profit_target_pct}%
                      </div>
                    </div>
                    <div className="bg-background/60 border border-border rounded px-2 py-1.5">
                      <div className="text-muted-foreground">DD Diario</div>
                      <div className="text-red-400 font-semibold text-sm normal-case">
                        {a.daily_drawdown_pct}%
                      </div>
                    </div>
                    <div className="bg-background/60 border border-border rounded px-2 py-1.5">
                      <div className="text-muted-foreground">DD Max</div>
                      <div className="text-red-400 font-semibold text-sm normal-case">
                        {a.max_drawdown_pct}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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
            <Label className="text-muted-foreground text-sm">Pares / activos permitidos</Label>
            <TagInput
              values={form.allowed_pairs}
              onChange={(vals) => setForm((f) => ({ ...f, allowed_pairs: vals }))}
              placeholder="Escribe un activo (ej: EURUSD) y presiona Enter"
            />
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
