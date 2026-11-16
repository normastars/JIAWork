export const NlqIpcChannel = {
  Status: 'nlq:status',
  Schema: 'nlq:schema',
  Model: 'nlq:model',
  SaveDraft: 'nlq:save-draft',
  Preview: 'nlq:preview',
  Publish: 'nlq:publish',
} as const;

export type NlqDimension = string;
export type NlqMetric = string;

export interface NlqModel {
  version: number;
  name: string;
  dimensions: Record<string, { label: string; aliases: string[] }>;
  tables: Record<string, { name: string; dateColumn?: string; dimensions: Record<string, string> }>;
  relations: Record<string, {
    fromTable: string;
    toTable: string;
    fromColumn: string;
    toColumn: string;
    cardinality: 'many_to_one' | 'one_to_one' | 'one_to_many';
  }>;
  metrics: Record<string, {
    label: string;
    table: string;
    column: string;
    subtractColumn?: string;
    type: 'flow' | 'snapshot';
    unit: string;
    notes: string[];
  }>;
}

export interface NlqDatabaseTable {
  name: string;
  columns: Array<{ name: string; dataType: string }>;
}

export interface NlqModelState {
  published: NlqModel;
  draft: NlqModel;
}

export interface NlqQuerySpec {
  question?: string;
  metric: NlqMetric;
  period: { from: string; to: string };
  group_by?: NlqDimension[];
  filters?: Partial<Record<NlqDimension, string[]>>;
  compare?: 'prev_year' | 'prev_period';
  limit?: number;
  with_total?: boolean;
  share?: boolean;
}

export interface NlqQueryRow {
  value: number;
  [dimension: string]: string | number | null;
}

export interface NlqQueryResult {
  spec: NlqQuerySpec;
  metricLabel: string;
  unit: string;
  rows: NlqQueryRow[];
  total?: number;
  comparison?: { previous: number; difference: number; changePercent: number | null };
  notes: string[];
  warnings: string[];
  sql: Array<{ text: string; parameters: Record<string, string | number> }>;
  dataAsOf?: string;
}
