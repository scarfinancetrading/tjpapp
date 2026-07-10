import { useMemo, useState } from "react";
import { Trade } from "@/types/trade";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
import EditTradeDialog from "./EditTradeDialog";
import TradeImageDialog from "./TradeImageDialog";
import { toast } from "sonner";

interface TradeTableProps {
  trades: Trade[];
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  commissionPerLot?: number;
}

const columns = [
  "",
  "Fecha",
  "Par",
  "Sesión",
  "Estrategia",
  "Entrada",
  "Orden",
  "R:R",
  "% Riesgo",
  "SL (Pips)",
  "Lotaje",
  "Resultado ($)",
  "Comisiones ($)",
  "Balance ($)",
  "Salida",
  "Acciones",
];

const exportCSV = (trades: Trade[]) => {
  const headers = [
    "Fecha",
    "Par",
    "Sesión",
    "Estrategia",
    "Entrada",
    "Orden",
    "Risk Reward Ratio",
    "% Riesgo",
    "Stop Loss (Pips)",
    "Lotaje",
    "Resultado ($)",
    "Salida Operación",
  ];

  const rows = trades.map((t) => [
    t.fecha,
    t.par,
    t.sesion,
    t.estrategia,
    t.entrada,
    t.orden,
    t.riskReward,
    t.riesgo,
    t.stopLoss,
    t.lotaje,
    t.resultado,
    t.salidaOperacion,
  ]);

  const BOM = "\uFEFF";
  const csv =
    BOM +
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(";")
      )
      .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trading_journal_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function parseTradeDate(s: string): Date | null {
  if (!s) return null;
  // Try M/d/yyyy or d/M/yyyy or yyyy-MM-dd
  const isoTry = new Date(s);
  if (!isNaN(isoTry.getTime())) return isoTry;
  const parts = s.split(/[\/\-]/).map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    const [a, b, c] = parts;
    const year = c < 100 ? 2000 + c : c;
    return new Date(year, a - 1, b);
  }
  return null;
}

