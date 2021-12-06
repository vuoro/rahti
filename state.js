import {
  argumentCache,
  defaultAreSame,
  effect,
  hasReturneds,
  indexStack,
  onCleanup,
  rootContext,
  stack,
} from "./effect.js";
import { isServer } from "./server-side-rendering.js";

const values = new WeakMap();
const nextValues = new WeakMap();
const setters = new WeakMap();

export const state = (defaultInitialValue, getSetter, areSame = defaultAreSame) => {
  const accessor = effect(
    (initialValue = defaultInitialValue) => {
      const context = stack[stack.length - 1];

      if (!values.has(context)) values.set(context, initialValue);
      if (!setters.has(context)) {
        const get = () => values.get(context);
        const set = (newValue) => {
          if (!areSame || !areSame(get(), newValue)) {
            if (stack.length > 1) {
              // TODO: this might break on initial execution
              // console.log("========================= setting later", newValue);
              updateQueue.add(context);
              nextValues.set(context, newValue);
              later = later || schedule(processQueue);
            } else {
              updateState(context, newValue);
            }
          }
        };

        setters.set(context, getSetter ? getSetter(get, set) : set);
      }

      return [values.get(context), setters.get(context)];
    },
    undefined,
    false
  );

  return accessor;
};

export const globalState = (defaultInitialValue, getSetter, areSame = defaultAreSame) => {
  const subscribers = new Set();
  const globalIdentity = { subscribers };
  values.set(globalIdentity, defaultInitialValue);

  const get = () => values.get(globalIdentity);
  const set = (newValue) => {
    if (!areSame || !areSame(get(), newValue)) {
      if (stack.length > 1) {
        // TODO: this might break on initial execution
        // console.log("========================= setting later", newValue);
        globalUpdateQueue.add(globalIdentity);
        nextValues.set(globalIdentity, newValue);
        later = later || schedule(processQueue);
      } else {
        for (const context of subscribers) {
          rerun(context);
        }
      }
    }
  };

  const setter = getSetter ? getSetter(get, set) : set;

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

const rerun = (context) => {
  let contextToRerun = context;
  contextToRerun.shouldUpdate = true;

  // console.log("starting a rerun of", context.type);

  while (
    hasReturneds.has(contextToRerun.body) &&
    // FIXME: this sucks
    contextToRerun.parent &&
    contextToRerun.parent !== rootContext
  ) {
    contextToRerun = contextToRerun.parent;
    // console.log("escalating rerun up to", contextToRerun.type);
    contextToRerun.shouldUpdate = true;
  }

  stack.push(contextToRerun.parent);
  indexStack.push(-1);
  contextToRerun.body.apply(null, argumentCache.get(contextToRerun));
  stack.pop();
  indexStack.pop();
};

const schedule = isServer ? () => {} : window.requestIdleCallback || window.requestAnimationFrame;
let later;
const updateQueue = new Set();
const globalUpdateQueue = new Set();

const processQueue = () => {
  for (const context of updateQueue) {
    const newValue = nextValues.get(context);
    nextValues.delete(context);
    updateState(context, newValue);
  }

  for (const globalIdentity of globalUpdateQueue) {
    values.set(globalIdentity, nextValues.get(globalIdentity));
    nextValues.delete(globalIdentity);

    for (const context of globalIdentity.subscribers) {
      rerun(context);
    }
  }

  later = null;
  updateQueue.clear();
  globalUpdateQueue.clear();
};

const updateState = (context, newValue) => {
  // console.log("================ setting", newValue, context);
  values.set(context, newValue);
  rerun(context);
};
