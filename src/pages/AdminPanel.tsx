import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { LogOut, ShieldCheck, CheckCircle2, XCircle, Trash2, UserCheck } from "lucide-react";

const ADMIN_EMAIL = "investingforfuture09121110@gmail.com";

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  status: string;
  created_at: string;
}

const isActive = (s: string) => s === "active" || s === "approved";

const AdminPanel = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    else if (!authLoading && user && user.email !== ADMIN_EMAIL) navigate("/");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) fetchProfiles();
  }, [user]);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, email, status, created_at")
      .order("created_at", { ascending: false });
    if (data) setProfiles(data);
    setLoading(false);
  };

  const handleApprove = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({ status: "active" }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Usuario activado" }); fetchProfiles(); }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: toDelete.user_id },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      toast({ title: "Usuario eliminado" });
      setToDelete(null);
      fetchProfiles();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "No se pudo eliminar", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user || user.email !== ADMIN_EMAIL) return null;

  const activos = profiles.filter((p) => isActive(p.status));
  const inactivos = profiles.filter((p) => !isActive(p.status));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight">Admin Panel</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Usuarios activos e inactivos por estado de suscripción.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 max-w-5xl space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Total usuarios" value={profiles.length} />
          <MetricCard label="Activos" value={activos.length} valueClassName="text-[hsl(var(--success))]" />
          <MetricCard label="Inactivos" value={inactivos.length} valueClassName="text-destructive" />
        </div>

        {/* Active users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
              Usuarios activos ({activos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activos.length === 0 && <p className="text-sm text-muted-foreground">No hay usuarios activos.</p>}
            {activos.map((p) => (
              <UserRow key={p.id} p={p} onDelete={() => setToDelete(p)} />
            ))}
          </CardContent>
        </Card>

        {/* Inactive users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-5 w-5 text-destructive" />
              Usuarios inactivos ({inactivos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inactivos.length === 0 && <p className="text-sm text-muted-foreground">No hay usuarios inactivos.</p>}
            {inactivos.map((p) => (
              <UserRow
                key={p.id}
                p={p}
                onApprove={() => handleApprove(p.user_id)}
                onDelete={() => setToDelete(p)}
              />
            ))}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{toDelete?.email}</strong> junto con todos sus
              journals y operaciones. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const MetricCard = ({ label, value, valueClassName = "" }: { label: string; value: number; valueClassName?: string }) => (
  <Card>
    <CardContent className="p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-4xl font-heading font-bold mt-2 ${valueClassName}`}>{value}</p>
    </CardContent>
  </Card>
);

const UserRow = ({
  p, onApprove, onDelete,
}: { p: Profile; onApprove?: () => void; onDelete: () => void }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{p.email || "Sin email"}</p>
      <p className="text-xs text-muted-foreground">
        Registrado: {new Date(p.created_at).toLocaleDateString()}
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant={isActive(p.status) ? "default" : "secondary"}>{p.status}</Badge>
      {onApprove && (
        <Button size="sm" onClick={onApprove}>
          <UserCheck className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Activar</span>
        </Button>
      )}
      <Button size="sm" variant="destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Eliminar</span>
      </Button>
    </div>
  </div>
);

export default AdminPanel;
