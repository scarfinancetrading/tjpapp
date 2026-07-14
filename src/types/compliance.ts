export interface CustomRule {
  id: string;
  name: string;
}

export interface PlanRules {
  allowed_pairs: string[];
  allowed_sessions: string[];
  allowed_order_types: string[];
  min_risk_reward: number;
  max_risk_percent: number;
  custom_rules: CustomRule[];
}

export interface ComplianceDetail {
  valid: boolean;
  message: string;
}

export interface ComplianceData {
  score: number;
  details: Record<string, ComplianceDetail>;
}

export const DEFAULT_PLAN_RULES: PlanRules = {
  allowed_pairs: [],
  allowed_sessions: [],
  allowed_order_types: [],
  min_risk_reward: 0,
  max_risk_percent: 0,
  custom_rules: [],
};
