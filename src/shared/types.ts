// ---- File ----
export interface FileInfo {
  id: number;
  path: string;
  name: string;
  ext: string;
  size: number;
  modifiedAt: number;
  contentHash: string | null;
  categoryId: number | null;
  indexedAt: number | null;
  status: FileStatus;
}

export type FileStatus = 'pending' | 'parsed' | 'error';

// ---- Category ----
export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  icon: string;
  color: string;
  priority: number;
  children?: Category[];
}

// ---- Rule ----
export interface Rule {
  id: number;
  categoryId: number;
  field: RuleField;
  operator: RuleOperator;
  value: string[];
  weight: number;
  enabled: boolean;
}

export type RuleField = 'filename' | 'content' | 'both';
export type RuleOperator = 'contains' | 'regex' | 'all_keywords';

// ---- Classification ----
export interface ClassificationResult {
  categoryId: number | null;
  categoryName: string | null;
  score: number;
  matchedRules: { ruleId: number; weight: number }[];
}

// ---- Search ----
export interface SearchQuery {
  query: string;
  categoryId?: number;
  dateFrom?: number;
  dateTo?: number;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  fileId: number;
  name: string;
  path: string;
  ext: string;
  size: number;
  modifiedAt: number;
  categoryName: string | null;
  snippet: string;
  highlights: string[];
}

// ---- IPC Payloads ----
export interface IndexStatus {
  indexed: number;
  pending: number;
  error: number;
}

export interface FileEventPayload {
  path: string;
  event: 'add' | 'change' | 'unlink';
}

// ---- Config ----
export interface AppConfig {
  watch: {
    paths: string[];
    exclude: string[];
    debounceMs: number;
  };
  classifier: {
    threshold: number;
    contentSampleBytes: number;
  };
  index: {
    maxFileMb: number;
  };
  worker: {
    poolSize: number;
    recycleAfter: number;
  };
}

// ---- Worker ----
export interface ParserTask {
  filePath: string;
  fileId: number;
  ext: string;
}

export interface ParserResult {
  fileId: number;
  text: string;
  tokens: string[];
  error?: string;
  encrypted?: boolean;
}
