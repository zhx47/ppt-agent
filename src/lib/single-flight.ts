export function createSingleFlightRunner(task: () => Promise<void>) {
  let disposed = false;
  let inFlight = false;
  let rerunRequested = false;

  const run = async () => {
    if (disposed || inFlight) {
      return;
    }

    inFlight = true;
    try {
      do {
        rerunRequested = false;
        await task();
      } while (rerunRequested && !disposed);
    } catch (error) {
      if (!disposed) {
        console.error('Single-flight task failed.', error);
      }
    } finally {
      inFlight = false;
    }
  };

  return {
    schedule() {
      if (disposed) {
        return;
      }
      if (inFlight) {
        rerunRequested = true;
        return;
      }
      void run();
    },
    dispose() {
      disposed = true;
      rerunRequested = false;
    },
  };
}
