import { requestIdleCallback } from "./idle.js";

const reportError = globalThis.reportError || console.error;

export const Component = {
  getKey: undefined,
  apply: function (code, _, argumentsList) {
    const parent = getInstance();
    const key = this.getKey?.apply(null, argumentsList);
    const instance = findInstance(code, parent, key) || createInstance(code, parent, key);

    if (parent !== topLevel) parent.currentIndex++;
    return run(instance, argumentsList);
  },
  get: function (code, property) {
    if (property === "_rahtiCode") return code;
    return code[property];
  },
};

class Instance {
  currentIndex = 0;
  needsUpdate = false;

  parent = null;
  lastValue = undefined;
  lastArguments = null;
  savedData = null;
  cleaner = null;

  key = null;
  children = [];
  code = null;
}

export const getInstance = () => {
  return stack.at(-1);
};
export const save = (dataToSave) => {
  getInstance().savedData = dataToSave;
  return dataToSave;
};
export const load = () => {
  return getInstance().savedData;
};
export const cleanup = (cleaner) => {
  const instance = getInstance();
  if (instance.cleaner) throw new Error("only 1 `cleanup()` allowed per component instance");
  instance.cleaner = cleaner;
};

const topLevel = new Instance();
const stack = [topLevel];

const instancePool = [];

const createInstance = (code, parent, key) => {
  let instance;

  if (instancePool.length) {
    instance = instancePool.pop();
  } else {
    instance = new Instance();
  }

  // Get or create parent's children
  parent.children = parent.children || [];

  // Get parent's current index and save as a child using it
  const index = parent.currentIndex;
  parent.children.splice(index, 0, instance);

  // Save the parent, the key, and the Component
  instance.parent = parent;
  instance.key = key;
  instance.code = code;

  // Mark as needing an update
  instance.needsUpdate = true;

  // console.log("created at", parent.currentIndex);

  if (import.meta.hot) {
    // Add this instance into the HMR instance registry,
    // so it can be found when HMR gets new versions of its Component
    globalThis._rahtiHmrInstances?.get(code)?.add(instance);
  }

  return instance;
};

const findInstance = (code, parent, key) => {
  // console.log("looking for", Component.name, "in", Components.get(parentId).name, "with key:", key);
  if (parent.children) {
    // Find the current child
    const currentIndex = parent.currentIndex;
    const currentChild = parent.children[currentIndex];

    if (currentChild && currentChild.code === code && currentChild.key === key) {
      // The child looks like what we're looking for
      // console.log("found here");
      return currentChild;
    }

    // Try to find the a matching child further on
    for (let index = currentIndex + 1; index < parent.children.length; index++) {
      const child = parent.children[index];
      if (child.code === code && child.key === key) {
        // This one looks correct, so move it into its new place
        parent.children.splice(index, 1);
        parent.children.splice(currentIndex, 0, child);
        // console.log("found later");
        return child;
      }
    }

    // console.log("did not find matching children");
  } else {
    // console.log("there were no children for");
  }
};

