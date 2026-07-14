import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlanRules } from "@/types/compliance";
import { evaluateTradeCompliance } from "@/utils/complianceEngine";
import { cn } from "@/lib/utils";

interface CompliancePanelProps {
  plan: PlanRules | null;
  tradeData: Record<string, unknown>;
  customOverrides: Record<string, boolean>;
  onToggleCustomRule: (ruleId: string, value: boolean) => void;
}

const CompliancePanel = ({
  plan,
  tradeData,
  customOverrides,
  onToggleCustomRule,
}: CompliancePanelProps) => {
  const [open, setOpen] = useState(true);

  const compliance = useMemo(() => {
    if (!plan) return null;
    return evaluateTradeCompliance(
      { ...tradeData, custom_rule_overrides: customOverrides },
      plan
    );
  }, [plan, tradeData, customOverrides]);

  if (!plan) return null;

  const score = compliance?.score ?? 0;
  const scoreColor =
    score >= 80 ? "text-emerald-400" : score >= 50 ? "text-primary" : "text-red-400";

  return (
    <div className="rounded-lg border border-border bg-secondary/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Disciplina del Plan
          </span>
          <span className={cn("text-sm font-semibold ml-2", scoreColor)}>
            {score}/100
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && compliance && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {Object.entries(compliance.details).map(([key, detail]) => (
            <div
              key={key}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <span
                className={cn(
                  "flex-1",
                  detail.valid ? "text-emerald-400" : "text-muted-foreground"
                )}
              >
                {detail.valid ? "✓" : "✗"} {detail.message}
              </span>
            </div>
          ))}

          {plan.custom_rules.length > 0 && (
            <div className="pt-3 mt-2 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">
                Reglas personalizadas (marca manualmente lo cumplido):
              </p>
              {plan.custom_rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-3"
                >
                  <Label
                    htmlFor={`rule-${rule.id}`}
                    className="text-xs text-foreground cursor-pointer"
                  >
                    {rule.name}
                  </Label>
                  <Switch
                    id={`rule-${rule.id}`}
                    checked={customOverrides[rule.id] === true}
                    onCheckedChange={(v) => onToggleCustomRule(rule.id, v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompliancePanel;
