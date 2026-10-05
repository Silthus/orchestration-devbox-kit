export type ThreadStatus = {
  thread: string;
  gone: boolean;
  title: string | null;
  turn: string | null;
  state: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

// A thread as the shell snapshot of orchestration protocol 2 lists it: its latest run stands in for the latest turn.
export type ShellThreadSnapshot = {
  id: string;
  title: string;
  status: string;
  latestRunId: string | null;
  latestRunStartedAt?: string | null;
  latestRunCompletedAt?: string | null;
  lastError?: string | null;
  archivedAt?: string | null;
};

const ACTIVE_STATES = new Set(["preparing", "queued", "starting", "running", "waiting"]);

export function threadStatus(thread: ShellThreadSnapshot): ThreadStatus {
  return {
    thread: thread.id,
    gone: false,
    title: thread.title,
    turn: thread.latestRunId,
    state: thread.latestRunId ? thread.status : null,
    startedAt: thread.latestRunStartedAt ?? null,
    completedAt: thread.latestRunCompletedAt ?? null,
    error: thread.lastError ?? null,
  };
}

export function goneStatus(threadId: string): ThreadStatus {
  return { thread: threadId, gone: true, title: null, turn: null, state: null, startedAt: null, completedAt: null, error: null };
}

export function shellThreadStatus(shell: { threads: ShellThreadSnapshot[] }, threadId: string): ThreadStatus {
  const thread = shell.threads.find((t) => t.id === threadId && !t.archivedAt);
  return thread ? threadStatus(thread) : goneStatus(threadId);
}

export function turnStarted(status: ThreadStatus): boolean {
  return status.turn !== null;
}

export function turnEndedAfter(status: ThreadStatus, previousTurn?: string): boolean {
  if (status.gone) return true;
  return status.turn !== null && status.turn !== previousTurn && !ACTIVE_STATES.has(status.state ?? "");
}
