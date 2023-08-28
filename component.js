import { DomElement } from "./dom.js";

const reportError = globalThis.reportError || console.error;

const Components = new Map([[null, function Root() {}]]);
const instanceIds = new Map();
const idInstances = new Map();
let idCounter = Number.MIN_SAFE_INTEGER;

const parents = new Map();
const childrens = new Map();
const currentIndexes = new Map([[null, 0]]);
const keys = new Map();

const argumentCache = new Map();
const valueCache = new Map();
const pendings = new Map();

const cleanups = new Map();
const needsUpdates = new Set();
const saves = new Map();

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

export const save = function (id, data) {
  saves.set(id, data);
  return data;
};

export const load = function (id) {
  return saves.get(id);
};

class Instance {
  run(inputComponent, ...inputArguments) {
    // Fragments
    if (inputComponent === "rahti:fragment") {
      return inputArguments;
    }

    inputArguments[0] = inputArguments[0] || dummyProps;
    const inputProps = inputArguments[0];

    // Cleanups
    if (inputComponent === CleanUp) {
      const cleaner = inputProps.cleaner || inputArguments[1];
      if (!cleaner) throw new Error("Callback missing from CleanUp");
      return CleanUp(this.id, cleaner);
    }

    // DOM components
    const seemsLikeDom = typeof inputComponent === "string";
    const Component = seemsLikeDom ? DomElement : inputComponent;
    if (seemsLikeDom) inputArguments.splice(1, 0, inputComponent);

    // Normal & DOM components
    const parentId = this.id;
    const key = inputProps?.key;
    const instance =
      getInstance(Component, parentId, key) || createInstance(Component, parentId, key);
    const id = instanceIds.get(instance);

    if (parentId !== null) currentIndexes.set(parentId, currentIndexes.get(parentId) + 1);

    return (isAsync(Component) ? startAsync : start)(id, instance, inputArguments, Component);
  }
}

export const rahti = new Instance();
rahti.id = null;

let instancePoolSize = 128;
export const setInstancePoolSize = (size) => (instancePoolSize = size);
const instancePool = [];

