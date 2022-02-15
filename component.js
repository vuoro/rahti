import { getDomCode } from "./dom.js";

const reportError = window.reportError || console.error;

const parents = new WeakMap();
const childrens = new WeakMap();
const currentIndexes = new WeakMap();
const appliers = new WeakMap();
const keys = new WeakMap();
const codes = new WeakMap();
const argumentCache = new WeakMap();
const valueCache = new WeakMap();
const pendings = new WeakMap();

// Create a root component
// it can never update, but can be manually re-applied
export const root = function (code) {
  const component = createComponent(code, rootComponent);
  return appliers.get(component);
};

const rootComponent = () => {};
codes.set(rootComponent, root);

// Custom renderers, DOM by default
let renderer = getDomCode;
export const setRenderer = (newRenderer) => (renderer = newRenderer);

const createComponent = (code, parent, key) => {
  // Create the component, or the `this`
  const component = function (code, key) {
    // If code is a string, use the renderer
    let finalCode = code;
    if (typeof code === "string") {
      finalCode = renderer(code);
    }

    // Find or create a child component
    console.log(
      "looking for",
      finalCode.name,
      "in",
      codes.get(component).name,
      "with key",
      key,
      "at",
      currentIndexes.get(component)
    );
    const found = getComponent(finalCode, component, key);
    const child = found || createComponent(finalCode, component, key);
    currentIndexes.set(component, currentIndexes.get(component) + 1);

    return appliers.get(child);
  };

  // Create the applier function, or `this(code)()`
  const applyComponent = function () {
    // If component is already running, delay this run until it finishes
    // (this should be a very rare occurrence, so it's not very optimized)
    if (pendings.has(component)) {
      const pendingPromise = pendings.get(component);
      const promise = new Promise(promiseResolveCatcher);
      const resolve = currentResolve;

      pendingPromise.finally(() => {
        resolve(applyComponent.apply(undefined, arguments));
      });

      return promise;
    }

    // See if the component should re-run
    let needsUpdate = needsUpdates.has(component);

    if (!needsUpdate) {
      const previousArguments = argumentCache.get(component);
      if (previousArguments.length !== arguments.length) {
        needsUpdate = true;
      } else {
        for (let index = 0; index < arguments.length; index++) {
          const previousArgument = previousArguments[index];
          const newArgument = arguments[index];
          if (newArgument !== previousArgument) {
            needsUpdate = true;
            break;
          }
        }
      }
    }

    // Save this run's arguments for next time
    argumentCache.set(component, arguments);

    if (needsUpdate) {
      // Run the component
      console.log("+++ start of", code.name);

      // Run the cleanup, if there is one
      const cleaner = cleanupResolvers.get(component);
      if (cleaner) {
        cleanups.delete(component);
        cleanupResolvers.delete(component);
        console.log("running cleanup for", codes.get(component).name);
        cleaner(false);
      }

      // Run the component's code
      currentIndexes.set(component, 0);
      let result;
      try {
        result = code.apply(component, arguments);
      } catch (error) {
        reportError(error);
      }

      // If it returned something, note that it's code might do so
      if (!mightReturns.has(code) && result !== undefined) {
        mightReturns.add(code);
      }

      // Save the new value
      valueCache.set(component, result);
      needsUpdates.delete(component);

      // Housekeeping
      const seemsLikeAPromise = typeof result?.then === "function";

      if (seemsLikeAPromise) {
        pendings.set(component, result);
        result.finally(handleEndOfComponent);
      } else {
        handleEndOfComponent(result);
      }

      return result;
    } else {
      // Skip running and return the previous value
      console.log("!!! skipping update for", code.name);
      return valueCache.get(component);
    }
  };
  appliers.set(component, applyComponent);

  const handleEndOfComponent = () => {
    // Destroy children that were not visited on this execution
    const children = childrens.get(component);
    if (children) {
      const nextIndex = currentIndexes.get(component) + 1;
      const { length } = children;

      if (nextIndex < length) {
        console.log(
          "destroying leftover children in ",
          codes.get(component).name,
          length - nextIndex
        );
        for (let index = nextIndex; index < length; index++) {
          destroy(children[index]);
        }
        children.splice(nextIndex);
      }
    }

    pendings.delete(component);

    console.log("--- end of", code.name);
  };

  // Get or create parent's children
  let children = childrens.get(parent);
  if (!children) {
    console.log("starting children for", codes.get(parent).name);
    children = [];
    childrens.set(parent, children);
  }

  // Get parent's current index and save as a child using it
  const index = currentIndexes.get(parent);
  children.splice(index, 0, component);

  // Save the parent, the key, and the code
  parents.set(component, parent);
  keys.set(component, key);
  codes.set(component, code);

  // Mark as needing an update
  console.log("created", code.name, "in", codes.get(parent).name, "at", currentIndexes.get(parent));
  needsUpdates.add(component);

  return component;
};

