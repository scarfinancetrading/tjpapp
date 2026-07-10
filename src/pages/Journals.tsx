import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useJournals } from "@/hooks/useJournals";
import { useTrades } from "@/hooks/useTrades";
import { FolderPlus, Folder, Trash2, ArrowRight } from "lucide-react";

const Journals = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, profileStatus, profileLoading } = useAuth();
  const { journals, loading: journalsLoading, createJournal, deleteJournal, assignTradesToJournal } = useJournals();
  const { trades: unassignedTrades, loading: tradesLoading, refetch: refetchUnassigned } = useTrades(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [commissionPerLot, setCommissionPerLot] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !profileLoading && user && profileStatus !== "approved") {
      navigate("/");
    }
  }, [user, authLoading, profileStatus, profileLoading, navigate]);

  if (authLoading || profileLoading || journalsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || profileStatus !== "approved") return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createJournal(name.trim(), Number(accountSize) || 0, Number(commissionPerLot) || 0);
    setName("");
    setAccountSize("");
    setCommissionPerLot("");
    setOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedTrades((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!assignTarget || selectedTrades.size === 0) return;
    await assignTradesToJournal(Array.from(selectedTrades), assignTarget);
    setSelectedTrades(new Set());
    setAssignTarget("");
    await refetchUnassigned();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-8 space-y-8 max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Mis Journals
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organiza tus operaciones por cuenta o estrategia
            </p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-gold-hover"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Nuevo Journal
          </Button>
        </div>

        {journals.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              Aún no tienes journals. Crea el primero para empezar a organizar tus operaciones.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {journals.map((j) => (
              <Card
                key={j.id}
                className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => navigate(`/journal/${j.id}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <Folder className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-heading text-foreground">
                      {j.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-loss opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(j.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Cuenta:{" "}
                    <span className="text-foreground font-medium">
                      ${Number(j.account_size).toLocaleString()}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!tradesLoading && unassignedTrades.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-heading text-foreground">
                Operaciones sin asignar ({unassignedTrades.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecciona operaciones y asígnalas a un journal para organizarlas.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={assignTarget} onValueChange={setAssignTarget}>
                  <SelectTrigger className="bg-secondary border-border w-64">
                    <SelectValue placeholder="Seleccionar journal destino" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {journals.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssign}
                  disabled={!assignTarget || selectedTrades.size === 0}
                  className="bg-primary text-primary-foreground hover:bg-gold-hover"
                >
                  Asignar {selectedTrades.size > 0 ? `(${selectedTrades.size})` : ""}
                </Button>
                {selectedTrades.size > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedTrades(new Set())}
                    className="border-border"
                  >
                    Limpiar selección
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    setSelectedTrades(new Set(unassignedTrades.map((t) => t.id)))
                  }
                  className="border-border"
                >
                  Seleccionar todas
                </Button>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Par</th>
                      <th className="px-3 py-2">Sesión</th>
                      <th className="px-3 py-2">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedTrades.map((t) => {
                      const r = Number(t.resultado);
                      return (
                        <tr key={t.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedTrades.has(t.id)}
                              onCheckedChange={() => toggleSelect(t.id)}
                            />
                          </td>
                          <td className="px-3 py-2">{t.fecha}</td>
                          <td className="px-3 py-2 text-primary">{t.par}</td>
                          <td className="px-3 py-2">{t.sesion}</td>
                          <td
                            className={`px-3 py-2 font-medium ${
                              r > 0 ? "text-success" : r < 0 ? "text-loss" : ""
                            }`}
                          >
                            {t.resultado ? `$${t.resultado}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-heading">
              Nuevo Journal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Journal Cuenta 25k"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Tamaño de la cuenta ($)</Label>
              <Input
                type="number"
                value={accountSize}
                onChange={(e) => setAccountSize(e.target.value)}
                placeholder="25000"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Comisión por Lote ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={commissionPerLot}
                onChange={(e) => setCommissionPerLot(e.target.value)}
                placeholder="7.00"
                className="bg-secondary border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="bg-primary text-primary-foreground hover:bg-gold-hover"
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar journal?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Las operaciones dentro de este journal no se eliminan, quedarán como "sin asignar".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingId) await deleteJournal(deletingId);
                setDeletingId(null);
              }}
              className="bg-loss text-white hover:bg-loss/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Journals;