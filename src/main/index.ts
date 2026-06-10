import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DocDatabase } from './db';
import { FileWatcher } from './watcher';
import { classify } from './classifier';
import { registerIpcHandlers } from './ipc-handlers';
import { parseFileDirect } from './parser';
import { ParserResult, AppConfig } from '../shared/types';
import { DEFAULT_CATEGORIES, DEFAULT_CONFIG } from '../shared/constants';
import { IPC } from '../shared/constants';

let mainWindow: BrowserWindow | null = null;
let db: DocDatabase;
let watcher: FileWatcher;
let config: AppConfig;
const watchedPaths: string[] = [];

// Async parse queue (no worker threads)
const parseQueue: { filePath: string; fileId: number; ext: string }[] = [];
let parsing = false;

async function processQueue(): Promise<void> {
  if (parsing || parseQueue.length === 0) return;
  parsing = true;
  while (parseQueue.length > 0) {
    const task = parseQueue.shift()!;
    try {
      const result = await parseFileDirect(task.filePath, task.ext);
      try {
        handleParseResult({ fileId: task.fileId, ...result });
      } catch (e2: any) {
        console.error(`[DocHub] Classify error ${task.filePath}:`, e2.message);
        db.updateFileStatus(task.fileId, 'error');
      }
    } catch (e: any) {
      console.error(`[DocHub] Parse error ${task.filePath}:`, e.message);
      db.updateFileStatus(task.fileId, 'error');
    }
    await new Promise(r => setTimeout(r, 0));
  }
  parsing = false;
}

function enqueueParse(filePath: string, fileId: number, ext: string): void {
  parseQueue.push({ filePath, fileId, ext });
  processQueue();
}

// ---- Data directories (initialized in app.whenReady) ----
let appDataDir: string;
let dbPath: string;
let configPath: string;
let logDir: string;

function initPaths(): void {
  appDataDir = path.join(app.getPath('appData'), 'doc-hub');
  dbPath = path.join(appDataDir, 'index.db');
  configPath = path.join(appDataDir, 'config.yaml');
  logDir = path.join(appDataDir, 'logs');
}

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
  threshold: 1
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
        weight: 5,
      });
    }
  }
  console.log('[DocHub] Default categories and rules seeded');
}

function handleParseResult(result: ParserResult): void {
  const { fileId, text, tokens, error, encrypted } = result;

  // Even on error, try to classify by filename
  const searchableContent = tokens.length > 0 ? tokens.join(' ') : '';
  const filename = db.getFileById(fileId)?.name || '';

  const contentSample = text.slice(0, config.classifier.contentSampleBytes);
  const categories = db.getAllCategories();
  const allRules = db.getAllEnabledRules().map((r: any) => ({
    id: r.id,
    categoryId: r.category_id,
    field: r.field,
    operator: r.operator,
    value: JSON.parse(r.value),
    weight: r.weight,
    enabled: r.enabled !== 0,
  }));

  const classification = classify(filename, contentSample, categories, allRules, config.classifier.threshold);

  // Store text preview for fast re-classification later
  db.setContentPreview(fileId, text);

  db.setFileCategory(fileId, classification.categoryId);
  if (searchableContent) {
    db.upsertFts(fileId, searchableContent, filename);
  }
  // Mark as parsed (even if content extraction partially failed — we still classified by filename)
  db.updateFileStatus(fileId, encrypted ? 'error' : 'parsed');

  // Push to renderer (map snake_case to camelCase)
  const row = db.getFileById(fileId);
  if (row && mainWindow && !mainWindow.isDestroyed()) {
    const fileInfo = {
      id: row.id, path: row.path, name: row.name, ext: row.ext, size: row.size,
      modifiedAt: row.modified_at, contentHash: row.content_hash,
      categoryId: row.category_id, indexedAt: row.indexed_at, status: row.status,
    };
    mainWindow.webContents.send(IPC.FILE_INDEXED, fileInfo);
    const status = db.getStatus();
    mainWindow.webContents.send(IPC.STATUS_UPDATE, status);
  }
}

