import { useEffect, useRef, useState } from "react";
import { Sparkles, Mic, MicOff, Loader2, Send, X, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Trade } from "@/types/trade";
import { toast } from "sonner";

interface ParsedTrade {
  fecha: string;
  par: string;
  sesion: string;
  estrategia: string;
  entrada: string;
  orden: string;
  riskReward: string;
  riesgo: string;
  stopLoss: string;
  lotaje: string;
  resultado: string;
  salidaOperacion: string;
}

interface AICopilotDrawerProps {
  onAddTrade: (trade: Trade) => Promise<void> | void;
}

const SESIONES = ["Londres", "New York", "Asia"];
const ORDENES = ["Buy", "Sell", "Buy Limit", "Sell Limit", "Buy Stop", "Sell Stop"];
const SALIDAS = ["Take Profit", "Stop Loss", "Break Even", "Parciales", "Cierre Manual"];

const AICopilotDrawer = ({ onAddTrade }: AICopilotDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ParsedTrade | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const speechSupported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof (window as any).MediaRecorder !== "undefined";

  const cleanupRecorder = () => {
    try { recorderRef.current?.stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    recorderRef.current = null;
    streamRef.current = null;
  };

  const stopListening = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* noop */ }
    } else {
      cleanupRecorder();
      setListening(false);
    }
  };

  useEffect(() => {
    return () => {
      cleanupRecorder();
    };
  }, []);

  const transcribeBlob = async (blob: Blob, mime: string) => {
    setTranscribing(true);
    try {
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
      const form = new FormData();
      form.append("file", new File([blob], `recording.${ext}`, { type: mime }));
      const { data, error } = await supabase.functions.invoke("copilot-transcribe", { body: form });
      if (error) {
        let msg = "No se pudo transcribir el audio";
        try {
          const ctx = await (error as any).context?.text?.();
          if (ctx) msg = JSON.parse(ctx)?.error ?? msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      const transcript: string = data?.text ?? "";
      if (transcript.trim()) {
        setText((prev) => (prev ? prev.trimEnd() + " " : "") + transcript.trim());
      } else {
        toast.error("No se detectó voz en la grabación");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Error al transcribir");
    } finally {
      setTranscribing(false);
    }
  };

  const toggleMic = async () => {
    if (listening) {
      stopListening();
      return;
    }
    if (!speechSupported) {
      toast.error("Tu navegador no soporta grabación de audio");
      return;
    }
    const inIframe = typeof window !== "undefined" && window.self !== window.top;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (inIframe) {
        toast.error("El micrófono está bloqueado en la vista previa. Abre la app en una pestaña nueva.", {
          action: {
            label: "Abrir",
            onClick: () => window.open(window.location.href, "_blank", "noopener"),
          },
          duration: 8000,
        });
      } else if (err?.name === "NotAllowedError") {
        toast.error("Permiso denegado. Toca el candado 🔒 en la barra de direcciones → Permisos → Micrófono → Permitir, y recarga.", { duration: 8000 });
      } else if (err?.name === "NotFoundError") {
        toast.error("No se encontró micrófono");
      } else if (err?.name === "NotReadableError") {
        toast.error("El micrófono está siendo usado por otra app");
      } else {
        toast.error("No se pudo acceder al micrófono");
      }
      return;
    }
    streamRef.current = stream;

    const preferred = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    const mimeType = preferred.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      cleanupRecorder();
      setListening(false);
      if (blob.size < 1024) {
        toast.error("Grabación demasiado corta, intenta de nuevo");
        return;
      }
      await transcribeBlob(blob, type);
    };
    recorder.onerror = () => {
      toast.error("Error durante la grabación");
      cleanupRecorder();
      setListening(false);
    };
    recorderRef.current = recorder;
    recorder.start();
    setListening(true);
  };

  const analyze = async () => {
    if (!text.trim()) {
      toast.error("Escribe o dicta los detalles de tu operación primero");
      return;
    }
    stopListening();
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-parse-trade", {
        body: { text: text.trim() },
      });
      if (error) {
        let msg = "No se pudo procesar el texto";
        try {
          const ctx = await (error as any).context?.text?.();
          if (ctx) msg = JSON.parse(ctx)?.error ?? msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setPreview(data.data as ParsedTrade);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al analizar el texto");
    } finally {
      setAnalyzing(false);
    }
  };

  const updatePreview = (field: keyof ParsedTrade, value: string) => {
    setPreview((p) => (p ? { ...p, [field]: value } : p));
  };

  const confirm = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await onAddTrade({
        id: "",
        fecha: preview.fecha,
        par: preview.par,
        sesion: preview.sesion,
        estrategia: preview.estrategia,
        entrada: preview.entrada,
        orden: preview.orden,
        riskReward: preview.riskReward,
        riesgo: preview.riesgo,
        stopLoss: preview.stopLoss,
        lotaje: preview.lotaje,
        resultado: preview.resultado,
        salidaOperacion: preview.salidaOperacion,
      });
      toast.success("¡Operación añadida con éxito!");
      setPreview(null);
      setText("");
      setOpen(false);
    } catch {
      toast.error("No se pudo guardar la operación");
    } finally {
      setSaving(false);
    }
  };

  const cancelPreview = () => setPreview(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) stopListening();
    setOpen(next);
  };

  return (
    <>
      {/* Floating trigger */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 rounded-full px-5 shadow-lg shadow-primary/30 bg-primary text-primary-foreground hover:bg-gold-hover gap-2"
        aria-label="Abrir Copiloto IA"
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-semibold hidden sm:inline">Copiloto IA</span>
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto border-l border-border/60 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 font-heading">
              <Sparkles className="h-5 w-5 text-primary" />
              Copiloto IA
            </SheetTitle>
            <SheetDescription>
              Dicta o escribe tu operación y la IA rellenará los campos por ti. 100% opcional al formulario manual.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Input area */}
            <div className="relative rounded-xl border border-border/60 bg-secondary/50 backdrop-blur-sm p-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='Ej: "Hoy hice una compra en EURUSD en sesión de Londres con Silver Bullet, entrada en Order Block al 75%, ratio 1 a 2, riesgo 1%, stop de 15 pips, lotaje 0.10, me sacó el stop y perdí 50 dólares."'
                className="min-h-[130px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm pr-2"
                disabled={analyzing || transcribing}
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!speechSupported || analyzing || transcribing}
                  aria-label={listening ? "Detener grabación" : "Grabar por voz"}
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300 disabled:opacity-40",
                    listening
                      ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/40"
                      : "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-gold-hover"
                  )}
                >
                  {listening && (
                    <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-40" />
                  )}
                  {transcribing ? <Loader2 className="h-5 w-5 relative animate-spin" /> : listening ? <MicOff className="h-5 w-5 relative" /> : <Mic className="h-5 w-5 relative" />}
                </button>
                <div className="flex items-center gap-2">
                  {text && (
                    <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={analyzing || transcribing}>
                      <X className="h-4 w-4 mr-1" /> Limpiar
                    </Button>
                  )}
                  <Button size="sm" onClick={analyze} disabled={analyzing || transcribing || !text.trim()} className="bg-primary text-primary-foreground hover:bg-gold-hover">
                    {analyzing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    {analyzing ? "Analizando…" : "Analizar"}
                  </Button>
                </div>
              </div>
              {listening && (
                <p className="text-xs text-primary mt-2 animate-pulse">🎙️ Grabando… pulsa el botón para detener</p>
              )}
              {transcribing && (
                <p className="text-xs text-muted-foreground mt-2">Transcribiendo audio…</p>
              )}
              {!speechSupported && (
                <p className="text-xs text-muted-foreground mt-2">
                  Tu navegador no soporta grabación de audio; puedes escribir el texto.
                </p>
              )}
            </div>

            {/* Preview card */}
            {preview && (
              <div className="rounded-xl border border-primary/40 bg-secondary/40 backdrop-blur-sm p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <h3 className="font-heading font-semibold text-sm">Revisa y confirma tu operación</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fecha</Label>
                    <Input value={preview.fecha} onChange={(e) => updatePreview("fecha", e.target.value)} className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Par</Label>
                    <Input value={preview.par} onChange={(e) => updatePreview("par", e.target.value.toUpperCase())} className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Sesión</Label>
                    <Select value={preview.sesion || undefined} onValueChange={(v) => updatePreview("sesion", v)}>
                      <SelectTrigger className="h-9 bg-background/60"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {SESIONES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Estrategia</Label>
                    <Input value={preview.estrategia} onChange={(e) => updatePreview("estrategia", e.target.value)} className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground">Entrada</Label>
                    <Input value={preview.entrada} onChange={(e) => updatePreview("entrada", e.target.value)} className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Orden</Label>
                    <Select value={preview.orden || undefined} onValueChange={(v) => updatePreview("orden", v)}>
                      <SelectTrigger className="h-9 bg-background/60"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {ORDENES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Risk Reward</Label>
                    <Input value={preview.riskReward} onChange={(e) => updatePreview("riskReward", e.target.value)} placeholder="1:2" className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">% Riesgo</Label>
                    <Input value={preview.riesgo} onChange={(e) => updatePreview("riesgo", e.target.value)} placeholder="1.00" className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Stop Loss (Pips)</Label>
                    <Input value={preview.stopLoss} onChange={(e) => updatePreview("stopLoss", e.target.value)} placeholder="15.0" className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Lotaje</Label>
                    <Input value={preview.lotaje} onChange={(e) => updatePreview("lotaje", e.target.value)} placeholder="0.10" className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Resultado ($)</Label>
                    <Input value={preview.resultado} onChange={(e) => updatePreview("resultado", e.target.value)} placeholder="-50.00" className="h-9 bg-background/60" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground">Salida Operación</Label>
                    <Select value={preview.salidaOperacion || undefined} onValueChange={(v) => updatePreview("salidaOperacion", v)}>
                      <SelectTrigger className="h-9 bg-background/60"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {SALIDAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={confirm}
                    disabled={saving}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-gold-hover font-semibold"
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Confirmar y Añadir Operación
                  </Button>
                  <Button variant="outline" onClick={cancelPreview} disabled={saving}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AICopilotDrawer;
