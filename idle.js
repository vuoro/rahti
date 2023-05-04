export let requestIdleCallback = globalThis.requestIdleCallback;
export let cancelIdleCallback = globalThis.cancelIdleCallback;

if (!requestIdleCallback) {
  const timeAllowance = 12;
  let startedAt = performance.now();
  const fallbackDeadline = {
    timeRemaining: () => Math.max(0, timeAllowance - (performance.now() - startedAt)),
    didTimeout: false,
  };
  const { timeRemaining } = fallbackDeadline;
  const fallbackSchedule = new Set();
  let fallbackStep = null;

  requestIdleCallback = (callback) => {
    fallbackSchedule.add(callback);
    fallbackStep = fallbackStep || setTimeout(runFallbackSchedule);
    return fallbackStep;
  };

  cancelIdleCallback = (id) => clearTimeout(id);

  const runFallbackSchedule = () => {
    startedAt = performance.now();

    for (const item of fallbackSchedule) {
      fallbackSchedule.delete(item);
      item(fallbackDeadline);
      if (timeRemaining() <= 0) break;
    }

    fallbackStep = fallbackSchedule.size > 0 ? setTimeout(runFallbackSchedule) : null;
  };
}

let currentResolve = null;
const promiseResolveCatcher = (resolve) => (currentResolve = resolve);
let currentIdle = null;

const idleCallback = (deadline) => {
  currentIdle = null;
  currentResolve(deadline);
};

export const idle = async () => {
  if (!currentIdle) {
    currentIdle = new Promise(promiseResolveCatcher);
    requestIdleCallback(idleCallback);
  }

  return currentIdle;
};
