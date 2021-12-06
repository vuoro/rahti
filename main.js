import { registerForSsr, isServer } from "./server-side-rendering.js";

const defaultAreDifferent = (a, b) => a === b;
const schedule = isServer ? () => {} : window.requestIdleCallback || window.requestAnimationFrame;
let later;
const updateQueue = new Set();
const processQueue = () => {
  for (const context of updateQueue) {
    updateState(context, context.body.nextValue);
  }
  later = null;
};
const updateState = (context, newValue) => {
  // console.log("================ setting", newValue);
  context.body[0] = newValue;

  const { globalParents } = context.body;

  if (globalParents) {
    for (const parent of globalParents) {
      rerun(parent);
    }
  } else {
    rerun(context.parent);
  }
};

const createContext = (body, type, key) => {
  // console.log("create", type, key);
  return {
    children: [],
    cleanups: new Set(),
    value: null,
    shouldUpdate: true,
    parent: null,
    key,
    type,
    body,
  };
};

const rootContext = createContext(() => {}, "rootContext");
const stateType = "state";
const globalStateType = "globalState";
const globalStateAccessorType = "globalStateAccessor";
let effectTypeCounter = 0;
const indexStack = [-1];
const stack = [rootContext];
const argumentCache = new WeakMap();

const rerun = (context) => {
  let contextToRerun = context;
  contextToRerun.shouldUpdate = true;

  // console.log("starting a rerun of", context.type);

  while (contextToRerun.body.hasReturned && contextToRerun.parent !== rootContext) {
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

const getContext = (type, key) => {
  let context;

  const parent = stack[stack.length - 1];
  const { children } = parent;

  indexStack[indexStack.length - 1]++;
  const currentIndex = indexStack[indexStack.length - 1];
  const currentChild = children[currentIndex];

  if (currentChild && currentChild.type === type && currentChild.key === key) {
    // If the current child looks like this one, use it
    // console.log("found here", `${type}:${key} at ${indexStack}`);
    context = currentChild;
  } else {
    // Try to find the next matching child
    for (let index = currentIndex + 1, { length } = children; index < length; index++) {
      const child = children[index];
      if (child.type === type && child.key === key) {
        // console.log("found later at", index, `${type}:${key} at ${indexStack}`);
        context = child;
        // Move it into its new place
        children.splice(index, 1);
        children.splice(currentIndex, 0, child);
        break;
      }
    }
  }

  return context;
};

const addContext = (context) => {
  const parent = stack[stack.length - 1];
  const index = indexStack[indexStack.length - 1];
  parent.children.splice(index, 0, context);
  context.parent = parent;
};

export const state = (defaultInitialValue, getSetter, areDifferent = defaultAreDifferent) => {
  const body = (initialValue = defaultInitialValue) => {
    let context = getContext(stateType);

    if (!context) {
      const body = [initialValue, null];

      const get = () => body[0];
      const set = (newValue) => {
        if (!areDifferent || !areDifferent(body[0], newValue)) {
          if (stack.length > 1) {
            // TODO: this might break on initial execution
            // console.log("========================= setting later", newValue);
            updateQueue.add(context);
            body.nextValue = newValue;
            later = later || schedule(processQueue);
          } else {
            updateState(context, newValue);
          }
        }
      };

      body[1] = getSetter ? getSetter(get, set) : set;

      context = createContext(body, stateType);
      addContext(context);
    }

    return context.body;
  };

  registerForSsr(body);
  return body;
};

export const globalState = (initialValue, getSetter, areDifferent = defaultAreDifferent) => {
  const storage = [initialValue, null];
  const globalParents = new Set();
  storage.globalParents = globalParents;

  const context = createContext(storage, globalStateType, storage);
  addContext(context);

  const get = () => storage[0];
  const set = (newValue) => {
    if (!areDifferent || !areDifferent(storage[0], newValue)) {
      if (stack.length > 1) {
        // TODO: this might break on initial execution
        // console.log("========================= setting later", newValue);
        updateQueue.add(context);
        storage.nextValue = newValue;
        later = later || schedule(processQueue);
      } else {
        updateState(context, newValue);
      }
    }
  };

  storage[1] = getSetter ? getSetter(get, set) : set;

  const body = () => {
    let context = getContext(globalStateAccessorType, storage);

    if (!context) {
      context = createContext(storage, globalStateAccessorType, storage);
      addContext(context);
      globalParents.add(context.parent);
    }

    return context.body;
  };

  registerForSsr(body);
  return body;
};

export const effect = (thing, areDifferent = defaultAreDifferent, shouldUseKey = true) => {
  const type = `${thing.name || "anonymous"} (${effectTypeCounter++})`;

  const body = function () {
    const key = shouldUseKey ? arguments[0] : undefined;
    let context = getContext(type, key);

    if (!context) {
      context = createContext(body, type, key);
      addContext(context);
    }

    if (!context.shouldUpdate || !areDifferent) {
      const previousArguments = argumentCache.get(context);
      const newLength = arguments.length;
      const previousLength = previousArguments.length;

      if (newLength !== previousLength) {
        context.shouldUpdate = true;
      } else {
        for (let index = 0; index < arguments.length; index++) {
          const previousArgument = previousArguments[index];
          const newArgument = arguments[index];
          if (!areDifferent(newArgument, previousArgument, index)) {
            context.shouldUpdate = true;
            break;
          }
        }
      }
    }

    argumentCache.set(context, arguments);

    if (context.shouldUpdate) {
      context.shouldUpdate = false;
      stack.push(context);
      indexStack.push(-1);

      runCleanup(context);
      try {
        context.value = thing.apply(null, arguments);
      } catch (error) {
        console.error(error);
      }

      if (!body.hasReturned && context.value !== undefined) body.hasReturned = true;

      // Destroy children that were not visited on this execution
      const { children } = context;
      const { length } = children;
      const nextIndex = indexStack[indexStack.length - 1] + 1;

      if (nextIndex < length) {
        // console.log("Destroying leftover children in ", type, key);
        for (let index = nextIndex; index < length; index++) {
          destroy(children[index]);
        }
        children.splice(nextIndex);
      }

      stack.pop();
      indexStack.pop();
    }

    return context.value;
  };

  registerForSsr(body);
  body.hasReturned = false;
  return body;
};

const destroy = (context) => {
  // console.log("destroying", context.type, context.key);
  runCleanup(context, true);
  context.parent = null;
  context.value = null;
  context.argumentCache.clear();
  context.key = null;

  if (context.type === globalStateAccessorType) {
    context.body.globalParents.delete(context);
  }

  for (const child of context.children) {
    destroy(child);
  }
  context.children.splice(0);
};

const runCleanup = ({ cleanups }, isFinal = false) => {
  for (const cleanup of cleanups) {
    // console.log(isFinal ? "running final cleanup" : "running cleanup", cleanup);
    try {
      cleanup(isFinal);
    } catch (error) {
      console.error(error);
    }
  }
  cleanups.clear();
};

export const onCleanup = (cleanup) => {
  stack[stack.length - 1].cleanups.add(cleanup);
};
