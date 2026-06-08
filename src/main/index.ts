import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DocDatabase } from './db';
import { FileWatcher } from './watcher';
import { Scheduler } from './scheduler';
import { classify } from './classifier';
import { registerIpcHandlers } from './ipc-handlers';
import { ParserResult, AppConfig } from '../shared/types';
import { DEFAULT_CATEGORIES, DEFAULT_CONFIG } from '../shared/constants';
import { IPC } from '../shared/constants';

let mainWindow: BrowserWindow | null = null;
let db: DocDatabase;
let watcher: FileWatcher;
let scheduler: Scheduler;
let config: AppConfig;

// ---- Data directories ----
const appDataDir = path.join(app.getPath('appData'), 'doc-hub');
const dbPath = path.join(appDataDir, 'index.db');
const configPath = path.join(appDataDir, 'config.yaml');
const logDir = path.join(appDataDir, 'logs');

function ensureDirectories(): void {
  for (const dir of [appDataDir, logDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function saveDefaultConfig(): void {
  if (!fs.existsSync(configPath)) {
    const defaultConfig = `# DocHub Configuration
# Restart app after making changes

watch:
  paths: []
  #  - C:\\\\Users\\\\YourName\\\\OneDrive\\\\SharedDocs
  exclude:
    - "**/~$*"
    - "**/.~*"
    - "**/Thumbs.db"
  debounce_ms: 2000

classifier:
  threshold: 5
  content_sample_bytes: 50000

index:
  max_file_mb: 100

worker:
  pool_size: 3
  recycle_after: 100
`;
    fs.writeFileSync(configPath, defaultConfig, 'utf8');
  }
}

function loadConfig(): AppConfig {
  const defaults: AppConfig = {
    watch: { paths: [], exclude: ['**/~$*', '**/.~*', '**/Thumbs.db'], debounceMs: DEFAULT_CONFIG.DEBOUNCE_MS },
    classifier: { threshold: DEFAULT_CONFIG.CLASSIFIER_THRESHOLD, contentSampleBytes: DEFAULT_CONFIG.CONTENT_SAMPLE_BYTES },
    index: { maxFileMb: DEFAULT_CONFIG.MAX_FILE_MB },
    worker: { poolSize: DEFAULT_CONFIG.DEFAULT_POOL_SIZE, recycleAfter: DEFAULT_CONFIG.RECYCLE_AFTER },
  };

  if (fs.existsSync(configPath)) {
    try {
      const raw = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;
      return {
        ...defaults, ...raw,
        watch: { ...defaults.watch, ...raw?.watch },
        classifier: { ...defaults.classifier, ...raw?.classifier },
        index: { ...defaults.index, ...raw?.index },
        worker: { ...defaults.worker, ...raw?.worker },
      };
    } catch (e) {
      console.error('Config load failed, using defaults:', e);
    }
  }
  return defaults;
}

function seedDefaultCategories(): void {
  const existing = db.getAllCategories();
  if (existing.length > 0) return;

  for (const cat of DEFAULT_CATEGORIES) {
    const catId = db.createCategory(cat.name, null, cat.icon, cat.color);
    for (const kw of cat.keywords) {
      db.saveRule({
        categoryId: catId,
        field: 'both',
        operator: 'contains',
        value: [kw],
        weight: 1,
      });
    }
  }
  console.log('[DocHub] Default categories and rules seeded');
}

function handleParseResult(result: ParserResult): void {
  const { fileId, text, tokens, error, encrypted } = result;

  if (error) {
    db.updateFileStatus(fileId, 'error');
    return;
  }

  const searchableContent = tokens.join(' ');
  const filename = db.getFileById(fileId)?.name || '';

  const contentSample = text.slice(0, config.classifier.contentSampleBytes);
  const categories = db.getAllCategories();
  const allRules = db.getAllEnabledRules().map((r: any) => ({
    ...r,
    value: JSON.parse(r.value),
  }));

  const classification = classify(filename, contentSample, categories, allRules, config.classifier.threshold);

  db.setFileCategory(fileId, classification.categoryId);
  db.upsertFts(fileId, searchableContent, filename);
  db.updateFileStatus(fileId, 'parsed');

  // Push to renderer
  const fileInfo = db.getFileById(fileId);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.FILE_INDEXED, fileInfo);
    const status = db.getStatus();
    mainWindow.webContents.send(IPC.STATUS_UPDATE, status);
  }
}

function onFileChanged(payload: { path: string; event: string }): void {
  if (payload.event === 'unlink') {
    return;
  }

  const ext = path.extname(payload.path).toLowerCase();
  const name = path.basename(payload.path);
  let size = 0;
  let mtime = Date.now();
  let contentHash = '';

  try {
    const stat = fs.statSync(payload.path);
    size = stat.size;
    mtime = stat.mtimeMs;
    const fileBuffer = fs.readFileSync(payload.path).slice(0, 65536);
    contentHash = require('crypto').createHash('md5').update(fileBuffer).digest('hex');
  } catch (e: any) {
    console.error(`[DocHub] Cannot read file ${payload.path}:`, e.message);
    return;
  }

  const fileId = db.upsertFile({
    path: payload.path,
    name,
    ext,
    size,
    modifiedAt: mtime,
    contentHash,
  });

  scheduler.enqueue({ filePath: payload.path, fileId, ext });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'DocHub',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// ---- App lifecycle ----
app.whenReady().then(() => {
  ensureDirectories();
  saveDefaultConfig();
  config = loadConfig();
  db = new DocDatabase(dbPath);
  seedDefaultCategories();

  scheduler = new Scheduler({
    poolSize: config.worker.poolSize,
    recycleAfter: config.worker.recycleAfter,
  });
  scheduler.on('task-done', handleParseResult);

  watcher = new FileWatcher({
    paths: config.watch.paths,
    exclude: config.watch.exclude,
    debounceMs: config.watch.debounceMs,
  });
  watcher.on('file-changed', onFileChanged);

  registerIpcHandlers(db, watcher, scheduler, config);
  createWindow();

  if (config.watch.paths.length > 0) {
    watcher.start();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  scheduler?.shutdown();
  watcher?.stop();
  db?.close();
});
