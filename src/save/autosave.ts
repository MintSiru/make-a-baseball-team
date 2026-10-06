/* Autosave without stalls (V0.14): writing a 10MB league after every click froze the page on phones. Saves
   now wait a moment and run one at a time; while one runs, only the newest state waits behind it, so a
   burst of clicks costs one or two writes instead of one each. */

export interface AutoSaver<T> {
  /** Saves this state soon (replacing any state still waiting). */
  schedule(state: T): void;
  /** Saves what is waiting now and resolves when every write has finished. */
  flush(): Promise<void>;
}

/** Browsers refuse setTimeout called as a method of another object ("Illegal invocation"): wrap it. */
const WINDOW_TIMERS = { set: ((f: () => void, ms: number) => setTimeout(f, ms)) as typeof setTimeout, clear: ((id: ReturnType<typeof setTimeout>) => clearTimeout(id)) as typeof clearTimeout };

export function autoSaver<T>(write: (state: T) => Promise<void>, delay = 300, timers: { set: typeof setTimeout; clear: typeof clearTimeout } = WINDOW_TIMERS): AutoSaver<T> {
  let waiting: { state: T } | null = null;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const drain = async () => {
    while (waiting) {
      const { state } = waiting;
      waiting = null;
      await write(state);
    }
  };
  const start = () => {
    if (timer) {
      timers.clear(timer);
      timer = null;
    }
    if (!running)
      running = drain()
        .catch(() => undefined) // the writer reports its own failures
        .finally(() => {
          running = null;
          // Something arrived while the last write finished.
          if (waiting) start();
        });
    return running;
  };

  return {
    schedule(state) {
      waiting = { state };
      if (running || timer) return;
      timer = timers.set(() => void start(), delay);
    },
    async flush() {
      if (waiting) await start();
      while (running) await running;
    },
  };
}
