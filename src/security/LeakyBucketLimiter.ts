export interface AdmitResult {
  admitted: boolean;
  status: 200 | 429;
  queueSize: number;
  reason: string;
}

export interface LeakyBucketOptions {
  capacity?: number;
  leakRatePerSec?: number;
  now?: () => number;
  onProcess?: (request: unknown) => void;
}

export class LeakyBucketLimiter {
  private readonly capacity: number;
  private readonly leakRatePerSec: number;
  private readonly now: () => number;
  private readonly onProcess?: (request: unknown) => void;

  private bucketQueue: unknown[] = [];
  private lastLeakTime: number;
  private leakCredit = 0;

  private totalAdmitted = 0;
  private totalRejected = 0;
  private totalProcessed = 0;

  constructor(opts: LeakyBucketOptions = {}) {
    this.capacity = opts.capacity ?? 6;
    this.leakRatePerSec = opts.leakRatePerSec ?? 2;
    this.now = opts.now ?? Date.now;
    this.onProcess = opts.onProcess;
    this.lastLeakTime = this.now();
  }

  tryAdmit(request: unknown = {}): AdmitResult {
    this.leak();

    if (this.bucketQueue.length < this.capacity) {
      this.bucketQueue.push(request);
      this.totalAdmitted++;
      const queueSize = this.bucketQueue.length;
      return {
        admitted: true,
        status: 200,
        queueSize,
        reason: `SURGE BUFFERED — queued ${queueSize}/${this.capacity}`,
      };
    }

    this.totalRejected++;
    return {
      admitted: false,
      status: 429,
      queueSize: this.bucketQueue.length,
      reason: `OVERFLOW — bucket full (${this.capacity}); dropping request → 429`,
    };
  }

  leak(): number {
    const now = this.now();
    const elapsedMs = now - this.lastLeakTime;
    if (elapsedMs <= 0) return 0;
    this.lastLeakTime = now;

    this.leakCredit += (elapsedMs / 1000) * this.leakRatePerSec;
    const leakable = Math.floor(this.leakCredit);
    if (leakable <= 0) return 0;
    this.leakCredit -= leakable;

    const toProcess = Math.min(leakable, this.bucketQueue.length);
    for (let i = 0; i < toProcess; i++) {
      const req = this.bucketQueue.shift();
      this.totalProcessed++;
      this.onProcess?.(req);
    }
    if (this.bucketQueue.length === 0) this.leakCredit = 0;
    return toProcess;
  }

  getState() {
    return {
      queueSize: this.bucketQueue.length,
      capacity: this.capacity,
      leakRatePerSec: this.leakRatePerSec,
      totalAdmitted: this.totalAdmitted,
      totalRejected: this.totalRejected,
      totalProcessed: this.totalProcessed,
    };
  }
}