async function scanDirectory(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });

  const CONCURRENCY = 20;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const tasks = batch.map(async (entry) => {
      if (!entry.isFile()) return;
      const dirent = entry as fs.Dirent & { parentPath?: string; path?: string };
      const filePath = path.join(dirent.parentPath || dirent.path || dir, entry.name);
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.pdf', '.docx', '.xlsx', '.pptx'].includes(ext)) return;

      try {
        const stat = await fs.promises.stat(filePath);
        const existing = db.getFileStat(filePath);
        const isNew = !existing;
        // Round to integer — DB column is INTEGER, truncates fractional ms
        const mtimeMs = Math.floor(stat.mtimeMs);
        const contentChanged = isNew || existing.modified_at !== mtimeMs || existing.size !== stat.size;
        const needsParse = isNew || contentChanged || existing.status === 'pending' || existing.status === 'error';

        if (needsParse) {
          let contentHash = existing?.content_hash || '';
          if (contentChanged) {
            const fd = await fs.promises.open(filePath, 'r');
            const buf = Buffer.alloc(65536);
            await fd.read(buf, 0, 65536, 0);
            await fd.close();
            contentHash = require('crypto').createHash('md5').update(buf).digest('hex');
          }

          const fileId = db.upsertFile({
            path: filePath, name: entry.name, ext,
            size: stat.size, modifiedAt: mtimeMs, contentHash,
          });
          enqueueParse(filePath, fileId, ext);
          console.log(`[DocHub] Scanned: ${entry.name}`);
        }
      } catch (e: any) {
        // File may be locked or deleted - skip silently
      }
    });

    await Promise.all(tasks);
    // Yield to event loop
    await new Promise(r => setTimeout(r, 0));
  }
}

function onFileChanged(payload: { path: string; event: string }): void {
  console.log(`[DocHub] File event: ${payload.event} - ${payload.path}`);
  if (payload.event === 'unlink') return;

  const name = path.basename(payload.path);
  const ext = path.extname(payload.path).toLowerCase();

  // Async handling: read file and enqueue
  const fp = payload.path;
  (async () => {
    try {
      const stat = fs.statSync(fp);
      const fileBuffer = fs.readFileSync(fp).slice(0, 65536);
      const contentHash = require('crypto').createHash('md5').update(fileBuffer).digest('hex');
      const fileId = db.upsertFile({
        path: fp, name, ext, size: stat.size, modifiedAt: Math.floor(stat.mtimeMs), contentHash,
      });
      enqueueParse(fp, fileId, ext);
    } catch (e: any) {
      console.error(`[DocHub] Cannot read file ${fp}:`, e.message);
    }
  })();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: '文档中枢',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }
}

// ---- App lifecycle ----
// Enable clipboard shortcuts (Ctrl+C/V/X/A) in the app
const menuTemplate: Electron.MenuItemConstructorOptions[] = [
  {
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ],
  },
  {
    label: '视图',
    submenu: [
      { role: 'reload', label: '刷新' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' },
      { role: 'resetZoom', label: '重置缩放' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' },
    ],
  },
];
app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // Phase 1: Fast, necessary init before window shows
  initPaths();
  ensureDirectories();
  saveDefaultConfig();
  config = loadConfig();
  db = new DocDatabase(dbPath);
  seedDefaultCategories();

  // Set up watcher (don't start yet)
  watcher = new FileWatcher({
    paths: config.watch.paths,
    exclude: config.watch.exclude,
    debounceMs: config.watch.debounceMs,
  });
  watcher.on('file-changed', onFileChanged);

  // Register IPC so frontend can call APIs immediately
  registerIpcHandlers(db, watcher, { enqueue: enqueueParse }, config, scanDirectory, watchedPaths);

  // Reclassify-all handler: uses stored content_preview for instant re-classification
  ipcMain.handle(IPC.RECLASSIFY_ALL, async () => {
    const files = db.getAllFiles();
    const categories = db.getAllCategories();
    const allRules = db.getAllEnabledRules().map((r: any) => ({
      id: r.id,
      categoryId: r.category_id,
      field: r.field,
      operator: r.operator,
      value: JSON.parse(r.value),
      weight: r.weight,
      enabled: r.enabled !== 0,
    }));

    let changed = 0;
    for (const f of files) {
      const contentSample = (f.content_preview || '').slice(0, config.classifier.contentSampleBytes);
      const result = classify(f.name, contentSample, categories, allRules, config.classifier.threshold);
      if (result.categoryId !== f.category_id) {
        db.setFileCategory(f.id, result.categoryId);
        changed++;
      }
      // Fix stuck pending/error status
      if (f.status === 'pending' || f.status === 'error') {
        db.updateFileStatus(f.id, 'parsed');
      }
    }
    return { total: files.length, changed };
  });

  // Show window immediately — don't wait for scanning
  createWindow();

  // Phase 2: Defer heavy I/O to after window is visible
  setImmediate(() => {
    if (config.watch.paths.length > 0) {
      watcher.start();
    }

    // Auto-scan test directory in background (don't block UI)
    const testDir = 'C:/Users/Administrator/Desktop/DocHub测试';
    if (fs.existsSync(testDir)) {
      console.log(`[DocHub] Auto-scanning test directory: ${testDir}`);
      // Use setTimeout to let the window render first
      setTimeout(() => {
        scanDirectory(testDir).catch(e => console.error('[DocHub] Scan error:', e));
        watcher.updatePaths([testDir]);
      }, 500);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  watcher?.stop();
  db?.close();
});
