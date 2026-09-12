/**
 * Frontend-side types for the AI Insights system.
 * Must stay in sync with InsightTemplateKey in the backend templates.ts.
 */

export type InsightTemplateKey =
  | 'waste_listing'
  | 'facility_card'
  | 'kpi_card'
  | 'trade_ledger_row'
  | 'pathway_economics'
  | 'break_even'
  | 'what_if_result'
  | 'investment_opportunity'
  | 'value_flow';

export const VALID_TEMPLATE_KEYS: InsightTemplateKey[] = [
  'waste_listing',
  'facility_card',
  'kpi_card',
  'trade_ledger_row',
  'pathway_economics',
  'break_even',
  'what_if_result',
  'investment_opportunity',
  'value_flow',
];

export interface StructuredInsight {
  finding: string;
  carbonEconomicFraming: string;
  action: string;
  supportingDetail: string;
}

export interface CachedInsight {
  insight: StructuredInsight;
  generatedAt: number;
  provider?: string;
}

export interface InsightError {
  error: string;
  errorCode: 'parse_error' | 'timeout' | 'rate_limit' | 'network' | 'unknown';
}

export type InsightResult =
  | { ok: true; insight: StructuredInsight; provider?: string; fromCache: boolean }
  | { ok: false; error: string; errorCode: string };