const createInstance = (Component, parentId, key) => {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  const id = idCounter;

  // Get or create parent's children
  let children = childrens.get(parentId);
  if (!children) {
    // console.log("starting children for", Components.get(parentId).name);
    children = [];
    childrens.set(parentId, children);
  }

  // Get parent's current index and save as a child using it
  const index = currentIndexes.get(parentId);
  children.splice(index, 0, id);

  // Save the parent, the key, and the Component
  parents.set(id, parentId);
  if (key !== undefined) keys.set(id, key);
  Components.set(id, Component);

  // Mark as needing an update
  needsUpdates.add(id);

  const instance = instancePool.length > 0 ? instancePool.pop() : new Instance();
  instance.id = id;

  instanceIds.set(instance, id);
  idInstances.set(id, instance);

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

const getInstance = (Component, parentId, key) => {
  // console.log("looking for", Component.name, "in", Components.get(parentId).name, "with key:", key);
  const children = childrens.get(parentId);

  if (children) {
    // Find the current child
    const currentIndex = currentIndexes.get(parentId);
    const currentChild = children[currentIndex];

    if (
      currentChild &&
      Components.get(currentChild) === Component &&
      keys.get(currentChild) === key
    ) {
      // The child looks like what we're looking for
      // console.log("found here", Component.name, "for", Components.get(parentId).name);
      return idInstances.get(currentChild);
    } else {
      // Try to find the a matching child further on
      for (let index = currentIndex + 1, { length } = children; index < length; index++) {
        const child = children[index];
        if (Components.get(child) === Component && keys.get(child) === key) {
          // This one looks correct, so move it into its new place
          children.splice(index, 1);
          children.splice(currentIndex, 0, child);
          // console.log("found later", Component.name, "for", Components.get(parentId).name);
          return idInstances.get(child);
        }
      }
    }

    // console.log("did not find matching children", Component.name);
  } else {
    // console.log("there were no children for", Components.get(parentId).name);
  }
};

const start = function (id, instance, newArguments, Component, forceUpdate = false) {
  return checkForUpdate(id, instance, newArguments, Component, false, forceUpdate);
};

const startAsync = async function (id, instance, newArguments, Component, forceUpdate = false) {
  // If instance is already running, delay this run until it finishes
  const pendingPromise = pendings.get(id);
  if (pendingPromise) {
    // console.log("??? waiting for", Components.get(id).name, "to finish before applying");
    await pendingPromise;
    // console.log("??? continuing with", Components.get(id).name);
  }

  return checkForUpdate(id, instance, newArguments, Component, true, forceUpdate);
};

const checkForUpdate = (
  id,
  instance,
  newArguments = argumentCache.get(id) || null,
  Component,
  async = false,
  forceUpdate = false,
) => {
  // See if the instance should re-run
  let needsUpdate = forceUpdate || needsUpdates.has(id);

  // console.log({ needsUpdate, forceUpdate });

  if (!needsUpdate) {
    const previousArguments = argumentCache.get(id);

    if (previousArguments?.length !== newArguments?.length) {
      // console.log("argument length changed", previousArguments, newArguments);
      needsUpdate = true;
    } else {
      const newProps = newArguments[0];
      const previousProps = previousArguments[0];

      for (const key in newProps) {
        if (newProps[key] !== previousProps[key]) {
          // console.log("prop has changed", key, previousProps[key], newProps[key]);
          needsUpdate = true;
          break;
        }
      }

      if (!needsUpdate && newArguments && previousArguments) {
        for (let index = 1; index < newArguments.length; index++) {
          const previousArgument = previousArguments[index];
          const newArgument = newArguments[index];

          if (newArgument !== previousArgument) {
            // console.log("argument has changed", previousArgument, newArgument);
            needsUpdate = true;
            break;
          }
        }
      }
    }
  }

  // Save this run's arguments and props for next time
  argumentCache.set(id, newArguments);

  if (needsUpdate) {
    // Run the instance
    // console.log("+++ start of", Component.name, newProps);
    // Run the cleanup, if there is one
    return runCleanup(id, instance, newArguments, Component, async);
  } else {
    // Skip running and return the previous value
    // console.log("!!! skipping update for", Component.name);
    return valueCache.get(id);
  }
};

const runCleanup = (id, instance, newArguments, Component, async = false) => {
  const cleanup = cleanups.get(id);

  if (cleanup) {
    // console.log("running cleanup for", Components.get(id).name);
    if (cleanup instanceof Set) {
      // Many cleanups
      for (const cleaner of cleanup) {
        try {
          cleaner.call(instance, false);
        } catch (error) {
          // console.log("caught");
          reportError(error);
        }
      }

      cleanup.clear();
    } else {
      // 1 cleanup
      cleanup.call(instance, false);
      cleanups.delete(id);
    }
  }

  return (async ? runAsync : run)(id, instance, newArguments, Component);
};

const run = (id, instance, newArguments, Component) => {
  // Run the instance's Component
  currentIndexes.set(id, 0);
  let result;

  try {
    result = Component.apply(instance, newArguments);

    // Save the new value
    valueCache.set(id, result);
    needsUpdates.delete(id);
  } catch (error) {
    // console.log("caught");
    reportError(error);
  } finally {
    finish(id);
  }

  // console.log("--- returning", result, "from", Component.name, instance);
  return result;
};

const runAsync = async (id, instance, newArguments, Component) => {
  // Run the instance's Component
  currentIndexes.set(id, 0);
  let result;

  try {
    result = Component.apply(instance, newArguments);

    pendings.set(id, result);
    const finalResult = await result;

    // Save the new value
    valueCache.set(id, finalResult);
    needsUpdates.delete(id);
  } catch (error) {
    reportError(error);
  } finally {
    finish(id);
    pendings.delete(id);
  }

  // console.log("--- returning", result, "from", Component.name, id);
  return result;
};

const finish = (id) => {
  // Destroy children that were not visited on this execution
  const children = childrens.get(id);
  if (children) {
    const nextIndex = currentIndexes.get(id);
    const { length } = children;

    if (nextIndex < length) {
      // console.log("/// destroying leftover children in", Component.name, length - nextIndex);
      for (let index = nextIndex; index < length; index++) {
        destroy(children[index]);
      }
      children.splice(nextIndex);
    }
  }
};

const destroy = async (id) => {
  // console.log("destroying", Components.get(id).name);
  const instance = idInstances.get(id);

  // If there's an ongoing run, wait for it
  const pendingPromise = pendings.get(id);
  if (pendingPromise) {
    // console.log("??? waiting for", Components.get(id).name, "to finish before destroying");
    await pendingPromise;
    // console.log("??? continuing with destroying", Components.get(id).name);
  }

  // Run the cleanup, if there is any
  const cleanup = cleanups.get(id);

  if (cleanup) {
    // console.log("\\\\ running cleanup for", Components.get(id).name);
    if (cleanup instanceof Set) {
      // Many cleanups
      for (const cleaner of cleanup) {
        try {
          cleaner.call(id, true);
        } catch (error) {
          reportError(error);
        }
      }

      cleanup.clear();
    } else {
      // 1 cleanup
      cleanup.call(instance, true);
      cleanups.delete(id);
    }
  }

  const children = childrens.get(id);

  // Destroy children
  if (children) {
    for (const child of children) {
      destroy(child);
    }
  }

  instanceIds.delete(instance);
  idInstances.delete(id);

  parents.delete(id);
  childrens.delete(id);
  currentIndexes.delete(id);
  keys.delete(id);

  argumentCache.delete(id);
  valueCache.delete(id);
  pendings.delete(id);

  cleanups.delete(id);
  needsUpdates.delete(id);
  saves.delete(id);

  instance.id = null;
  if (instancePool.length <= instancePoolSize) instancePool.push(instance);
};

export const CleanUp = function (id, cleaner) {
  const cleanup = cleanups.get(id);
  if (cleanup instanceof Set) {
    // 3rd+ cleanup
    cleanup.add(cleaner);
  } else if (cleanup) {
    // 2nd cleanup
    const cleaners = new Set();
    cleaners.add(cleanup);
    cleaners.add(cleaner);
    cleanups.set(id, cleaners);
  } else {
    // 1st cleanup
    cleanups.set(id, cleaner);
  }
};
export const Cleanup = CleanUp;

export const updateParent = (id) => {
  const parentId = parents.get(id);
  if (parentId !== undefined) update(parentId);
};

export const update = (id) => {
  const instance = idInstances.get(id);
  if (instance === undefined) {
    // console.log("=== cancelling update because instance is gone");
    return;
  }

  const Component = Components.get(id);
  // console.log("=== updating", Component.name);

  if (isAsync(Component)) {
    runUpdateAsync(id, instance, Component);
  } else {
    runUpdate(id, instance, Component);
  }
};

const ongoingUpdates = new Map();

const runUpdate = function (id, instance, Component) {
  try {
    needsUpdates.add(id);
    const previousValue = valueCache.get(id);

    const newValue = start(id, instance, undefined, Component, true);

    if (newValue !== previousValue) {
      // console.log("escalating update to parent from", Component.name);
      updateParent(id);
    }
  } catch (error) {
    reportError(error);
  }
};

const runUpdateAsync = async function (id, instance, Component) {
  if (ongoingUpdates.has(id)) {
    // console.log("waiting for previous update to finish in", Component.name);
    await ongoingUpdates.get(id);
    return update(id);
  }

  try {
    needsUpdates.add(id);
    const previousValue = valueCache.get(id);

    let newValue = startAsync(id, instance, undefined, Component, true);
    ongoingUpdates.set(id, newValue);
    newValue = await newValue;

    if (newValue !== previousValue) {
      // console.log("escalating update to parent from", Component.name);
      updateParent(id);
    }
  } catch (error) {
    reportError(error);
  } finally {
    ongoingUpdates.delete(id);
  }
};
