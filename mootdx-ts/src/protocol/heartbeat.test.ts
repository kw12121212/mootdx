import { test, expect } from "bun:test";
import { HeartbeatManager } from "./heartbeat";

test("HeartbeatManager starts and stops cleanly", () => {
  const mgr = new HeartbeatManager({
    onHeartbeat: async () => {},
    onDisconnect: () => {},
  });

  mgr.start();
  expect(() => mgr.start()).not.toThrow(); // double start is ok
  mgr.stop();
  mgr.stop(); // double stop is ok
});

test("HeartbeatManager calls onDisconnect after max failures", async () => {
  let disconnected = false;
  let heartbeats = 0;

  const mgr = new HeartbeatManager({
    onHeartbeat: async () => {
      heartbeats++;
      throw new Error("fail");
    },
    onDisconnect: () => {
      disconnected = true;
    },
    interval: 10,
    maxFailures: 3,
  });

  mgr.start();

  // Wait enough ticks for 3 failures
  await new Promise((r) => setTimeout(r, 100));

  expect(heartbeats).toBeGreaterThanOrEqual(3);
  expect(disconnected).toBe(true);
});

test("HeartbeatManager notifyActivity prevents heartbeat when recent", async () => {
  let heartbeats = 0;

  const mgr = new HeartbeatManager({
    onHeartbeat: async () => {
      heartbeats++;
    },
    onDisconnect: () => {},
    interval: 50,
  });

  mgr.start();
  mgr.notifyActivity();

  await new Promise((r) => setTimeout(r, 30));
  mgr.stop();

  // heartbeat should not have fired since activity was recent
  expect(heartbeats).toBe(0);
});
