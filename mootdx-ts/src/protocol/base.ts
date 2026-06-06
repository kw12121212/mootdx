import zlib from "node:zlib";
import { createLogger } from "../logger";
import { TdxSocket } from "./socket";

const log = createLogger("base");

const RSP_HEADER_LEN = 0x10;

export interface ResponseHeader {
  seqNo: number;
  cmd: number;
  pkgType: number;
  zipSize: number;
  unzipSize: number;
}

export class TdxBaseApi {
  protected socket: TdxSocket;
  protected needSetup = true;

  constructor(socket?: TdxSocket) {
    this.socket = socket ?? new TdxSocket();
  }

  async connect(host: string, port: number): Promise<void> {
    await this.socket.connect(host, port);
    if (this.needSetup) {
      await this.setup();
    }
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  protected async setup(): Promise<void> {
    // Override in subclasses for login/setup commands
  }

  async sendRequest(_cmd: number, params: Buffer): Promise<Buffer> {
    if (!this.socket.connected) {
      throw new Error("socket not connected");
    }

    const header = this.packRequestHeader(_cmd, params.length);
    const packet = Buffer.concat([header, params]);
    this.socket.send(packet);

    const bodyBuf = await this.readResponse();
    return bodyBuf;
  }

  protected packRequestHeader(_cmd: number, dataLen: number): Buffer {
    const buf = Buffer.alloc(16);
    // magic bytes
    buf.writeUInt16LE(0x010c, 0);
    // other header fields set to 0
    // cmd as U32LE at offset 4? Actually matching Python: the request format
    // is constructed by individual parsers. For base, we pack minimal header.
    buf.writeUInt16LE(dataLen, 12);
    buf.writeUInt16LE(dataLen, 14);
    return buf;
  }

  protected async readResponse(): Promise<Buffer> {
    const headBuf = await this.socket.receive(RSP_HEADER_LEN);

    if (headBuf.length !== RSP_HEADER_LEN) {
      throw new Error(`response header length mismatch: got ${headBuf.length}, expected ${RSP_HEADER_LEN}`);
    }

    const header = this.unpackResponseHeader(headBuf);
    log.debug(`response header: zip=${header.zipSize} unzip=${header.unzipSize}`);

    let bodyBuf = await this.socket.receive(header.zipSize);

    if (bodyBuf.length === 0) {
      throw new Error("empty response body - server disconnected");
    }

    // Decompress if needed
    if (header.zipSize < header.unzipSize) {
      bodyBuf = zlib.inflateSync(bodyBuf);
    }

    // Check for multi-packet response
    if (header.pkgType !== 0) {
      bodyBuf = await this.readRemainingPackets(header, bodyBuf);
    }

    return bodyBuf;
  }

  protected unpackResponseHeader(buf: Buffer): ResponseHeader {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    // Read as little-endian
    const seqNo = view.getUint32(0, true);
    const cmd = view.getUint32(4, true);
    const pkgType = view.getUint32(8, true);
    const zipSize = view.getUint16(12, true);
    const unzipSize = view.getUint16(14, true);

    return { seqNo, cmd, pkgType, zipSize, unzipSize };
  }

  protected async readRemainingPackets(
    firstHeader: ResponseHeader,
    firstBody: Buffer,
  ): Promise<Buffer> {
    const parts: Buffer[] = [firstBody];
    let header = firstHeader;

    while (header.pkgType !== 0) {
      const nextHeadBuf = await this.socket.receive(RSP_HEADER_LEN);
      header = this.unpackResponseHeader(nextHeadBuf);
      let nextBody = await this.socket.receive(header.zipSize);

      if (header.zipSize < header.unzipSize) {
        nextBody = zlib.inflateSync(nextBody);
      }

      parts.push(nextBody);
    }

    return Buffer.concat(parts);
  }
}
