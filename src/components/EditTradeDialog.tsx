import { useState, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Trade } from "@/types/trade";

interface EditTradeDialogProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (trade: Trade) => void;
}

const EditTradeDialog = ({ trade, open, onOpenChange, onSave }: EditTradeDialogProps) => {
  const [fecha, setFecha] = useState<Date | undefined>();
  const [par, setPar] = useState("");
  const [sesion, setSesion] = useState("");
  const [estrategia, setEstrategia] = useState("");
  const [entrada, setEntrada] = useState("");
  const [orden, setOrden] = useState("");
  const [riskReward, setRiskReward] = useState("");
  const [riesgo, setRiesgo] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [lotaje, setLotaje] = useState("");
  const [resultado, setResultado] = useState("");
  const [salidaOperacion, setSalidaOperacion] = useState("");

  useEffect(() => {
    if (trade) {
      // Parse date from M/d/yyyy format (matches how we save it)
      if (trade.fecha) {
        try {
          let parsedDate = parse(trade.fecha, "M/d/yyyy", new Date());
          if (!isValid(parsedDate)) {
            parsedDate = parse(trade.fecha, "d/M/yyyy", new Date());
          }
          setFecha(isValid(parsedDate) ? parsedDate : undefined);
        } catch {
          setFecha(undefined);
        }
      } else {
        setFecha(undefined);
      }
      setPar(trade.par);
      setSesion(trade.sesion);
      setEstrategia(trade.estrategia);
      setEntrada(trade.entrada);
      setOrden(trade.orden);
      setRiskReward(trade.riskReward);
      setRiesgo(trade.riesgo);
      setStopLoss(trade.stopLoss);
      setLotaje(trade.lotaje ?? "");
      setResultado(trade.resultado);
      setSalidaOperacion(trade.salidaOperacion);
    }
  }, [trade]);

  const handleSave = () => {
    if (!trade) return;
    
    const updatedTrade: Trade = {
      ...trade,
      fecha: fecha && isValid(fecha) ? format(fecha, "M/d/yyyy") : "",
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
    onSave(updatedTrade);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-heading font-semibold text-foreground">
            Editar Operación
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          {/* Fecha */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
              <Button
                type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-secondary border-border",
                    !fecha && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                {fecha && isValid(fecha) ? format(fecha, "M/d/yyyy") : "Seleccionar fecha"}
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
          <div className="space-y-2 sm:col-span-2">
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

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-gold-hover"
          >
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTradeDialog;
