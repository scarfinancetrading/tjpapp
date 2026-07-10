import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import TradeForm from "@/components/TradeForm";
import AICopilotDrawer from "@/components/AICopilotDrawer";
import TradeTable from "@/components/TradeTable";
import TradingStats from "@/components/TradingStats";
import { useAuth } from "@/hooks/useAuth";
import { useTrades } from "@/hooks/useTrades";
import { useJournals } from "@/hooks/useJournals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Pencil } from "lucide-react";

const Index = () => {
  const { user, loading: authLoading, profileStatus, profileLoading } = useAuth();
  const navigate = useNavigate();
  const { journalId } = useParams<{ journalId: string }>();
  const { journals, loading: journalsLoading, updateJournal } = useJournals();
  const currentJournal = useMemo(
    () => journals.find((j) => j.id === journalId),
    [journals, journalId]
  );
  const { trades, loading: tradesLoading, addTrade, editTrade, deleteTrade } = useTrades(journalId ?? undefined);

  const [editingSize, setEditingSize] = useState(false);
  const [sizeDraft, setSizeDraft] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !profileLoading && user && profileStatus !== "approved") {
      navigate("/");
    }
  }, [user, authLoading, profileStatus, profileLoading, navigate]);

  useEffect(() => {
    if (!journalId && user && profileStatus === "approved") {
      navigate("/journals", { replace: true });
    }
  }, [journalId, user, profileStatus, navigate]);

  useEffect(() => {
    if (!journalsLoading && journalId && !currentJournal) {
      navigate("/journals", { replace: true });
    }
  }, [journalsLoading, journalId, currentJournal, navigate]);

  if (authLoading || tradesLoading || profileLoading || journalsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || profileStatus !== "approved" || !currentJournal) {
    return null;
  }

  const handleSaveSize = async () => {
    await updateJournal(currentJournal.id, { account_size: Number(sizeDraft) || 0 });
    setEditingSize(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 space-y-8 max-w-7xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/journals">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Journals
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">
                {currentJournal.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Tamaño de cuenta:</span>
                {editingSize ? (
                  <>
                    <Input
                      type="number"
                      value={sizeDraft}
                      onChange={(e) => setSizeDraft(e.target.value)}
                      className="h-8 w-32 bg-secondary border-border"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveSize} className="h-8 bg-primary text-primary-foreground hover:bg-gold-hover">
                      <Save className="h-3 w-3 mr-1" />
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSize(false)} className="h-8">
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-primary">
                      ${Number(currentJournal.account_size).toLocaleString()}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setSizeDraft(String(currentJournal.account_size));
                        setEditingSize(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <TradeForm onAddTrade={addTrade} accountSize={Number(currentJournal.account_size)} />
        <AICopilotDrawer onAddTrade={addTrade} />
        <TradingStats
          trades={trades}
          accountSize={Number(currentJournal.account_size)}
          commissionPerLot={Number(currentJournal.commission_per_lot) || 0}
        />
        <TradeTable
          trades={trades}
          onEditTrade={editTrade}
          onDeleteTrade={deleteTrade}
          commissionPerLot={Number(currentJournal.commission_per_lot) || 0}
        />
      </main>
    </div>
  );
};

export default Index;
