// IPC Channel names
export const IPC = {
  // Renderer -> Main (invoke)
  SEARCH_QUERY: 'search:query',
  FILES_LIST: 'files:list',
  CATEGORIES_LIST: 'categories:list',
  RULES_SAVE: 'rules:save',
  WATCH_START: 'watch:start',
  FILE_RETRY: 'file:retry',
  FILE_OPEN: 'file:open',
  FILE_EXPORT: 'file:export',

  // Main -> Renderer (send)
  STATUS_UPDATE: 'status:update',
  FILE_INDEXED: 'file:indexed',
} as const;

// Supported file extensions
export const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.pptx'];

// Excluded patterns for watcher
export const DEFAULT_EXCLUDE = ['**/~$*', '**/.~*', '**/Thumbs.db'];

// Default config values
export const DEFAULT_CONFIG = {
  CLASSIFIER_THRESHOLD: 1,
  CONTENT_SAMPLE_BYTES: 50000,
  MAX_FILE_MB: 100,
  DEBOUNCE_MS: 2000,
  DEFAULT_POOL_SIZE: 3,
  RECYCLE_AFTER: 100,
  PARSE_RETRY_COUNT: 3,
  PARSE_RETRY_DELAY_MS: 1000,
  WORKER_BUSY_TIMEOUT_MS: 30000,
};

// Predefined categories with rules
export const DEFAULT_CATEGORIES: { name: string; icon: string; color: string; keywords: string[] }[] = [
  {
    name: '合同/协议',
    icon: 'file-contract',
    color: '#E74C3C',
    keywords: ['合同', '协议', '甲方', '乙方', '签订', '合同编号', '条款', '违约责任'],
  },
  {
    name: '发票/票据',
    icon: 'receipt',
    color: '#27AE60',
    keywords: ['发票', 'invoice', '发票号码', '开票日期', '金额', '税率', '票据'],
  },
  {
    name: '报告/汇报',
    icon: 'chart-bar',
    color: '#3498DB',
    keywords: ['报告', '总结', '汇报', '月度', '季度', '年度', '分析', '统计'],
  },
  {
    name: '简历/人事',
    icon: 'user',
    color: '#9B59B6',
    keywords: ['简历', 'CV', 'resume', '工作经历', '教育背景', '求职', '面试'],
  },
  {
    name: '技术文档',
    icon: 'code',
    color: '#F39C12',
    keywords: ['技术方案', '需求文档', '接口文档', '设计说明', 'API', '架构', '开发'],
  },
  {
    name: '规章制度',
    icon: 'gavel',
    color: '#1ABC9C',
    keywords: ['制度', '规定', '管理办法', '通知', '公告', '条例', '规范'],
  },
];
