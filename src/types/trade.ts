import type { ComplianceData } from "./compliance";

export interface Trade {
  id: string;
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
  imageBeforePath?: string | null;
  imageAfterPath?: string | null;
  imageSummary?: TradeImageSummary | null;
  complianceData?: ComplianceData | null;
  fundingAccountId?: string | null;
}

export interface TradeImageSummary {
  fecha?: string;
  par?: string;
  timeframe?: string;
  orden?: string;
  entrada?: string;
  slPips?: number | null;
  tpPips?: number | null;
  riskReward?: string;
  entryPrice?: number | null;
  slPrice?: number | null;
  tpPrice?: number | null;
  lotSize?: number | null;
  riskUsd?: number | null;
  chartTime?: string | null;
  riesgoPct?: number | null;
  sesion?: string | null;
}
