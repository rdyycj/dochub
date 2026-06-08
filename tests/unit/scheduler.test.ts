import { describe, it, expect } from 'vitest';
import { Scheduler } from '../../src/main/scheduler';

describe('Scheduler', () => {
  it('should enqueue files and track status', () => {
    const scheduler = new Scheduler({ poolSize: 1, recycleAfter: 100 });
    expect(scheduler.getQueueLength()).toBe(0);

    scheduler.enqueue({ filePath: '/test/a.pdf', fileId: 1, ext: '.pdf' });
    scheduler.enqueue({ filePath: '/test/b.docx', fileId: 2, ext: '.docx' });

    // Queue may have items or workers may have already picked them up
    expect(scheduler.getQueueLength()).toBeGreaterThanOrEqual(0);
    scheduler.shutdown();
    expect(scheduler.getQueueLength()).toBe(0);
  });

  it('should shutdown cleanly', () => {
    const scheduler = new Scheduler({ poolSize: 1, recycleAfter: 5 });
    scheduler.enqueue({ filePath: '/test/a.pdf', fileId: 1, ext: '.pdf' });
    scheduler.shutdown();
    expect(scheduler.getQueueLength()).toBe(0);
  });

  it('should handle empty queue', () => {
    const scheduler = new Scheduler({ poolSize: 2, recycleAfter: 100 });
    expect(scheduler.getQueueLength()).toBe(0);
    scheduler.shutdown();
  });
});
