import { useEffect, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Upload, Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trade, TradeImageSummary } from "@/types/trade";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TradeFormProps {
  onAddTrade: (trade: Trade) => void;
  accountSize?: number;
}

const TradeForm = ({ onAddTrade, accountSize }: TradeFormProps) => {
  const STORAGE_KEY = "tradeFormDraft";
  const { user } = useAuth();

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return null;
    }
  };
  const initial = loadDraft();

  const [fecha, setFecha] = useState<Date | undefined>(() => {
    if (initial?.fecha) {
      const d = parseISO(initial.fecha);
      if (isValid(d)) return d;
    }
    return undefined;
  });
  const [par, setPar] = useState(initial?.par ?? "");
  const [sesion, setSesion] = useState(initial?.sesion ?? "");
  const [estrategia, setEstrategia] = useState(initial?.estrategia ?? "");
  const [entrada, setEntrada] = useState(initial?.entrada ?? "");
  const [orden, setOrden] = useState(initial?.orden ?? "");
  const [riskReward, setRiskReward] = useState(initial?.riskReward ?? "");
  const [riesgo, setRiesgo] = useState(initial?.riesgo ?? "");
  const [stopLoss, setStopLoss] = useState(initial?.stopLoss ?? "");
  const [lotaje, setLotaje] = useState(initial?.lotaje ?? "");
  const [resultado, setResultado] = useState(initial?.resultado ?? "");
  const [salidaOperacion, setSalidaOperacion] = useState(initial?.salidaOperacion ?? "");

  // Image upload state (optional MT5 "Antes" image)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageSummary, setImageSummary] = useState<TradeImageSummary | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoFilledRef = useRef<Set<string>>(new Set());

  const isResetting = useRef(false);

  // Persist draft on any change
  useEffect(() => {
    if (isResetting.current) {
      isResetting.current = false;
      return;
    }
    const draft = {
      fecha: fecha && isValid(fecha) ? fecha.toISOString() : "",
      par,
      sesion,
      estrategia,
      entrada,
      orden,
      riskReward,
      riesgo,
      stopLoss,
      lotaje,
      resultado,
      salidaOperacion,
    };
    const hasAny = Object.values(draft).some((v) => v && v !== "");
    if (hasAny) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [fecha, par, sesion, estrategia, entrada, orden, riskReward, riesgo, stopLoss, lotaje, resultado, salidaOperacion]);

  const resetForm = () => {
    isResetting.current = true;
    setFecha(undefined);
    setPar("");
    setSesion("");
    setEstrategia("");
    setEntrada("");
    setOrden("");
    setRiskReward("");
    setRiesgo("");
    setStopLoss("");
    setLotaje("");
    setResultado("");
    setSalidaOperacion("");
    setImageFile(null);
    setImagePreview(null);
    setImageSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    localStorage.removeItem(STORAGE_KEY);
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const handleImageSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 8MB");
      return;
    }
    setImageFile(file);
    const dataUrl = await fileToDataUrl(file);
    setImagePreview(dataUrl);

    // Analyze with AI
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-trade-image", {
        body: { imageDataUrl: dataUrl, accountSize: accountSize ?? null },
      });
      if (error) throw error;
      const summary: TradeImageSummary = data?.data ?? {};
      setImageSummary(summary);

      // Autopopulate fields (track which were filled to allow clearing them later)
      autoFilledRef.current = new Set();
      if (summary.fecha) {
        try {
          const parts = summary.fecha.split("/").map((n) => parseInt(n, 10));
          if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
            const [m, d, y] = parts;
            setFecha(new Date(y, m - 1, d));
            autoFilledRef.current.add("fecha");
          }
        } catch { /* ignore */ }
      }
      if (summary.par) { setPar(summary.par); autoFilledRef.current.add("par"); }
      if (summary.entrada) { setEntrada(summary.entrada); autoFilledRef.current.add("entrada"); }
      if (summary.orden) { setOrden(summary.orden); autoFilledRef.current.add("orden"); }
      if (summary.riskReward) { setRiskReward(summary.riskReward); autoFilledRef.current.add("riskReward"); }
      if (typeof summary.slPips === "number" && summary.slPips > 0) {
        setStopLoss(String(summary.slPips));
        autoFilledRef.current.add("stopLoss");
      }
      if (typeof summary.lotSize === "number" && summary.lotSize > 0) {
        setLotaje(String(summary.lotSize));
        autoFilledRef.current.add("lotaje");
      }
      if (typeof summary.riesgoPct === "number" && summary.riesgoPct > 0) {
        setRiesgo(String(summary.riesgoPct));
        autoFilledRef.current.add("riesgo");
      }
      if (summary.sesion) {
        setSesion(summary.sesion);
        autoFilledRef.current.add("sesion");
      }
      toast.success("Imagen analizada. Revisa los datos autocompletados.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "No se pudo analizar la imagen");
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // Clear fields that were autopopulated from the image
    const filled = autoFilledRef.current;
    if (filled.has("fecha")) setFecha(undefined);
    if (filled.has("par")) setPar("");
    if (filled.has("entrada")) setEntrada("");
    if (filled.has("orden")) setOrden("");
    if (filled.has("riskReward")) setRiskReward("");
    if (filled.has("stopLoss")) setStopLoss("");
    if (filled.has("lotaje")) setLotaje("");
    if (filled.has("riesgo")) setRiesgo("");
    if (filled.has("sesion")) setSesion("");
    autoFilledRef.current = new Set();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let uploadedPath: string | null = null;
    if (imageFile && user) {
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${crypto.randomUUID()}-before.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("trade-images")
        .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
      if (upErr) {
        toast.error("No se pudo subir la imagen: " + upErr.message);
        return;
      }
      uploadedPath = path;
    }

    const trade: Trade = {
      id: crypto.randomUUID(),
      fecha: fecha ? format(fecha, "M/d/yyyy") : "",
      par,
      sesion,
      estrategia,
      entrada,
      orden,
      riskReward,
      riesgo,
      stopLoss,
      lotaje,
      resultado,
      salidaOperacion,
      imageBeforePath: uploadedPath,
      imageAfterPath: null,
      imageSummary: imageSummary,
    };
    onAddTrade(trade);
    resetForm();
    toast.success("Operación añadida correctamente");
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-6">
      <h2 className="text-lg font-heading font-semibold text-foreground">
        Nueva Operación
      </h2>

      {/* Optional MT5 image upload (Antes) */}
      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-foreground font-medium text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              Análisis con IA (opcional)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sube tu captura de MetaTrader 5 (Antes) y autocompletaremos Fecha, Par, Entrada, Orden, R:R y SL en pips.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageSelect(f);
            }}
          />
          {!imagePreview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
            >
              {analyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Subir imagen Antes</>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearImage}
              disabled={analyzing}
            >
              <X className="h-4 w-4 mr-2" /> Quitar
            </Button>
          )}
        </div>
        {imagePreview && (
          <div className="flex gap-3 flex-wrap items-start">
            <img
              src={imagePreview}
              alt="MT5 antes"
              className="h-24 rounded-md border border-border object-cover"
            />
            {analyzing && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizando con IA…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Fecha */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Fecha</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal bg-secondary border-border",
                  !fecha && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fecha ? format(fecha, "M/d/yyyy") : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
              <Calendar
                mode="single"
                selected={fecha}
                onSelect={setFecha}
                locale={es}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Par */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Par</Label>
          <Input
            value={par}
            onChange={(e) => setPar(e.target.value)}
            placeholder="EURUSD"
            className="bg-secondary border-border"
          />
        </div>

        {/* Sesión */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Sesión</Label>
          <Select value={sesion} onValueChange={setSesion}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="Londres">Londres</SelectItem>
              <SelectItem value="New York">New York</SelectItem>
              <SelectItem value="Asia">Asia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Estrategia */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Estrategia</Label>
          <Input
            value={estrategia}
            onChange={(e) => setEstrategia(e.target.value)}
            placeholder="Nombre de estrategia"
            className="bg-secondary border-border"
          />
        </div>

        {/* Entrada */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Entrada</Label>
          <Input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="Order Block al 75%"
            className="bg-secondary border-border"
          />
        </div>

        {/* Orden */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Orden</Label>
          <Select value={orden} onValueChange={setOrden}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="Buy">Buy</SelectItem>
              <SelectItem value="Sell">Sell</SelectItem>
              <SelectItem value="Buy Limit">Buy Limit</SelectItem>
              <SelectItem value="Sell Limit">Sell Limit</SelectItem>
              <SelectItem value="Buy Stop">Buy Stop</SelectItem>
              <SelectItem value="Sell Stop">Sell Stop</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Risk Reward */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Risk Reward Ratio</Label>
          <Input
            value={riskReward}
            onChange={(e) => setRiskReward(e.target.value)}
            placeholder="1:2"
            className="bg-secondary border-border"
          />
        </div>

        {/* % Riesgo */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">% Riesgo</Label>
          <Input
            type="number"
            step="0.01"
            value={riesgo}
            onChange={(e) => setRiesgo(e.target.value)}
            placeholder="1.00"
            className="bg-secondary border-border"
          />
        </div>

        {/* Stop Loss */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Stop Loss (Pips)</Label>
          <Input
            type="number"
            step="0.1"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="15.0"
            className="bg-secondary border-border"
          />
        </div>

        {/* Lotaje */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Lotaje</Label>
          <Input
            type="number"
            step="0.01"
            value={lotaje}
            onChange={(e) => setLotaje(e.target.value)}
            placeholder="0.10"
            className="bg-secondary border-border"
          />
        </div>

        {/* Resultado */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Resultado ($)</Label>
          <Input
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            placeholder="-50.00"
            className="bg-secondary border-border"
          />
        </div>

        {/* Salida Operación */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-sm">Salida Operación</Label>
          <Select value={salidaOperacion} onValueChange={setSalidaOperacion}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="Take Profit">Take Profit</SelectItem>
              <SelectItem value="Stop Loss">Stop Loss</SelectItem>
              <SelectItem value="Break Even">Break Even</SelectItem>
              <SelectItem value="Parciales">Parciales</SelectItem>
              <SelectItem value="Cierre Manual">Cierre Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-gold-hover font-semibold px-8 py-2.5 text-sm"
      >
        Añadir Operación
      </Button>
    </form>
  );
};

export default TradeForm;
