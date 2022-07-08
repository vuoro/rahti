const reportError = globalThis.reportError || console.error;

const codes = new Map([[globalThis, function root() {}]]);
const asyncs = new Set();

const instances = new Set([globalThis]);
const parents = new Map();
const childrens = new Map();
const currentIndexes = new Map([[globalThis, 0]]);
const keys = new Map();

const argumentCache = new Map();
const valueCache = new Map();
const pendings = new Map();

const cleanups = new Map();
const needsUpdates = new Set();
const updateQueue = new Set();

export const component = (code, cleanup) => {
  const async = code.constructor.name === "AsyncFunction";
  let nextInstance = null;

  const starter = function (parentThis, key) {
    nextInstance = getInstance(code, parentThis, key) || createInstance(code, parentThis, key);

    if (parentThis !== globalThis)
      currentIndexes.set(parentThis, currentIndexes.get(parentThis) + 1);

    return applier;
  };

  const applier = function () {
    const instance = nextInstance;
    nextInstance = null;
    return (async ? startAsync : start)(instance, arguments, code);
  };

  if (async) asyncs.add(code);
  // // async ? console.log("initialized async", code.name) : console.log("initialized", code.name);

  starter._isRahtiComponent = true;
  Object.defineProperty(starter, "name", { value: `${code.name}__starter`, configurable: true });

  if (cleanup) cleanups.set(code, cleanup);

  return starter;
};

const start = function (instance, newArguments, code, forceUpdate = false) {
  return checkForUpdate(instance, newArguments, code, false, forceUpdate);
};

const startAsync = async function (instance, newArguments, code, forceUpdate = false) {
  // If instance is already running, delay this run until it finishes
  const pendingPromise = pendings.get(instance);
  if (pendingPromise) {
    // console.log("??? waiting for", codes.get(instance).name, "to finish before applying");
    await pendingPromise;
    // console.log("??? continuing with", codes.get(instance).name);
  }

  return checkForUpdate(instance, newArguments, code, true, forceUpdate);
};

const checkForUpdate = (
  instance,
  newArguments = argumentCache.get(instance),
  code,
  async = false,
  forceUpdate = false
) => {
  // See if the instance should re-run
  const previousArguments = argumentCache.get(instance);
  let needsUpdate = forceUpdate || needsUpdates.has(instance);

  if (!needsUpdate) {
    if (previousArguments === newArguments) {
      needsUpdate = false;
    } else if (previousArguments.length !== newArguments.length) {
      needsUpdate = true;
    } else {
      for (let index = 0; index < newArguments.length; index++) {
        const previousArgument = previousArguments[index];
        const newArgument = newArguments[index];
        if (newArgument !== previousArgument) {
          needsUpdate = true;
          break;
        }
      }
    }
  }

  // Save this run's arguments for next time
  argumentCache.set(instance, newArguments);

  if (needsUpdate) {
    // Run the instance
    // console.log("+++ start of", code.name);
    // Run the cleanup, if there is one
    if (previousArguments) (async ? runAsyncCleanup : runCleanup)(instance, code);
    return (async ? runAsync : run)(instance, newArguments, code);
  } else {
    // Skip running and return the previous value
    // console.log("!!! skipping update for", code.name);
    return valueCache.get(instance);
  }
};

const runCleanup = (instance, code) => {
  const cleanup = cleanups.get(code);

  if (cleanup) {
    try {
      cleanup.call(instance, false);
    } catch (error) {
      reportError(error);
    }
  }
};

const runAsyncCleanup = async (instance, code) => {
  const cleanup = cleanups.get(code);

  if (cleanup) {
    try {
      await cleanup.call(instance, false);
    } catch (error) {
      reportError(error);
    }
  }
};

const run = (instance, newArguments, code) => {
  // Run the instance's code
  currentIndexes.set(instance, 0);
  let result;

  try {
    result = code.apply(instance, newArguments);

    // Save the new value
    valueCache.set(instance, result);
    needsUpdates.delete(instance);
  } catch (error) {
    reportError(error);
  } finally {
    finish(instance, code);
  }

  // console.log("returning", result, "from", code.name, instance);
  return result;
};

const runAsync = async (instance, newArguments, code) => {
  // Run the instance's code
  currentIndexes.set(instance, 0);
  let result;

  try {
    result = code.apply(instance, newArguments);

    pendings.set(instance, result);
    const finalResult = await result;

    // Save the new value
    valueCache.set(instance, finalResult);
    needsUpdates.delete(instance);
  } catch (error) {
    reportError(error);
  } finally {
    finish(instance, code);
    pendings.delete(instance);
  }

  // console.log("returning", result, "from", code.name, instance);
  return result;
};

const finish = (instance, code) => {
  // Destroy children that were not visited on this execution
  const children = childrens.get(instance);
  if (children) {
    const nextIndex = currentIndexes.get(instance);
    const { length } = children;

    if (nextIndex < length) {
      // console.log("destroying leftover children in ", code.name);
      for (let index = nextIndex; index < length; index++) {
        destroy(children[index]);
      }
      children.splice(nextIndex);
    }
  }
};

