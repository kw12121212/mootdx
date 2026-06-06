import { createLogger } from "../logger";

const log = createLogger("heartbeat");

const DEFAULT_INTERVAL = 10_000;
const MAX_FAILURES = 3;

export class HeartbeatManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private failCount = 0;
  private readonly interval: number;
  private readonly maxFailures: number;
  private readonly onHeartbeat: () => Promise<void>;
  private readonly onDisconnect: () => void;
  private lastAckTime = Date.now();

  constructor(opts: {
    onHeartbeat: () => Promise<void>;
    onDisconnect: () => void;
    interval?: number;
    maxFailures?: number;
  }) {
    this.onHeartbeat = opts.onHeartbeat;
    this.onDisconnect = opts.onDisconnect;
    this.interval = opts.interval ?? DEFAULT_INTERVAL;
    this.maxFailures = opts.maxFailures ?? MAX_FAILURES;
  }

  start(): void {
    if (this.timer) return;
    this.failCount = 0;
    this.lastAckTime = Date.now();
    this.timer = setInterval(() => this.tick(), this.interval);
    log.info("heartbeat started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info("heartbeat stopped");
    }
  }

  notifyActivity(): void {
    this.lastAckTime = Date.now();
  }

  private async tick(): Promise<void> {
    if (Date.now() - this.lastAckTime < this.interval) return;

    try {
      await this.onHeartbeat();
      this.failCount = 0;
      this.lastAckTime = Date.now();
    } catch (err) {
      this.failCount++;
      log.warn(`heartbeat failed (${this.failCount}/${this.maxFailures})`);
      if (this.failCount >= this.maxFailures) {
        log.error("max heartbeat failures reached, disconnecting");
        this.stop();
        this.onDisconnect();
      }
    }
  }
}
