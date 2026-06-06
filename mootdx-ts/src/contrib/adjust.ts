import { createLogger } from "../logger";
import type { OhlcBar } from "../types";

const log = createLogger("contrib:adjust");

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  Referer: "http://stockpage.10jqka.com.cn/",
  DNT: "1",
};

export async function getAdjustYear(
  symbol: string,
  year?: number,
  factor: string = "00",
): Promise<OhlcBar[]> {
  if (factor === "before") factor = "01";
  if (factor === "after") factor = "02";

  if (factor !== "01" && factor !== "02") {
    log.warn("factor must be before, after, 01, or 02");
    return [];
  }

  const y = year ?? new Date().getFullYear();

  try {
    const url = `http://d.10jqka.com.cn/v2/line/hs_${symbol}/${factor}/${y}.js`;
    const resp = await fetch(url, { headers: HEADERS });

    if (!resp.ok) {
      log.warn(`request failed: ${resp.status}`);
      return [];
    }

    const text = await resp.text();
    const jsonMatch = text.match(/\((.*)\)/);
    if (!jsonMatch) {
      log.warn("data parse error, rate limited");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[1]!) as { data: string };
    const items = parsed.data.split(";");
    return items
      .filter((item) => item.length > 0)
      .map((item) => {
        const cols = item.split(",").slice(0, 8);
        if (cols.length < 7) return null;
        return {
          date: cols[0]!,
          open: parseFloat(cols[1]!),
          high: parseFloat(cols[2]!),
          low: parseFloat(cols[3]!),
          close: parseFloat(cols[4]!),
          vol: parseFloat(cols[5]!),
          amount: parseFloat(cols[6]!),
        } as OhlcBar;
      })
      .filter((r): r is OhlcBar => r !== null && !isNaN(r.open));
  } catch (err) {
    log.warn(`getAdjustYear failed: ${err}`);
    return [];
  }
}
