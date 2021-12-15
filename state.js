import { defaultAreSame, effect, onCleanup, rerun, stack } from "./effect.js";
import { schedule } from "./scheduler.js";

const values = new WeakMap();
const nextValues = new WeakMap();
const setters = new WeakMap();

export const state = (defaultInitialValue, options) => {
  const areSame = options?.areSame || defaultAreSame;
  const getActions = options?.getActions;

  const accessor = effect(
    (initialValue = defaultInitialValue) => {
      const context = stack[stack.length - 1];

      if (!values.has(context)) values.set(context, initialValue);
      if (!setters.has(context)) {
        const get = () => values.get(context);
        const set = (newValue) => {
          if (!areSame || !areSame(get(), newValue)) {
            if (stack.length > 1) {
              // console.log("========================= setting later", newValue);
              updateQueue.add(context);
              nextValues.set(context, newValue);
              later = later || schedule(processQueues);
            } else {
              updateState(context, newValue);
            }
          }
        };

        setters.set(context, getActions ? getActions(get, set) : set);
      }

      return [values.get(context), setters.get(context)];
    },
    undefined,
    false
  );

  return accessor;
};

export const globalState = (defaultInitialValue, options) => {
  const areSame = options?.areSame || defaultAreSame;
  const getActions = options?.getActions;

  const subscribers = new Set();
  const globalIdentity = { subscribers };
  values.set(globalIdentity, defaultInitialValue);

  const get = () => values.get(globalIdentity);
  const set = (newValue) => {
    if (!areSame || !areSame(get(), newValue)) {
      if (stack.length > 1) {
        // console.log("========================= setting later", newValue);
        globalUpdateQueue.add(globalIdentity);
        nextValues.set(globalIdentity, newValue);
        later = later || schedule(processQueues);
      } else {
        for (const context of subscribers) {
          rerun(context);
        }
      }
    }
  };

  const setter = getActions ? getActions(get, set) : set;

  const accessor = effect(
    () => {
      const context = stack[stack.length - 1];
      subscribers.add(context);
      onCleanup((isFinal) => {
        if (isFinal) subscribers.delete(context);
      });

      return [values.get(globalIdentity), setter];
    },
    undefined,
    false
  );

  return accessor;
};

let later;
export const updateQueue = new Set();
const globalUpdateQueue = new Set();

const processQueues = (deadline) => {
  const updateIterator = updateQueue.values();
  const globalUpdateIterator = globalUpdateQueue.values();

  while (deadline.timeRemaining() > 0 || deadline.didTimeout) {
    const entry = updateIterator.next();
    if (entry.done) break;

    const context = entry.value;
    updateQueue.delete(context);

    const newValue = nextValues.get(context);
    nextValues.delete(context);
    updateState(context, newValue);
  }

  while (deadline.timeRemaining() > 0 || deadline.didTimeout) {
    const entry = globalUpdateIterator.next();
    if (entry.done) break;

    const globalIdentity = entry.value;
    globalUpdateQueue.delete(globalIdentity);

    const value = nextValues.get(globalIdentity);
    nextValues.delete(globalIdentity);
    values.set(globalIdentity, value);

    for (const context of globalIdentity.subscribers) {
      rerun(context);
    }
  }

  later = later =
    updateQueue.size > 0 || globalUpdateQueue.size > 0 ? schedule(processQueues) : null;
};

const updateState = (context, newValue) => {
  // console.log("================ setting", newValue, context);
  values.set(context, newValue);
  rerun(context);
};