const run = (instance, newArguments) => {
  // See if the instance should re-run
  let needsUpdate = instance.needsUpdate;

  if (!needsUpdate) {
    if (instance.lastArguments?.length !== newArguments.length) {
      // console.log("argument length changed", instance.lastArguments, newArguments);
      needsUpdate = true;
    } else {
      // Check arguments
      for (let index = 0; index < newArguments.length; index++) {
        const previousArgument = instance.lastArguments[index];
        const newArgument = newArguments[index];

        if (!Object.is(newArgument, previousArgument)) {
          // console.log("argument has changed", previousArgument, newArgument);
          needsUpdate = true;
          break;
        }
      }
    }
  }

  // Save this run's arguments for next time
  instance.lastArguments = newArguments;

  if (needsUpdate) {
    // Run the instance
    // console.log("+++ start of", instance.Component?.name);

    // Run the cleanup, if there is one
    runCleanup(instance, false);

    // Run the instance's Component
    stack.push(instance);
    instance.currentIndex = 0;
    let result;

    try {
      let code = instance.code;
      if (import.meta.hot) {
        // Use the latest HMR'd version of this component, if available
        code = globalThis._rahtiHmrComponentReplacements?.get(code) || code;
      }

      result = code.apply(instance, newArguments);

      // Save the new value
      instance.lastValue = result;

      // Mark as no longer needing update
      instance.needsUpdate = false;
      updateQueue.delete(instance);
    } catch (error) {
      // console.log("caught");
      reportError(error);
    } finally {
      stack.pop();

      // Destroy children that were not visited on this execution
      if (instance.children) {
        const nextIndex = instance.currentIndex;
        const { length } = instance.children;

        if (nextIndex < length) {
          // console.log("/// destroying leftover children in", Component.name, length - nextIndex);
          for (let index = nextIndex; index < length; index++) {
            destroy(instance.children[index]);
          }
          instance.children.splice(nextIndex);
        }
      }
    }

    // console.log("--- returning", result, "from", Component.name, instance);
    return result;
  }

  // Skip running and return the previous value
  // console.log("!!! skipping update for", instance.Component?.name);
  return instance.lastValue;
};

const runCleanup = (instance, isBeingDestroyed = false) => {
  if (instance.cleaner) {
    instance.cleaner(instance.savedData, instance, isBeingDestroyed);
    instance.cleaner = null;
  }
};

const destroy = async (instance) => {
  // console.log("destroying", Components.get(id).name);

  // If there's an ongoing run, wait for it
  if (instance.pendingPromise) {
    // console.log("??? waiting for", Components.get(id).name, "to finish before destroying");
    await instance.pendingPromise;
    // console.log("??? continuing with destroying", Components.get(id).name);
  }

  // Run the cleanup, if there is any
  runCleanup(instance, true);

  // Destroy children
  if (instance.children) {
    for (const child of instance.children) {
      destroy(child);
    }
  }

  if (import.meta.hot) {
    // Remove this instance from the HMR instance registry
    globalThis._rahtiHmrInstances?.get(instance.code)?.delete(instance);
  }

  // Clean up instance
  instance.currentIndex = 0;
  instance.needsUpdate = false;

  instance.parent = null;
  instance.lastValue = undefined;
  instance.lastArguments = null;
  instance.savedData = null;
  instance.cleaner = null;

  instance.key = null;
  instance.children = null;
  instance.code = null;

  // Add to pool for reuse
  instancePool.push(instance);
};

let updateQueueWillRun = false;
let updateQueueIsRunningImmediately = false;
const updateQueue = new Set();

export const update = (instance, immediately = false) => {
  if (getInstance() === instance) return;
  updateQueue.add(instance);

  if (immediately) updateQueueIsRunningImmediately = true;

  if (!updateQueueWillRun) {
    updateQueueWillRun = true;
    if (immediately) {
      runUpdateQueue();
    } else {
      requestIdleCallback(runUpdateQueue);
    }
  }
};

export const updateParent = (instance, immediately = false) => {
  if (instance.parent && instance.parent !== topLevel && getInstance() !== instance.parent)
    update(instance.parent, immediately);
};

const runUpdateQueue = function (deadline) {
  for (const instance of updateQueue) {
    if (!updateQueueIsRunningImmediately && deadline?.timeRemaining() === 0) {
      return requestIdleCallback(runUpdateQueue);
    }

    updateQueue.delete(instance);
    runUpdate(instance);
  }

  updateQueueWillRun = false;
  updateQueueIsRunningImmediately = false;
};

const runUpdate = function (instance) {
  if (instance.code === null) {
    // console.log("=== cancelling update because instance is gone");
    return;
  }

  instance.needsUpdate = true;
  const lastValue = instance.lastValue;
  const newValue = run(instance, instance.lastArguments);

  if (newValue !== lastValue) {
    // console.log("escalating update to parent from", instance.code);
    updateParent(instance);
  }
};

if (import.meta.hot) {
  // Save the updater, so the HMR code can use it to update instances as needed
  globalThis._rahtiUpdate = update;
}
