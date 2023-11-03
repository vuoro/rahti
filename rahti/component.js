import { DomElement } from "./dom.js";
import { requestIdleCallback } from "./idle.js";

const reportError = globalThis.reportError || console.error;

const asyncs = new Map();
const isAsync = (Component) => {
  const is = asyncs.get(Component);
  if (is === true) return true;
  if (is === false) return false;

  const isIt = Component.constructor.name === "AsyncFunction";
  asyncs.set(Component, isIt);
  return isIt;
};

const dummyProps = {};

class Instance {
  id = 0;
  currentIndex = 0;

  isAsync = false;
  needsUpdate = false;

  parent = null;
  pendingPromise = null;
  lastValue = undefined;
  lastArguments = null;
  savedData = null;
  savedCleanup = null;

  key = null;
  children = null;
  Component = null;

  save(dataToSave) {
    this.savedData = dataToSave;
    return dataToSave;
  }
  load() {
    return this.savedData;
  }
  cleanup(cleaner) {
    if (this.savedCleanup) throw new Error("A component instance can only have 1 cleanup");
    this.savedCleanup = cleaner;
  }

  run(inputComponent, ...inputArguments) {
    // DOM components
    const seemsLikeDom = typeof inputComponent === "string";
    if (seemsLikeDom && inputComponent === "rahti:fragment") {
      return inputArguments;
    }

    // Normal & DOM components
    const Component = seemsLikeDom ? DomElement : inputComponent;
    inputArguments[0] = inputArguments[0] || dummyProps;
    if (seemsLikeDom) inputArguments.splice(1, 0, inputComponent);
    const parent = this;
    const key = inputArguments[0].key || null;
    const instance = getInstance(Component, parent, key) || createInstance(Component, parent, key);

    if (parent.id !== null) parent.currentIndex++;

    return (instance.isAsync ? startAsync : start)(instance, inputArguments);
  }
}

export const rahti = new Instance();
rahti.id = null;

const instancePool = [];
let idCounter = Number.MIN_SAFE_INTEGER;

const createInstance = (Component, parent, key) => {
  let instance;

  if (instancePool.length) {
    instance = instancePool.pop();
  } else {
    instance = new Instance();
    instance.id = idCounter++;
  }

  // Get or create parent's children
  parent.children = parent.children || [];

  // Get parent's current index and save as a child using it
  const index = parent.currentIndex;
  parent.children.splice(index, 0, instance);

  // Save the parent, the key, and the Component
  instance.parent = parent;
  if (key !== undefined) instance.key = key;
  instance.Component = Component;
  instance.isAsync = isAsync(Component);

  // Mark as needing an update
  instance.needsUpdate = true;

  // console.log(
  //   "created",
  //   Component.name,
  //   "for",
  //   Components.get(parentId).name,
  //   "at",
  //   currentIndexes.get(parentId)
  // );

  return instance;
};

const getInstance = (Component, parent, key) => {
  // console.log("looking for", Component.name, "in", Components.get(parentId).name, "with key:", key);
  if (parent.children) {
    // Find the current child
    const currentIndex = parent.currentIndex;
    const currentChild = parent.children[currentIndex];

    if (currentChild && currentChild.Component === Component && currentChild.key === key) {
      // The child looks like what we're looking for
      // console.log("found here", Component.name, "for", Components.get(parentId).name);
      return currentChild;
    } else {
      // Try to find the a matching child further on
      for (let index = currentIndex + 1; index < parent.children.length; index++) {
        const child = parent.children[index];
        if (child.Component === Component && child.key === key) {
          // This one looks correct, so move it into its new place
          parent.children.splice(index, 1);
          parent.children.splice(currentIndex, 0, child);
          // console.log("found later", Component.name, "for", Components.get(parentId).name);
          return child;
        }
      }
    }

    // console.log("did not find matching children", Component.name);
  } else {
    // console.log("there were no children for", Components.get(parentId).name);
  }
};

const start = function (instance, newArguments) {
  return checkForUpdate(instance, newArguments, false);
};

const startAsync = async function (instance, newArguments) {
  // If instance is already running, delay this run until it finishes
  if (instance.pendingPromise) {
    // console.log("??? waiting for", Components.get(id).name, "to finish before applying");
    await instance.pendingPromise;
    // console.log("??? continuing with", Components.get(id).name);
  }

  return checkForUpdate(instance, newArguments, true);
};