const TradeTable = ({ trades, onEditTrade, onDeleteTrade, commissionPerLot = 0 }: TradeTableProps) => {
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "all" or "YYYY-MM"
  const [imageTrade, setImageTrade] = useState<Trade | null>(null);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      const d = parseTradeDate(t.fecha);
      if (d) set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return [...set].sort().reverse();
  }, [trades]);

  const visibleTrades = useMemo(() => {
    if (monthFilter === "all") return trades;
    return trades.filter((t) => {
      const d = parseTradeDate(t.fecha);
      if (!d) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthFilter;
    });
  }, [trades, monthFilter]);

  const allVisibleSelected =
    visibleTrades.length > 0 && visibleTrades.every((t) => selectedIds.has(t.id));

  const toggleAllVisible = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) visibleTrades.forEach((t) => next.delete(t.id));
    else visibleTrades.forEach((t) => next.add(t.id));
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleExport = () => {
    const toExport = selectedIds.size > 0
      ? visibleTrades.filter((t) => selectedIds.has(t.id))
      : visibleTrades;
    if (toExport.length === 0) {
      toast.info("No hay operaciones para exportar");
      return;
    }
    exportCSV(toExport);
  };

  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade);
  };

  const handleSaveEdit = (updatedTrade: Trade) => {
    onEditTrade(updatedTrade);
    setEditingTrade(null);
    toast.success("Operación actualizada correctamente");
  };

  const handleConfirmDelete = () => {
    if (deletingTradeId) {
      onDeleteTrade(deletingTradeId);
      setDeletingTradeId(null);
      toast.success("Operación eliminada correctamente");
    }
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 flex-wrap gap-3">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Operaciones Registradas
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({visibleTrades.length}{monthFilter !== "all" ? ` de ${trades.length}` : ""})
            </span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Filtrar por mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {monthOptions.map((k) => {
                  const [y, m] = k.split("-");
                  return (
                    <SelectItem key={k} value={k}>
                      {MONTHS_ES[parseInt(m, 10) - 1]} {y}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {trades.length > 0 && (
              <Button
                onClick={handleExport}
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <Download className="mr-2 h-4 w-4" />
                {selectedIds.size > 0
                  ? `Exportar (${selectedIds.size})`
                  : "Exportar CSV"}
              </Button>
            )}
          </div>
        </div>

        {visibleTrades.length === 0 ? (
          <div className="px-6 pb-8 text-center text-muted-foreground text-sm">
            {trades.length === 0
              ? "No hay operaciones registradas. Añade tu primera operación usando el formulario."
              : "No hay operaciones para el mes seleccionado."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {columns.map((col, idx) => (
                    <TableHead
                      key={idx}
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      {idx === 0 ? (
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleAllVisible}
                          aria-label="Seleccionar todas"
                        />
                      ) : col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTrades.map((trade) => (
                  <TableRow
                    key={trade.id}
                    className="border-border hover:bg-secondary/50 animate-fade-in"
                  >
                    <TableCell className="w-[40px]">
                      <Checkbox
                        checked={selectedIds.has(trade.id)}
                        onCheckedChange={() => toggleOne(trade.id)}
                        aria-label="Seleccionar fila"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{trade.fecha}</TableCell>
                    <TableCell className="font-medium text-sm text-primary">{trade.par}</TableCell>
                    <TableCell className="text-sm">{trade.sesion}</TableCell>
                    <TableCell className="text-sm">{trade.estrategia}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{trade.entrada}</TableCell>
                    <TableCell className="text-sm">{trade.orden}</TableCell>
                    <TableCell className="text-sm">{trade.riskReward}</TableCell>
                    <TableCell className="text-sm">{trade.riesgo}{trade.riesgo ? "%" : ""}</TableCell>
                    <TableCell className="text-sm">{trade.stopLoss}</TableCell>
                    <TableCell className="text-sm">{trade.lotaje}</TableCell>
                    <TableCell className={`text-sm font-medium ${
                      Number(trade.resultado) > 0
                        ? "text-success"
                        : Number(trade.resultado) < 0
                        ? "text-loss"
                        : ""
                    }`}>
                      {trade.resultado ? `$${trade.resultado}` : ""}
                    </TableCell>
                    {(() => {
                      const lots = Number(trade.lotaje) || 0;
                      const commission = lots * commissionPerLot;
                      const result = Number(trade.resultado) || 0;
                      const balance = result - commission;
                      return (
                        <>
                          <TableCell className="text-sm font-medium text-loss whitespace-nowrap">
                            {commission > 0 ? `-$${commission.toFixed(2)}` : ""}
                          </TableCell>
                          <TableCell className={`text-sm font-medium whitespace-nowrap ${
                            balance > 0 ? "text-success" : balance < 0 ? "text-loss" : ""
                          }`}>
                            {(trade.resultado || commission > 0)
                              ? (balance < 0 ? `-$${Math.abs(balance).toFixed(2)}` : `$${balance.toFixed(2)}`)
                              : ""}
                          </TableCell>
                        </>
                      );
                    })()}
                    <TableCell className="text-sm">{trade.salidaOperacion}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => handleEdit(trade)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-loss hover:bg-loss/10"
                          onClick={() => setDeletingTradeId(trade.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${trade.imageBeforePath || trade.imageAfterPath ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10"}`}
                          onClick={() => setImageTrade(trade)}
                          aria-label="Ver imagen"
                          title={trade.imageBeforePath || trade.imageAfterPath ? "Ver imagen" : "Sin imagen — subir Después"}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EditTradeDialog
        trade={editingTrade}
        open={!!editingTrade}
        onOpenChange={(open) => !open && setEditingTrade(null)}
        onSave={handleSaveEdit}
      />

      <TradeImageDialog
        trade={imageTrade}
        open={!!imageTrade}
        onOpenChange={(open) => !open && setImageTrade(null)}
        onUpdated={(t) => {
          onEditTrade(t);
          setImageTrade(t);
        }}
      />

      <AlertDialog open={!!deletingTradeId} onOpenChange={(open) => !open && setDeletingTradeId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar operación?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción no se puede deshacer. La operación será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-loss text-white hover:bg-loss/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TradeTable;