const getComponent = (code, parent, key) => {
  const children = childrens.get(parent);

  if (children) {
    // Find the current child
    const currentIndex = currentIndexes.get(parent);
    const currentChild = childrens.get(parent)[currentIndex];

    if (currentChild && codes.get(currentChild) === code && keys.get(currentChild) === key) {
      // The child looks like what we're looking for
      console.log("found here", codes.get(currentChild).name);
      return currentChild;
    } else {
      // Try to find the a matching child further on
      for (let index = currentIndex + 1, { length } = children; index < length; index++) {
        const child = children[index];
        if (codes.get(child) === code && keys.get(child) === key) {
          // This one looks correct, so move it into its new place
          children.splice(index, 1);
          children.splice(currentIndex, 0, child);
          console.log("found later", codes.get(child).name);
          return child;
        }
      }
    }

    console.log("did not find matching children");
  } else {
    console.log("there were no children");
  }
};

const destroy = (component) => {
  console.log("destroying", codes.get(component).name);

  // Run the cleanup, if there is any
  const cleaner = cleanupResolvers.get(component);
  if (cleaner) {
    cleanups.delete(component);
    cleanupResolvers.delete(component);
    console.log("running final cleanup for", codes.get(component).name);
    cleaner(true);
  }

  const children = childrens.get(component);

  // Destroy children
  if (children) {
    for (const child of children) {
      destroy(child);
    }
  }
};

let currentResolve;
const promiseResolveCatcher = (resolve) => (currentResolve = resolve);

const cleanups = new WeakMap();
const cleanupResolvers = new WeakMap();

export const cleanup = (component) => {
  let promise = cleanups.get(component);

  if (!promise) {
    // Create a promise to trigger when the component is cleaning up
    promise = new Promise(promiseResolveCatcher);
    cleanups.set(component, promise);
    cleanupResolvers.set(component, currentResolve);
  }

  return promise;
};
export const cleanUp = cleanup;

const needsUpdates = new WeakSet();
const mightReturns = new WeakSet();
const updateQueue = new Set();
let queueWillRun = false;

export const update = (component) => {
  console.log("=== updating", codes.get(component).name);
  needsUpdates.add(component);
  let current = component;

  while (mightReturns.has(codes.get(current))) {
    needsUpdates.add(current);
    const parent = parents.get(current);
    if (parent === rootComponent) break;
    current = parent;
  }

  if (current !== component) console.log("escalated update up to", codes.get(current).name);
  needsUpdates.add(current);
  updateQueue.add(current);

  if (!queueWillRun) {
    queueWillRun = true;
    queueMicrotask(runUpdateQueue);
  }
};

const runUpdateQueue = () => {
  for (const component of updateQueue) {
    if (pendings.has(component)) {
      console.log("!!!", codes.get(component).name, "is pending, waiting");
      continue;
    }

    updateQueue.delete(component);
    const applier = appliers.get(component);
    applier.apply(undefined, argumentCache.get(component));
  }

  if (updateQueue.size > 0) {
    requestIdleCallback(runUpdateQueue);
  } else {
    queueWillRun = false;
  }
};
