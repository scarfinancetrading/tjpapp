import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Journal {
  id: string;
  name: string;
  account_size: number;
  commission_per_lot: number;
  created_at: string;
}

export const useJournals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJournals = async () => {
    if (!user) {
      setJournals([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("journals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setJournals(
        (data || []).map((j: any) => ({
          id: j.id,
          name: j.name,
          account_size: Number(j.account_size) || 0,
          commission_per_lot: Number(j.commission_per_lot) || 0,
          created_at: j.created_at,
        }))
      );
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron cargar los journals", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, [user]);

  const createJournal = async (name: string, account_size: number, commission_per_lot: number = 0) => {
    if (!user) return;
    const { error } = await supabase
      .from("journals")
      .insert({ user_id: user.id, name, account_size, commission_per_lot });
    if (error) {
      toast({ title: "Error", description: "No se pudo crear el journal", variant: "destructive" });
      return;
    }
    await fetchJournals();
    toast({ title: "Journal creado", description: `"${name}" se creó correctamente` });
  };

  const updateJournal = async (id: string, updates: Partial<{ name: string; account_size: number; commission_per_lot: number }>) => {
    const { error } = await supabase.from("journals").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Error", description: "No se pudo actualizar el journal", variant: "destructive" });
      return;
    }
    await fetchJournals();
  };

  const deleteJournal = async (id: string) => {
    const { error } = await supabase.from("journals").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar el journal", variant: "destructive" });
      return;
    }
    await fetchJournals();
    toast({ title: "Journal eliminado" });
  };

  const assignTradesToJournal = async (tradeIds: string[], journalId: string | null) => {
    if (tradeIds.length === 0) return;
    const { error } = await supabase
      .from("trades")
      .update({ journal_id: journalId })
      .in("id", tradeIds);
    if (error) {
      toast({ title: "Error", description: "No se pudieron asignar las operaciones", variant: "destructive" });
      return;
    }
    toast({
      title: "Operaciones asignadas",
      description: `${tradeIds.length} operación(es) actualizadas`,
    });
  };

  return { journals, loading, createJournal, updateJournal, deleteJournal, assignTradesToJournal, refetch: fetchJournals };
};