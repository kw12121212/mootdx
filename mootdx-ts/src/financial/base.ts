import { setup as configSetup, get as configGet } from "../config";
import { GP_HOSTS } from "../consts";
import { TdxBaseApi } from "../protocol/base";
import { setupCommands } from "../protocol/login";
import { getReportFileBySize } from "../protocol/report_file";
export type ReportHook = (downloaded: number, total: number) => void;

export abstract class BaseFinancial {
  protected bestip: [string, number];

  constructor() {
    configSetup();
    try {
      const bestip = configGet("BESTIP") as Record<string, [string, number]> | undefined;
      if (bestip?.GP) {
        this.bestip = bestip.GP;
      } else {
        this.bestip = [GP_HOSTS[0]![1], GP_HOSTS[0]![2]];
      }
    } catch {
      this.bestip = [GP_HOSTS[0]![1], GP_HOSTS[0]![2]];
    }
  }

  protected async createClient(): Promise<TdxBaseApi> {
    const client = new TdxBaseApi();
    await client.connect(this.bestip[0], this.bestip[1]);
    await setupCommands(client);
    return client;
  }

  abstract content(
    downdir?: string | null,
    reportHook?: ReportHook | null,
    chunkSize?: number,
  ): Promise<Buffer | null>;

  abstract parse(downloadFile: Buffer): unknown;

  async fetchAndParse(
    downdir?: string | null,
    reportHook?: ReportHook | null,
    chunkSize?: number,
  ): Promise<unknown> {
    const file = await this.content(downdir, reportHook, chunkSize);
    if (!file) return null;
    return this.parse(file);
  }
}

export { getReportFileBySize };
