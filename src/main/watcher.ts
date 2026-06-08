import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { SUPPORTED_EXTENSIONS } from '../shared/constants';
import { FileEventPayload } from '../shared/types';

export interface WatcherConfig {
  paths: string[];
  exclude: string[];
  debounceMs: number;
}

export class FileWatcher extends EventEmitter {
  private config: WatcherConfig;
  private watcher: chokidar.FSWatcher | null = null;

  constructor(config: WatcherConfig) {
    super();
    this.config = config;
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.config.paths, {
      ignored: [
        ...this.config.exclude,
        /(^|[\/\\])\../, // dotfiles
        /node_modules/,
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceMs,
        pollInterval: 500,
      },
    });

    this.watcher.on('add', (filePath: string) => {
      if (this.isSupported(filePath)) {
        this.emit('file-changed', { path: filePath, event: 'add' } as FileEventPayload);
      }
    });

    this.watcher.on('change', (filePath: string) => {
      if (this.isSupported(filePath)) {
        this.emit('file-changed', { path: filePath, event: 'change' } as FileEventPayload);
      }
    });

    this.watcher.on('unlink', (filePath: string) => {
      if (this.isSupported(filePath)) {
        this.emit('file-changed', { path: filePath, event: 'unlink' } as FileEventPayload);
      }
    });

    this.watcher.on('error', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[FileWatcher] Monitor error:', msg);
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  updatePaths(paths: string[]): void {
    this.config.paths = paths;
    if (this.watcher) {
      this.stop();
      this.start();
    }
  }

  private isSupported(filePath: string): boolean {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1) return false;
    const ext = filePath.slice(lastDot).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  }
}
