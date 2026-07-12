import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Calculator, CalendarDays, Check, LineChart, ShieldCheck, Sparkles, ArrowRight, LogOut,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Journal de Trading",
    description: "Registra cada operación con capturas, análisis de IA y estadísticas automáticas de win rate y P&L.",
  },
  {
    icon: Calculator,
    title: "Calculadora de Lotaje",
    description: "Calcula el tamaño exacto de tu posición con precios en tiempo real y control preciso del riesgo.",
  },
  {
    icon: CalendarDays,
    title: "Calendario de Noticias",
    description: "Eventos económicos de Forex Factory e Investing.com con filtros por impacto y divisa.",
  },
];

const bullets = [
  "Análisis inteligente de gráficos con IA (Google Gemini)",
  "Panel de estadísticas: win rate, R:R medio, drawdown y equity curve",
  "Copiloto IA con dictado por voz para registrar operaciones sin escribir",
  "Multi-journal para separar cuentas y estrategias",
  "Exportación a Excel optimizada",
  "Acceso instantáneo, cancela cuando quieras",
];

const Landing = () => {
  const navigate = useNavigate();
  const { user, hasAccess, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleChangeAccount = async () => {
    setLoading(true);
    await signOut();
    setLoading(false);
    navigate("/auth");
  };

  const handleSubscribe = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No se recibió la URL de pago");
      // Open in a new tab so it works inside the preview iframe / mobile browsers
      const win = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!win) {
        // Popup blocked → fall back to top-level navigation
        window.top ? (window.top.location.href = data.url) : (window.location.href = data.url);
      }
    } catch (err: any) {
      console.error("subscribe error", err);
      toast({ title: "Error", description: err?.message ?? "No se pudo iniciar el pago", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-bold tracking-tight">
              Trading Journal <span className="text-primary">Pro App</span>
            </h1>
            <p className="text-xs text-muted-foreground">by ScarFinance</p>
          </div>
          <div className="flex items-center gap-2">
            {hasAccess ? (
              <Button asChild size="sm"><Link to="/app">Ir a la app <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
            ) : user ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleChangeAccount} disabled={loading}>
                  <LogOut className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Cambiar cuenta</span>
                </Button>
                <Button size="sm" onClick={handleSubscribe} disabled={loading}>
                  {loading ? "Cargando…" : "Suscribirse"}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/auth">Iniciar sesión</Link></Button>
                <Button asChild size="sm"><Link to="/auth">Empezar</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="container mx-auto px-6 py-20 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary mb-6">
            <Sparkles className="h-3 w-3" /> Impulsado por IA
          </div>
          <h2 className="text-4xl md:text-6xl font-heading font-bold leading-tight tracking-tight">
            Domina tu <span className="text-primary">trading</span> con un journal profesional
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Registra, analiza y mejora cada operación. Todo lo que necesitas para operar con disciplina: journal inteligente,
            calculadora de lotaje y calendario de noticias — en una sola plataforma.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" onClick={handleSubscribe} disabled={loading} className="text-base px-8">
              {loading ? "Cargando…" : "Suscribirse por $29/mes"}
            </Button>
            {!user && (
              <Button asChild size="lg" variant="outline" className="text-base px-8">
                <Link to="/auth">Iniciar sesión</Link>
              </Button>
            )}
            {user && !hasAccess && (
              <Button size="lg" variant="outline" onClick={handleChangeAccount} disabled={loading} className="text-base px-8">
                Cambiar cuenta
              </Button>
            )}
            <span className="text-xs text-muted-foreground">Cancela cuando quieras · Pago seguro con Stripe</span>
          </div>
          {user && !hasAccess && (
            <p className="mt-4 text-xs text-muted-foreground">
              Sesión activa: <span className="text-foreground">{user.email}</span>. Si este no es tu email correcto, cambia de cuenta antes de suscribirte.
            </p>
          )}
        </section>

        {/* FEATURES */}
        <section className="container mx-auto px-6 py-16 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="border-border bg-card hover:border-primary/40 transition-colors">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-heading font-semibold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{f.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* PRICING */}
        <section className="container mx-auto px-6 py-20 max-w-2xl">
          <Card className="border-primary/50 bg-card shadow-xl shadow-primary/10">
            <CardContent className="p-8 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-primary uppercase tracking-widest font-semibold">
                <LineChart className="h-4 w-4" /> Plan Pro
              </div>
              <div className="mt-4">
                <span className="text-5xl font-heading font-bold">$29</span>
                <span className="text-muted-foreground">/mes</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Todo incluido. Sin comisiones ocultas.</p>

              <ul className="mt-8 space-y-3 text-left">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Button size="lg" onClick={handleSubscribe} disabled={loading} className="w-full mt-8 text-base">
                {loading ? "Cargando…" : "Suscribirse ahora"}
              </Button>
              {user && !hasAccess && (
                <Button variant="outline" onClick={handleChangeAccount} disabled={loading} className="w-full mt-3 text-base">
                  Cerrar sesión y usar otro email
                </Button>
              )}
              <p className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Pago seguro procesado por Stripe
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Trading Journal Pro App — ScarFinance
      </footer>
    </div>
  );
};

export default Landing;
