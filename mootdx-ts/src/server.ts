import net from "node:net";
import { createLogger } from "./logger";
import { getConfig, set as configSet } from "./config";
import { get_config_path } from "./utils";
import { HQ_HOSTS, EX_HOSTS, GP_HOSTS } from "./consts";
import { writeFile } from "node:fs/promises";

const log = createLogger("server");

export interface ServerHost {
  name: string;
  addr: string;
  port: number;
  time: number | null;
}

const TIMEOUT_MS = 700;

function hostsToList(hosts: readonly (readonly [string, string, number])[]): ServerHost[] {
  return hosts.map(([name, addr, port]) => ({ name, addr, port, time: null }));
}

export async function connect(proxy: ServerHost): Promise<ServerHost> {
  return new Promise((resolve) => {
    const start = performance.now();
    const sock = new net.Socket();
    sock.setTimeout(TIMEOUT_MS);

    sock.connect(proxy.port, proxy.addr, () => {
      const elapsed = performance.now() - start;
      sock.destroy();
      resolve({ ...proxy, time: elapsed });
    });

    sock.on("timeout", () => {
      sock.destroy();
      resolve({ ...proxy, time: null });
    });

    sock.on("error", () => {
      sock.destroy();
      resolve({ ...proxy, time: null });
    });
  });
}

export async function server(
  index: "HQ" | "EX" | "GP",
  limit = 5,
): Promise<ServerHost[]> {
  const hostMap: Record<string, readonly (readonly [string, string, number])[]> = {
    HQ: HQ_HOSTS,
    EX: EX_HOSTS,
    GP: GP_HOSTS,
  };
  const hosts = hostsToList(hostMap[index] ?? []);
  const results = await Promise.all(hosts.map((h) => connect(h)));
  const ok = results.filter((r) => r.time !== null);
  ok.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  return limit > 0 ? ok.slice(0, limit) : ok;
}

export async function bestip(limit = 5): Promise<void> {
  log.info("finding fastest servers...");

  const config = getConfig();
  const best: Record<string, [string, number]> = {};

  for (const index of ["HQ", "EX", "GP"] as const) {
    try {
      const results = await server(index, limit);
      if (results.length > 0) {
        const bestHost = results[0]!;
        best[index] = [bestHost.addr, bestHost.port];
        log.info(`${index} best: ${bestHost.addr}:${bestHost.port} (${bestHost.time?.toFixed(1)}ms)`);
      }
    } catch (err) {
      log.warn(`failed to test ${index} servers: ${err}`);
    }
  }

  configSet("BESTIP", best);
  const configPath = get_config_path("config.json");
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export { bestip as checkServer };
