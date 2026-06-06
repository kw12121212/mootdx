import net from "node:net";
import { createLogger } from "../logger";

const log = createLogger("socket");

const CONNECT_TIMEOUT = 5000;

export interface TdxSocketOptions {
  timeout?: number;
}

export class TdxSocket {
  private sock: net.Socket | null = null;
  private _connected = false;
  private _host = "";
  private _port = 0;
  private _timeout: number;
  private pendingChunks: Buffer[] = [];
  private resolveRead: ((data: Buffer) => void) | null = null;
  private rejectRead: ((err: Error) => void) | null = null;

  constructor(opts?: TdxSocketOptions) {
    this._timeout = opts?.timeout ?? CONNECT_TIMEOUT;
  }

  get connected(): boolean {
    return this._connected;
  }

  get host(): string {
    return this._host;
  }

  get port(): number {
    return this._port;
  }

  async connect(host: string, port: number): Promise<void> {
    this._host = host;
    this._port = port;

    return new Promise<void>((resolve, _reject) => {
      const sock = new net.Socket();
      sock.setTimeout(this._timeout);

      sock.on("data", (chunk: Buffer) => {
        if (this.resolveRead) {
          const resolve = this.resolveRead;
          this.resolveRead = null;
          this.rejectRead = null;
          resolve(chunk);
        } else {
          this.pendingChunks.push(chunk);
        }
      });

      sock.on("error", (err: Error) => {
        if (this.rejectRead) {
          const reject = this.rejectRead;
          this.resolveRead = null;
          this.rejectRead = null;
          reject(err);
        }
        this._connected = false;
      });

      sock.on("close", () => {
        this._connected = false;
        if (this.rejectRead) {
          const reject = this.rejectRead;
          this.resolveRead = null;
          this.rejectRead = null;
          reject(new Error("socket closed"));
        }
      });

      sock.on("timeout", () => {
        sock.destroy(new Error("connection timeout"));
      });

      sock.connect(port, host, () => {
        this.sock = sock;
        this._connected = true;
        log.info(`connected to ${host}:${port}`);
        resolve();
      });

      sock.on("connect", () => {
        // handled above in connect callback
      });
    });
  }

  disconnect(): void {
    if (this.sock) {
      try {
        this.sock.destroy();
      } catch {
        // ignore
      }
      this.sock = null;
      this._connected = false;
      log.info("disconnected");
    }
  }

  send(data: Buffer): boolean {
    if (!this.sock || !this._connected) {
      throw new Error("socket not connected");
    }
    return this.sock.write(data);
  }

  async receive(expectedLen: number): Promise<Buffer> {
    // First drain any pending chunks
    if (this.pendingChunks.length > 0) {
      const combined = Buffer.concat(this.pendingChunks);
      this.pendingChunks = [];
      if (combined.length >= expectedLen) {
        const excess = combined.subarray(expectedLen);
        if (excess.length > 0) {
          this.pendingChunks.push(excess);
        }
        return Buffer.from(combined.subarray(0, expectedLen));
      }
      // Not enough data yet, wait for more
      const more = await this.waitForData();
      const full = Buffer.concat([combined, more]);
      if (full.length >= expectedLen) {
        const excess = full.subarray(expectedLen);
        if (excess.length > 0) {
          this.pendingChunks.push(excess);
        }
        return Buffer.from(full.subarray(0, expectedLen));
      }
      // Still not enough, recurse
      return this.receive(expectedLen);
    }

    // No pending data, wait for new data
    const chunk = await this.waitForData();
    if (chunk.length >= expectedLen) {
      const excess = chunk.subarray(expectedLen);
      if (excess.length > 0) {
        this.pendingChunks.push(excess);
      }
      return Buffer.from(chunk.subarray(0, expectedLen));
    }

    // Partial read, accumulate and retry
    this.pendingChunks.push(chunk);
    return this.receive(expectedLen);
  }

  private waitForData(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.resolveRead = resolve;
      this.rejectRead = reject;
    });
  }
}
