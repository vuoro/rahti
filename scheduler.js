import { isServer } from "./server-side-rendering.js";

export const schedule = isServer
  ? () => {}
  : window.requestIdleCallback ||
    ((callback) => {
      fallbackSchedule.add(callback);
      return fallbackFrame || requestAnimationFrame(fallbackScheduler);
    });

export const unschedule = isServer
  ? () => {}
  : window.requestIdleCallback || ((callback) => fallbackSchedule.delete(callback));

let fallbackFrame = null;
const fallbackSchedule = new Set();

let timeAllowance = 12;
export const setTimeAllowance = (amount) => (timeAllowance = amount);

const deadline = {
  timeRemaining: () => timeAllowance - (performance.now() - startedAt),
  didTimeout: false,
};
const { timeRemaining } = deadline;

let startedAt = performance.now();

const fallbackScheduler = (now) => {
  startedAt = now;

  for (const item of fallbackSchedule) {
    fallbackSchedule.delete(item);
    item(deadline);
    if (timeRemaining() <= 0) break;
  }

  fallbackFrame = fallbackSchedule.size > 0 ? requestAnimationFrame(fallbackScheduler) : null;
};
