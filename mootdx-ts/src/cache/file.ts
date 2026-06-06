import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { FileNeedRefresh } from "../exceptions";

export function fileCache<T>(filepath: string, refreshSeconds?: number) {
  return (_target: object, _propertyKey: string, descriptor: TypedPropertyDescriptor<() => T>) => {
    const original = descriptor.value!;
    descriptor.value = function (this: unknown, ...args: unknown[]): T {
      if (existsSync(filepath)) {
        const stat = { mtime: 0 };
        try {
          const fs = require("node:fs");
          const s = fs.statSync(filepath);
          stat.mtime = s.mtimeMs;
        } catch { /* ignore */ }

        if (refreshSeconds != null) {
          const age = (Date.now() - stat.mtime) / 1000;
          if (age > refreshSeconds) {
            throw new FileNeedRefresh(`Cache expired: ${filepath}`);
          }
        }

        try {
          const raw = readFileSync(filepath, "utf-8");
          const data = JSON.parse(raw);
          return data as T;
        } catch { /* fall through to compute */ }
      }

      const result = (original as (...a: unknown[]) => T).apply(this, args);
      try {
        writeFileSync(filepath, JSON.stringify(result), "utf-8");
      } catch { /* ignore write errors */ }
      return result;
    };
    return descriptor;
  };
}
