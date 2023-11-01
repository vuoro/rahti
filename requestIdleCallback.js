let requestIdleCallbackPonyfilled = globalThis.requestIdleCallback;

if (!requestIdleCallbackPonyfilled) {
  const timeAllowance = 8;
  let startedAt = performance.now();

  const fallbackDeadline = {
    timeRemaining: () => Math.max(0, timeAllowance - (performance.now() - startedAt)),
    didTimeout: false,
  };

  const fallbackSchedule = new Set();
  let fallbackStep = null;

  requestIdleCallbackPonyfilled = (callback) => {
    fallbackSchedule.add(callback);
    fallbackStep = fallbackStep || setTimeout(runFallbackSchedule);
    return fallbackStep;
  };

  const runFallbackSchedule = () => {
    startedAt = performance.now();
    for (const item of fallbackSchedule) {
      fallbackSchedule.delete(item);
      item(fallbackDeadline);
      if (fallbackDeadline.timeRemaining() === 0) break;
    }
    fallbackStep = fallbackSchedule.size > 0 ? setTimeout(runFallbackSchedule) : null;
  };
}

export { requestIdleCallbackPonyfilled };
