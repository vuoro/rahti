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
