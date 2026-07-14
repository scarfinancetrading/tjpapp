import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_PLAN_RULES, PlanRules } from "@/types/compliance";

interface TradingPlanRow {
  id: string;
  user_id: string;
  is_active: boolean;
  rules: PlanRules;
}

export const useTradingPlan = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<TradingPlanRow | null>(null);
  const [rules, setRules] = useState<PlanRules>(DEFAULT_PLAN_RULES);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!user) {
      setPlan(null);
      setRules(DEFAULT_PLAN_RULES);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: string) => {
            eq: (col: string, v: boolean) => {
              maybeSingle: () => Promise<{ data: TradingPlanRow | null; error: unknown }>;
            };
          };
        };
      };
    })
      .from("trading_plans")
      .select("id,user_id,is_active,rules")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data) {
      setPlan(data);
      setRules({ ...DEFAULT_PLAN_RULES, ...(data.rules as PlanRules) });
    } else {
      setPlan(null);
      setRules(DEFAULT_PLAN_RULES);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const savePlan = useCallback(
    async (newRules: PlanRules) => {
      if (!user) return { error: "No user" as const };
      const payload = {
        user_id: user.id,
        is_active: true,
        rules: newRules as unknown as Record<string, unknown>,
      };
      const client = supabase as unknown as {
        from: (t: string) => {
          upsert: (
            v: Record<string, unknown>,
            opts?: { onConflict?: string }
          ) => Promise<{ error: unknown }>;
        };
      };
      let error: unknown = null;
      if (plan) {
        const res = await (supabase as unknown as {
          from: (t: string) => {
            update: (v: Record<string, unknown>) => {
              eq: (c: string, v: string) => Promise<{ error: unknown }>;
            };
          };
        })
          .from("trading_plans")
          .update({ rules: newRules as unknown as Record<string, unknown> })
          .eq("id", plan.id);
        error = res.error;
      } else {
        const res = await client.from("trading_plans").upsert(payload);
        error = res.error;
      }
      await fetchPlan();
      return { error };
    },
    [user, plan, fetchPlan]
  );

  return { plan, rules, loading, savePlan, refetch: fetchPlan };
};
