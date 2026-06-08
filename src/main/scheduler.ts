import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';
import { ParserTask, ParserResult } from '../shared/types';

export interface SchedulerConfig {
  poolSize: number;
  recycleAfter: number;
}

export class Scheduler extends EventEmitter {
  private config: SchedulerConfig;
  private queue: ParserTask[] = [];
  private workers: { worker: Worker; processed: number; busy: boolean }[] = [];
  private workerPath: string;

  constructor(config: SchedulerConfig) {
    super();
    this.config = config;
    this.workerPath = path.resolve(__dirname, 'workers/parser-worker.js');
  }

  enqueue(task: ParserTask): void {
    this.queue.push(task);
    this.queue.sort((a, b) => b.fileId - a.fileId); // newer files first (higher ID)
    this.tryDispatch();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  shutdown(): void {
    for (const w of this.workers) {
      w.worker.terminate();
    }
    this.workers = [];
    this.queue = [];
  }

  private tryDispatch(): void {
    // Ensure pool is populated
    while (this.workers.length < this.config.poolSize) {
      this.spawnWorker();
    }

    for (const w of this.workers) {
      if (!w.busy && this.queue.length > 0) {
        const task = this.queue.shift()!;
        w.busy = true;
        w.worker.postMessage(task);
      }
    }
  }

  private spawnWorker(): void {
    const worker = new Worker(this.workerPath);
    const entry = { worker, processed: 0, busy: false };

    worker.on('message', (result: ParserResult) => {
      entry.busy = false;
      entry.processed++;
      this.emit('task-done', result);

      // Recycle worker after N files
      if (entry.processed >= this.config.recycleAfter) {
        worker.terminate();
        const idx = this.workers.indexOf(entry);
        if (idx >= 0) this.workers.splice(idx, 1);
        this.spawnWorker();
      }

      this.tryDispatch();
    });

    worker.on('error', (err: Error) => {
      console.error('[Scheduler] Worker error:', err.message);
      // Replace crashed worker
      const idx = this.workers.indexOf(entry);
      if (idx >= 0) this.workers.splice(idx, 1);
      this.spawnWorker();
    });

    this.workers.push(entry);
  }
}
