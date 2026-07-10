import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Calculator, ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";

const MainMenu = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading, profileStatus, profileLoading, isAdmin, refreshProfile } = useAuth();
  const hasAccess = isAdmin || profileStatus === "approved" || profileStatus === "active";

  const checkoutSuccess = searchParams.get("checkout") === "success";
  const checkoutSessionId = searchParams.get("session_id");
  const [verifying, setVerifying] = useState(checkoutSuccess && !!checkoutSessionId);

  // Verify Stripe checkout when returning from payment
  useEffect(() => {
    if (checkoutSuccess && checkoutSessionId && user && !authLoading) {
      (async () => {
        try {
          await supabase.functions.invoke("verify-checkout-session", { body: { sessionId: checkoutSessionId } });
          await refreshProfile();
          toast({ title: "¡Suscripción activada!", description: "Ya tienes acceso completo a la app." });
        } catch (err: any) {
          toast({ title: "Error al verificar el pago", description: err?.message ?? "", variant: "destructive" });
        } finally {
          setVerifying(false);
          setSearchParams({}, { replace: true });
        }
      })();
    }
  }, [checkoutSuccess, checkoutSessionId, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !profileLoading && !verifying && user && !hasAccess) {
      navigate("/");
    }
  }, [user, authLoading, profileLoading, verifying, hasAccess, navigate]);

  if (authLoading || profileLoading || verifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        {verifying && <p className="text-sm text-muted-foreground">Confirmando tu pago…</p>}
      </div>
    );
  }

  if (!user || !hasAccess) return null;

  const items = [
    { title: "Journal", description: "Registra y analiza tus operaciones de trading", icon: BookOpen, path: "/journals" },
    { title: "Calculadora de Lotaje", description: "Calcula el tamaño exacto de tu posición con precios en tiempo real", icon: Calculator, path: "/calculator" },
    { title: "Calendario Noticias", description: "Eventos económicos de Forex Factory e Investing.com con filtros", icon: CalendarDays, path: "/calendar" },
    ...(isAdmin ? [{ title: "Admin Panel", description: "Gestiona usuarios activos e inactivos", icon: ShieldCheck, path: "/admin-panel" }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 sm:px-6 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-heading font-bold text-foreground">
            Menú Principal
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Elige una herramienta para comenzar
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.path}
                onClick={() => navigate(item.path)}
                className="bg-card border-border hover:border-primary/60 transition-all cursor-pointer group hover:shadow-lg hover:shadow-primary/10"
              >
                <CardContent className="p-6 flex flex-col items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-heading font-semibold text-foreground">
                      {item.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    Abrir
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default MainMenu;