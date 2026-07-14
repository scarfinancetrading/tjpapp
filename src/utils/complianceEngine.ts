import { ComplianceData, ComplianceDetail, PlanRules } from "@/types/compliance";

// Parses "1:2", "1:2.5", "2", "2.5R" into a numeric R multiple.
const parseRiskReward = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[^0-9:.\-]/g, "").trim();
  if (!cleaned) return 0;
  if (cleaned.includes(":")) {
    const [a, b] = cleaned.split(":").map((n) => parseFloat(n));
    if (!isFinite(a) || !isFinite(b) || a === 0) return 0;
    return b / a;
  }
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
};

const parseNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const n = parseFloat(value.replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
};

const getField = (trade: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const k of keys) {
    if (trade[k] !== undefined && trade[k] !== null && trade[k] !== "") return trade[k];
  }
  return undefined;
};

export function evaluateTradeCompliance(
  tradeData: Record<string, unknown>,
  plan: PlanRules
): ComplianceData {
  const details: Record<string, ComplianceDetail> = {};

  const par = String(getField(tradeData, "par", "pair") ?? "").toUpperCase();
  const sesion = String(getField(tradeData, "sesion", "session") ?? "");
  const orden = String(getField(tradeData, "orden", "orderType") ?? "");
  const rr = parseRiskReward(getField(tradeData, "riskReward", "risk_reward"));
  const riesgo = parseNumber(getField(tradeData, "riesgo", "risk_percent"));

  // Pair
  if (plan.allowed_pairs.length > 0) {
    const valid = !!par && plan.allowed_pairs.map((p) => p.toUpperCase()).includes(par);
    details.pair = {
      valid,
      message: valid
        ? `Par ${par} permitido`
        : `Par ${par || "sin especificar"} no está en el plan`,
    };
  }

  // Session
  if (plan.allowed_sessions.length > 0) {
    const valid = !!sesion && plan.allowed_sessions.includes(sesion);
    details.session = {
      valid,
      message: valid
        ? `Sesión ${sesion} permitida`
        : `Sesión ${sesion || "sin especificar"} no está en el plan`,
    };
  }

  // Order type
  if (plan.allowed_order_types.length > 0) {
    const valid = !!orden && plan.allowed_order_types.includes(orden);
    details.order_type = {
      valid,
      message: valid
        ? `Tipo de orden ${orden} permitido`
        : `Tipo de orden ${orden || "sin especificar"} no está en el plan`,
    };
  }

  // Risk/Reward
  if (plan.min_risk_reward > 0) {
    const valid = rr >= plan.min_risk_reward;
    details.risk_reward = {
      valid,
      message: valid
        ? `R:R ${rr.toFixed(2)} cumple mínimo ${plan.min_risk_reward}`
        : `R:R ${rr.toFixed(2)} por debajo de mínimo ${plan.min_risk_reward}`,
    };
  }

  // Max risk %
  if (plan.max_risk_percent > 0) {
    const valid = riesgo > 0 && riesgo <= plan.max_risk_percent;
    details.max_risk = {
      valid,
      message: valid
        ? `Riesgo ${riesgo}% dentro del límite ${plan.max_risk_percent}%`
        : `Riesgo ${riesgo}% excede el máximo ${plan.max_risk_percent}%`,
    };
  }

  // Custom rules — default false, may be overridden by manual toggles
  // provided via `tradeData.custom_rule_overrides` (Record<ruleId, boolean>)
  const overrides = (tradeData.custom_rule_overrides ?? {}) as Record<string, boolean>;
  for (const rule of plan.custom_rules) {
    const key = `custom_${rule.id}`;
    const valid = overrides[rule.id] === true;
    details[key] = {
      valid,
      message: rule.name,
    };
  }

  const total = Object.keys(details).length;
  const passed = Object.values(details).filter((d) => d.valid).length;
  const score = total === 0 ? 100 : Math.round((passed / total) * 100);

  return { score, details };
}
