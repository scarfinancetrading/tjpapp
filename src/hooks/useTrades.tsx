import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trade } from "@/types/trade";
import { useToast } from "@/hooks/use-toast";

export const useTrades = (journalId?: string | null) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch trades from database
  const fetchTrades = async () => {
    if (!user) {
      setTrades([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTrades([]);
    try {
      let query = supabase
        .from("trades")
        .select("*")
        .order("created_at", { ascending: false });
      if (journalId === null) {
        query = query.is("journal_id", null);
      } else if (typeof journalId === "string") {
        query = query.eq("journal_id", journalId);
      }
      const { data, error } = await query;

      if (error) throw error;

      const formattedTrades: Trade[] = (data || []).map((trade) => ({
        id: trade.id,
        fecha: trade.fecha || "",
        par: trade.par || "",
        sesion: trade.sesion || "",
        estrategia: trade.estrategia || "",
        entrada: trade.entrada || "",
        orden: trade.orden || "",
        riskReward: trade.risk_reward || "",
        riesgo: trade.riesgo || "",
        stopLoss: trade.stop_loss || "",
        lotaje: (trade as any).lotaje || "",
        resultado: trade.resultado || "",
        salidaOperacion: trade.salida_operacion || "",
        imageBeforePath: (trade as any).image_before_path ?? null,
        imageAfterPath: (trade as any).image_after_path ?? null,
        imageSummary: (trade as any).image_summary ?? null,
        complianceData: (trade as any).compliance_data ?? null,
      }));

      setTrades(formattedTrades);
    } catch (error: any) {
      console.error("Error fetching trades:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las operaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [user, journalId]);

  const addTrade = async (trade: Trade) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("trades").insert({
        user_id: user.id,
        journal_id: journalId ?? null,
        fecha: trade.fecha,
        par: trade.par,
        sesion: trade.sesion,
        estrategia: trade.estrategia,
        entrada: trade.entrada,
        orden: trade.orden,
        risk_reward: trade.riskReward,
        riesgo: trade.riesgo,
        stop_loss: trade.stopLoss,
        lotaje: trade.lotaje,
        resultado: trade.resultado,
        salida_operacion: trade.salidaOperacion,
        image_before_path: trade.imageBeforePath ?? null,
        image_after_path: trade.imageAfterPath ?? null,
        image_summary: (trade.imageSummary ?? null) as any,
        compliance_data: (trade.complianceData ?? null) as any,
      } as any);

      if (error) throw error;

      await fetchTrades();
      toast({
        title: "Operación agregada",
        description: "La operación se guardó correctamente",
      });
    } catch (error: any) {
      console.error("Error adding trade:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la operación",
        variant: "destructive",
      });
    }
  };

  const editTrade = async (updatedTrade: Trade) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("trades")
        .update({
          fecha: updatedTrade.fecha,
          par: updatedTrade.par,
          sesion: updatedTrade.sesion,
          estrategia: updatedTrade.estrategia,
          entrada: updatedTrade.entrada,
          orden: updatedTrade.orden,
          risk_reward: updatedTrade.riskReward,
          riesgo: updatedTrade.riesgo,
          stop_loss: updatedTrade.stopLoss,
          lotaje: updatedTrade.lotaje,
          resultado: updatedTrade.resultado,
          salida_operacion: updatedTrade.salidaOperacion,
          image_before_path: updatedTrade.imageBeforePath ?? null,
          image_after_path: updatedTrade.imageAfterPath ?? null,
          image_summary: (updatedTrade.imageSummary ?? null) as any,
        })
        .eq("id", updatedTrade.id);

      if (error) throw error;

      await fetchTrades();
      toast({
        title: "Operación actualizada",
        description: "Los cambios se guardaron correctamente",
      });
    } catch (error: any) {
      console.error("Error updating trade:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la operación",
        variant: "destructive",
      });
    }
  };

  const deleteTrade = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("trades").delete().eq("id", id);

      if (error) throw error;

      await fetchTrades();
      toast({
        title: "Operación eliminada",
        description: "La operación se eliminó correctamente",
      });
    } catch (error: any) {
      console.error("Error deleting trade:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la operación",
        variant: "destructive",
      });
    }
  };

  return {
    trades,
    loading,
    addTrade,
    editTrade,
    deleteTrade,
    refetch: fetchTrades,
  };
};
