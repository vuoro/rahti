let currentResolve;
const promiseResolveCatcher = (resolve) => (currentResolve = resolve);

export let requestIdleCallback = window.requestIdleCallback;

if (!requestIdleCallback) {
  let timeAllowance = 12;
  let startedAt = performance.now();
  const fallbackDeadline = {
    timeRemaining: () => timeAllowance - (performance.now() - startedAt),
    didTimeout: false,
  };
  const { timeRemaining } = fallbackDeadline;
  const fallbackSchedule = new Set();
  let fallbackStep = null;

  requestIdleCallback = (callback) => {
    fallbackSchedule.add(callback);
    fallbackStep = fallbackStep || setTimeout(runFallbackSchedule);
  };
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

export const idle = () => {
  const promise = new Promise(promiseResolveCatcher);
  requestIdleCallback(currentResolve);
  return promise;
};
