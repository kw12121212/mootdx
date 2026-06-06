# mootdx-ts

TypeScript port of [mootdx](https://github.com/rainx/mootdx) — 通达信股票行情数据接口。

## Install

```bash
bun add mootdx
# or
npm install mootdx
```

## Quick Start

```typescript
import { quotes, reader, to_file } from "mootdx";

// Online quotes
const q = await quotes("std");
const bars = await q.bars("600000", "days");
console.table(bars.slice(0, 5));

// Local file reader
const r = await reader("std", "/path/to/new_tdx");
const daily = r.daily("600000");

// Save to file
to_file(bars, "output.json");
```

## CLI

```bash
# Online quotes
mootdx quotes -s 600000 -a daily

# Local reader
mootdx reader -d /path/to/new_tdx -s 600000 -a daily

# Find fastest server
mootdx bestip

# Financial report files
mootdx affair -l          # list files
mootdx affair -f gpcw20240101.zip  # download

# Batch download
mootdx bundle -s 600000,000001 -a daily -e csv
```

## API Overview

### Quotes (Online)

```typescript
const q = await quotes("std"); // or "ext" for extended market

await q.bars(symbol, frequency, start, offset);
await q.index(symbol, frequency, start, offset);
await q.quotes(symbols);
await q.minute(symbol);
await q.transaction(symbol, start, offset);
await q.xdxr(symbol);       // dividend/split data
await q.finance(symbol);    // financial info
await q.F10(symbol, name);  // company info
await q.block(symbol);      // sector data

// Extended market
await q.stockCount(market);
await q.securityList(market, start);
await q.instrumentBars(freq, market, symbol);
await q.instrumentQuote(market, symbols);
```

### Reader (Offline Files)

```typescript
const r = await reader("std", tdxdir);

r.daily(symbol);          // .day files
r.minute(symbol, 1 | 5);  // .lc1/.lc5 or .1/.5 files
r.block(symbol);          // block_*.dat files
r.block_new(name, codes); // custom blocks
```

### Price Adjustment

```typescript
import { toAdjust, fqFactor, factorReversion, etfReversion } from "mootdx";

const adjusted = await toAdjust(data, "600000", "qfq");
const factors = await fqFactor("sh600000", "qfq");
const adjusted2 = factorReversion(data, factors, "qfq");
const etfAdj = etfReversion(data, xdxrRecords, "01");
```

### Financial Data (Affair)

```typescript
import { Affair } from "mootdx";

const files = await Affair.files();
await Affair.fetch("/output");
const data = await Affair.parse("/output", "file.zip");
```

### Holidays

```typescript
import { holidays, isHoliday, tdxHolidays } from "mootdx";

const all = await holidays();
const off = await isHoliday("2024-01-01");
const tdx = await tdxHolidays();
```

## Development

```bash
bun install
bun test
bun run build
bun run lint
```

## License

MIT
