import { describe, expect, test } from "bun:test";
import { goneStatus, shellThreadStatus, turnEndedAfter, type ShellThreadSnapshot } from "./threads.ts";

const shellThread = (latestRunId: string | null, status = "idle"): ShellThreadSnapshot => ({
  id: "thread-1",
  title: "grilling #12: Pick the sync model",
  status,
  latestRunId,
  latestRunStartedAt: latestRunId && "2026-10-01T04:00:00.000Z",
  latestRunCompletedAt: null,
  archivedAt: null,
});

const status = (latestRunId: string | null, state?: string) => shellThreadStatus({ threads: [shellThread(latestRunId, state)] }, "thread-1");

describe("shellThreadStatus", () => {
  test("reports the latest run as the turn", () => {
    expect(status("run-2", "running")).toMatchObject({ gone: false, turn: "run-2", state: "running", startedAt: "2026-10-01T04:00:00.000Z" });
  });

  test("reports a thread the shell no longer lists, or lists as archived, as gone", () => {
    expect(shellThreadStatus({ threads: [] }, "thread-1").gone).toBe(true);
    expect(shellThreadStatus({ threads: [{ ...shellThread("run-1"), archivedAt: "2026-10-02T00:00:00.000Z" }] }, "thread-1").gone).toBe(true);
  });
});

describe("turnEndedAfter", () => {
  test("waits while the first run has not started", () => {
    expect(turnEndedAfter(status(null))).toBe(false);
  });

  test("waits while a run prepares, queues, starts, runs, or waits for input", () => {
    for (const state of ["preparing", "queued", "starting", "running", "waiting"]) {
      expect(turnEndedAfter(status("run-2", state), "run-1")).toBe(false);
    }
  });

  test("waits while the latest run is the one already seen", () => {
    expect(turnEndedAfter(status("run-1", "completed"), "run-1")).toBe(false);
  });

  test("ends on a newer run that completed, failed, or was interrupted", () => {
    for (const state of ["completed", "failed", "interrupted", "cancelled"]) {
      expect(turnEndedAfter(status("run-2", state), "run-1")).toBe(true);
    }
  });

  test("ends when the thread is archived or deleted", () => {
    expect(turnEndedAfter(goneStatus("thread-1"), "run-1")).toBe(true);
  });
});
