import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, Maximize2, Trash2 } from "lucide-react";
import { Trade, TradeImageSummary } from "@/types/trade";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (trade: Trade) => void;
}

const TradeImageDialog = ({ trade, open, onOpenChange, onUpdated }: Props) => {
  const { user } = useAuth();
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"before" | "after">("before");
  const [fullscreen, setFullscreen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const beforeFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!trade || !open) return;
      setLoading(true);
      setBeforeUrl(null);
      setAfterUrl(null);
      try {
        if (trade.imageBeforePath) {
          const { data } = await supabase.storage
            .from("trade-images")
            .createSignedUrl(trade.imageBeforePath, 3600);
          if (!cancelled) setBeforeUrl(data?.signedUrl ?? null);
        }
        if (trade.imageAfterPath) {
          const { data } = await supabase.storage
            .from("trade-images")
            .createSignedUrl(trade.imageAfterPath, 3600);
          if (!cancelled) setAfterUrl(data?.signedUrl ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [trade, open]);

  const handleUploadAfter = async (file: File) => {
    if (!trade || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 8MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${crypto.randomUUID()}-after.${ext}`;
      const { error } = await supabase.storage
        .from("trade-images")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const updated: Trade = { ...trade, imageAfterPath: path };
      onUpdated(updated);
      const { data } = await supabase.storage.from("trade-images").createSignedUrl(path, 3600);
      setAfterUrl(data?.signedUrl ?? null);
      setActiveTab("after");
      toast.success("Imagen Después guardada");
    } catch (e: any) {
      toast.error("No se pudo subir: " + (e?.message ?? "error"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAfter = async () => {
    if (!trade?.imageAfterPath) return;
    await supabase.storage.from("trade-images").remove([trade.imageAfterPath]);
    onUpdated({ ...trade, imageAfterPath: null });
    setAfterUrl(null);
    setActiveTab("before");
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Imagen Después eliminada");
  };

  const removeBefore = async () => {
    if (!trade?.imageBeforePath) return;
    await supabase.storage.from("trade-images").remove([trade.imageBeforePath]);
    onUpdated({ ...trade, imageBeforePath: null, imageSummary: null });
    setBeforeUrl(null);
    if (trade.imageAfterPath) setActiveTab("after");
    if (fileRef.current) fileRef.current.value = "";
    if (beforeFileRef.current) beforeFileRef.current.value = "";
    toast.success("Imagen Antes eliminada");
  };

  const handleReplaceBefore = async (file: File) => {
    if (!trade || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 8MB");
      return;
    }
    setUploading(true);
    try {
      // Remove previous before image if present
      if (trade.imageBeforePath) {
        await supabase.storage.from("trade-images").remove([trade.imageBeforePath]);
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${crypto.randomUUID()}-before.${ext}`;
      const { error } = await supabase.storage
        .from("trade-images")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;

      // Analyze new image
      let newSummary: TradeImageSummary | null = null;
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        const { data, error: fnErr } = await supabase.functions.invoke("analyze-trade-image", {
          body: { imageDataUrl: dataUrl },
        });
        if (!fnErr) newSummary = (data?.data ?? null) as TradeImageSummary | null;
      } catch { /* ignore analyze errors */ }

      const updated: Trade = { ...trade, imageBeforePath: path, imageSummary: newSummary };
      onUpdated(updated);
      const { data: signed } = await supabase.storage.from("trade-images").createSignedUrl(path, 3600);
      setBeforeUrl(signed?.signedUrl ?? null);
      setActiveTab("before");
      toast.success("Imagen Antes reemplazada");
    } catch (e: any) {
      toast.error("No se pudo subir: " + (e?.message ?? "error"));
    } finally {
      setUploading(false);
      if (beforeFileRef.current) beforeFileRef.current.value = "";
    }
  };

  if (!trade) return null;

  const summary = trade.imageSummary;
  const currentUrl = activeTab === "before" ? beforeUrl : afterUrl;
  const hasAfter = !!trade.imageAfterPath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[96vw] max-w-4xl max-h-[92vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-foreground font-heading text-base sm:text-lg pr-10">
            Imagen de la operación · {trade.par || "—"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Button
            size="sm"
            variant={activeTab === "before" ? "default" : "outline"}
            onClick={() => setActiveTab("before")}
            disabled={!trade.imageBeforePath}
            className={activeTab === "before" ? "bg-primary text-primary-foreground" : ""}
          >
            Antes
          </Button>
          <Button
            size="sm"
            variant={activeTab === "after" ? "default" : "outline"}
            onClick={() => setActiveTab("after")}
            disabled={!hasAfter}
            className={activeTab === "after" ? "bg-primary text-primary-foreground" : ""}
          >
            Después
          </Button>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
            <input
              ref={beforeFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleReplaceBefore(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10 h-8 px-2 text-xs"
              onClick={() => beforeFileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />…</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-1" />Antes</>
              )}
            </Button>
            {trade.imageBeforePath && (
              <Button
                size="icon"
                variant="ghost"
                onClick={removeBefore}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Quitar Antes"
                title="Quitar Antes"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadAfter(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10 h-8 px-2 text-xs"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />…</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-1" />Después</>
              )}
            </Button>
            {hasAfter && (
              <Button
                size="icon"
                variant="ghost"
                onClick={removeAfter}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Quitar Después"
                title="Quitar Después"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {activeTab === "before" && summary && (
          <div className="mt-3 bg-card/85 border border-border rounded-md p-2 sm:p-3 text-[11px] sm:text-xs grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-2 gap-y-1">
            {summary.fecha && <Info k="Fecha" v={summary.fecha} />}
            {summary.par && <Info k="Par" v={summary.par} />}
            {summary.timeframe && <Info k="Timeframe" v={summary.timeframe} />}
            {summary.orden && <Info k="Orden" v={summary.orden} />}
            {summary.entrada && <Info k="Entrada" v={summary.entrada} />}
            {trade.riesgo && <Info k="% Riesgo" v={`${trade.riesgo}%`} />}
            {trade.estrategia && <Info k="Estrategia" v={trade.estrategia} />}
            {typeof summary.lotSize === "number" && <Info k="Lotaje" v={String(summary.lotSize)} />}
            {typeof summary.entryPrice === "number" && <Info k="Precio Entrada" v={String(summary.entryPrice)} />}
            {typeof summary.slPips === "number" && <Info k="SL" v={`${summary.slPips} pips`} />}
            {typeof summary.tpPips === "number" && <Info k="TP" v={`${summary.tpPips} pips`} />}
            {summary.riskReward && <Info k="R:R" v={summary.riskReward} />}
          </div>
        )}

        <div className="relative mt-3 rounded-lg overflow-hidden border border-border bg-black/30">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : currentUrl ? (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="block w-full group relative"
              aria-label="Ver imagen en pantalla completa"
            >
              <img src={currentUrl} alt={activeTab} className="w-full max-h-[55vh] sm:max-h-[60vh] object-contain bg-black/50" />
              <span className="absolute top-2 right-2 bg-black/60 text-white rounded-md p-1.5 opacity-80 group-hover:opacity-100">
                <Maximize2 className="h-4 w-4" />
              </span>
            </button>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              {activeTab === "before" ? "Sin imagen Antes" : "Aún no has subido la imagen Después"}
            </div>
          )}
        </div>

        {fullscreen && currentUrl && (
          <div
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setFullscreen(false)}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFullscreen(false); }}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
              aria-label="Cerrar pantalla completa"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={currentUrl}
              alt={activeTab}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Info = ({ k, v }: { k: string; v: string }) => (
  <div className="flex flex-col">
    <span className="text-muted-foreground text-[10px] uppercase tracking-wide">{k}</span>
    <span className="text-foreground font-medium truncate">{v}</span>
  </div>
);

export default TradeImageDialog;