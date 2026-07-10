import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2 } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, hasAccess, profileLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // Handle Stripe checkout return
  useEffect(() => {
    const status = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (status === "success" && sessionId && user) {
      (async () => {
        try {
          await supabase.functions.invoke("verify-checkout-session", { body: { sessionId } });
          await refreshProfile();
          toast({ title: "¡Suscripción activada!", description: "Ya tienes acceso completo." });
        } catch (err: any) {
          toast({ title: "Error al verificar el pago", description: err?.message ?? "", variant: "destructive" });
        }
      })();
    }
  }, [searchParams, user, refreshProfile, toast]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "No se pudo abrir el portal", variant: "destructive" });
    } finally { setPortalLoading(false); }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-10 max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-heading font-bold">Ajustes</h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
        </div>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" /> Suscripción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              Estado: <span className={hasAccess ? "text-primary font-semibold" : "text-muted-foreground"}>
                {hasAccess ? "Activa" : "Sin suscripción activa"}
              </span>
            </div>
            {hasAccess ? (
              <Button onClick={openPortal} disabled={portalLoading} variant="outline">
                {portalLoading ? "Cargando…" : "Gestionar suscripción"}
              </Button>
            ) : (
              <Button onClick={() => navigate("/")}>Suscribirse</Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