let idCounter = 0;

const createInstance = (code, parentThis, key) => {
  const instance = idCounter++;
  instances.add(instance);

  // Get or create parent's children
  let children = childrens.get(parentThis);
  if (!children) {
    // console.log("starting children for", codes.get(parentThis).name);
    children = [];
    childrens.set(parentThis, children);
  }

  // Get parent's current index and save as a child using it
  const index = currentIndexes.get(parentThis);
  children.splice(index, 0, instance);

  // Save the parent, the key, and the code
  parents.set(instance, parentThis);
  if (key !== undefined) keys.set(instance, key);
  codes.set(instance, code);

  // Mark as needing an update
  // console.log(
  //   "created",
  //   code.name,
  //   "in",
  //   codes.get(parentThis).name,
  //   "at",
  //   currentIndexes.get(parentThis)
  // );
  needsUpdates.add(instance);

  return instance;
};

const getInstance = (code, parentThis, key) => {
  // console.log("looking for", code.name, "in", codes.get(parentThis).name, "with key:", key);
  const children = childrens.get(parentThis);

  if (children) {
    // Find the current child
    const currentIndex = currentIndexes.get(parentThis);
    const currentChild = children[currentIndex];

    if (currentChild && codes.get(currentChild) === code && keys.get(currentChild) === key) {
      // The child looks like what we're looking for
      // console.log("found here", codes.get(currentChild).name);
      return currentChild;
    } else {
      // Try to find the a matching child further on
      for (let index = currentIndex + 1, { length } = children; index < length; index++) {
        const child = children[index];
        if (codes.get(child) === code && keys.get(child) === key) {
          // This one looks correct, so move it into its new place
          children.splice(index, 1);
          children.splice(currentIndex, 0, child);
          // console.log("found later", codes.get(child).name);
          return child;
        }
      }
    }

    // console.log("did not find matching children");
  } else {
    // console.log("there were no children");
  }
};

const destroy = async (instance) => {
  // console.log("destroying", codes.get(instance).name);

  // If there's an ongoing run, wait for it
  const pendingPromise = pendings.get(instance);
  if (pendingPromise) {
    // console.log("??? waiting for", codes.get(instance).name, "to finish before destroying");
    await pendingPromise;
    // console.log("??? continuing with destroying", codes.get(instance).name);
  }

  // Run the cleanup, if there is any
  const cleanup = cleanups.get(codes.get(instance));

  if (cleanup) {
    // console.log("running cleanup for", codes.get(instance).name);
    try {
      cleanup.call(instance, true);
    } catch (error) {
      reportError(error);
    }
  }

  const children = childrens.get(instance);

  // Destroy children
  if (children) {
    for (const child of children) {
      destroy(child);
    }
  }

  instances.delete(instance);
  parents.delete(instance);
  childrens.delete(instance);
  currentIndexes.delete(instance);
  keys.delete(instance);

  argumentCache.delete(instance);
  valueCache.delete(instance);
  pendings.delete(instance);

  needsUpdates.delete(instance);
  updateQueue.delete(instance);
};

let queueWillRun = false;

export const update = (instance, forceParentUpdate = false) => {
  // console.log("=== updating", codes.get(instance).name);

  needsUpdates.add(instance);
  updateQueue.add(instance);

  if (forceParentUpdate) {
    const parent = parents.get(instance);
    if (parent !== undefined && parent !== globalThis) {
      needsUpdates.add(parent);
      updateQueue.add(parent);
    }
  }

  if (!queueWillRun) {
    queueWillRun = true;
    queueMicrotask(runUpdateQueue);
  }
};

const updateQueuePromises = new Map();
const updateQueuePreviousValues = new Map();

const runUpdateQueue = async () => {
  for (const instance of updateQueue) {
    updateQueue.delete(instance);

    const code = codes.get(instance);
    const isAsync = asyncs.has(code);
    // console.log("=== applying update to", code.name);

    const previousValue = valueCache.get(instance);
    let newValue;

    try {
      newValue = (isAsync ? startAsync : start)(instance, undefined, code, true);
    } catch (error) {
      reportError(newValue);
      continue;
    }

    if (isAsync) {
      updateQueuePromises.set(instance, newValue);
      updateQueuePreviousValues.set(instance, previousValue);
    } else {
      if (newValue !== previousValue) {
        const parent = parents.get(instance);
        if (parent !== undefined && parent !== globalThis) update(parent);
      }
    }
  }

  for (const [instance, newValue] of updateQueuePromises) {
    updateQueuePromises.delete(instance);
    updateQueuePreviousValues.delete(instance);

    const previousValue = updateQueuePreviousValues.get(instance);
    let newResolvedValue;

    try {
      newResolvedValue = await newValue;
    } catch (error) {
      reportError(error);
      continue;
    }

    if (newResolvedValue !== previousValue) {
      const parent = parents.get(instance);
      if (parent !== undefined && parent !== globalThis) update(parent);
    }
  }

  if (updateQueue.size) {
    runUpdateQueue();
  } else {
    queueWillRun = false;
  }
};