const checkForUpdate = (instance, newArguments, async = false) => {
  // See if the instance should re-run
  let needsUpdate = instance.needsUpdate;

  if (!needsUpdate) {
    if (instance.lastArguments?.length !== newArguments?.length) {
      // console.log("argument length changed", instance.lastArguments, newArguments);
      needsUpdate = true;
    } else {
      for (let index = 0; index < newArguments.length; index++) {
        const previousArgument = instance.lastArguments[index];
        const newArgument = newArguments[index];

        if (!Object.is(newArgument, previousArgument)) {
          // console.log("argument has changed", previousArgument, newArgument);
          needsUpdate = true;
          break;
        }
      }

      if (!needsUpdate) {
        const newProps = newArguments[0];
        const lastProps = instance.lastArguments[0];
        for (const key in newProps) {
          if (!Object.is(newProps[key], lastProps[key])) {
            // console.log("prop has changed", key, instance.lastProps[key], newProps[key]);
            needsUpdate = true;
            break;
          }
        }
      }
    }
  }

  // Save this run's arguments and props for next time
  instance.lastArguments = newArguments;

  if (needsUpdate) {
    // Run the instance
    // console.log("+++ start of", Component.name, newProps);
    // Run the cleanup, if there is one
    return runCleanup(instance, newArguments, async);
  } else {
    // Skip running and return the previous value
    // console.log("!!! skipping update for", Component.name);
    return instance.lastValue;
  }
};

const runCleanup = (instance, newArguments, async = false) => {
  if (instance.savedCleanup) {
    instance.savedCleanup.call(instance, instance.load());
    instance.savedCleanup = null;
  }

  return (async ? runAsync : run)(instance, newArguments);
};

const run = (instance, newArguments) => {
  // Run the instance's Component
  instance.currentIndex = 0;
  let result;

  try {
    result = instance.Component.apply(instance, newArguments);

    // Save the new value
    instance.lastValue = result;
    instance.needsUpdate = false;
    updateQueue.delete(instance.id); // any update can be cancelled safely, since this is not async
  } catch (error) {
    // console.log("caught");
    reportError(error);
  } finally {
    finish(instance);
  }

  // console.log("--- returning", result, "from", Component.name, instance);
  return result;
};

const runAsync = async (instance, newArguments) => {
  // Run the instance's Component
  instance.currentIndex = 0;
  let result;

  try {
    result = instance.Component.apply(instance, newArguments);

    instance.pendingPromise = result;
    const finalResult = await result;

    // Save the new value
    instance.lastValue = finalResult;
    instance.needsUpdate = false;
  } catch (error) {
    reportError(error);
  } finally {
    finish(instance);
    instance.pendingPromise = null;
  }

  // console.log("--- returning", result, "from", Component.name, id);
  return result;
};

const finish = (instance) => {
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
  if (instance.savedCleanup) {
    instance.savedCleanup.call(instance, instance.load());
    instance.savedCleanup = null;
  }

  // Destroy children
  if (instance.children) {
    for (const child of instance.children) {
      destroy(child);
    }
  }

  // Clean up instance
  instance.currentIndex = 0;

  instance.isAsync = false;
  instance.needsUpdate = false;

  instance.parent = null;
  instance.pendingPromise = null;
  instance.lastValue = undefined;
  instance.lastArguments = null;
  instance.savedData = null;
  instance.savedCleanup = null;

  instance.key = null;
  if (instance.children) instance.children.splice(0, Infinity);
  instance.Component = null;

  // Add to pool for reuse
  instancePool.push(instance);
};

export const update = (instance, immediately = false) => {
  if (immediately) {
    return startUpdate(instance);
  }

  updateQueue.add(instance);
  if (!updateQueueWillRun) {
    requestIdleCallback(runUpdateQueue);
    updateQueueWillRun = true;
  }
};

export const updateParent = (instance, immediately = false) => {
  if (instance.parent !== null && instance.parent.id !== null) update(instance.parent, immediately);
};

let updateQueueWillRun = false;
const updateQueue = new Set();

const runUpdateQueue = async function (deadline) {
  for (const instance of updateQueue) {
    if (deadline.timeRemaining() === 0) {
      console.log("new deadline");
      return requestIdleCallback(runUpdateQueue);
    }

    updateQueue.delete(instance);
    startUpdate(instance);
  }

  updateQueueWillRun = false;
};

const startUpdate = (instance) => {
  (instance.isAsync ? runUpdateAsync : runUpdate)(instance);
};

const ongoingUpdates = new Map();

const runUpdate = function (instance) {
  if (instance.Component === null) {
    // console.log("=== cancelling update because instance is gone");
    return;
  }

  try {
    instance.needsUpdate = true;
    const lastValue = instance.lastValue;
    const newValue = start(instance, instance.lastArguments);

    if (newValue !== lastValue) {
      // console.log("escalating update to parent from", Component.name);
      updateParent(instance);
    }
  } catch (error) {
    reportError(error);
  }
};

const runUpdateAsync = async function (instance) {
  if (ongoingUpdates.has(instance)) {
    // console.log("waiting for previous update to finish in", Component.name);
    await ongoingUpdates.get(instance);
  }

  if (instance.Component === null) {
    // console.log("=== cancelling update because instance is gone");
    return;
  }

  try {
    instance.needsUpdate = true;
    const lastValue = instance.lastValue;
    let newValue = startAsync(instance, instance.lastArguments);

    ongoingUpdates.set(instance, newValue);
    newValue = await newValue;

    if (newValue !== lastValue) {
      // console.log("escalating update to parent from", Component.name);
      updateParent(instance);
    }
  } catch (error) {
    reportError(error);
  } finally {
    ongoingUpdates.delete(instance);
  }
};