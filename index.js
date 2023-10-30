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

const isAsync = (code) => {
  return code.constructor.name === "AsyncFunction";
};

export const save = function (id, data) {
  saves.set(id, data);
  return data;
};

export const load = function (id) {
  return saves.get(id);
};

const createStackState = function () {
  return {
    stack: [],
    index: 0,
  };
};
let stackState = createStackState();

export const Component = {
  apply: function (code, thisArgument, argumentsList) {
    const isMemoized = code.memoized === true;
    const isKeyed = code.keyed === true;

    const parentId = stackState.stack.at(-1);

    const key = isKeyed ? argumentsList[0] : undefined;
    const instance = getInstance(code, parentId, key) || createInstance(code, parentId, key);
    const id = instanceIds.get(instance);

    stackState.index++;

    return [isAsync(code) ? startAsync : start](code, id);
  },
};

const getInstance = (code, parentId, key) => {
  console.log("looking for", code.name, "in", codes.get(parentId)?.name, "with key:", key);
  const children = childrens.get(parentId);

  if (children) {
    // Find the current child
    const currentIndex = currentIndexes.get(parentId);
    const currentChild = children[currentIndex];

    if (currentChild && codes.get(currentChild) === code && keys.get(currentChild) === key) {
      // The child looks like what we're looking for
      console.log("found here", code.name, "for", codes.get(parentId)?.name);
      return idInstances.get(currentChild);
    } else {
      // Try to find the a matching child further on
      for (let index = currentIndex + 1, { length } = children; index < length; index++) {
        const child = children[index];
        if (codes.get(child) === code && keys.get(child) === key) {
          // This one looks correct, so move it into its new place
          children.splice(index, 1);
          children.splice(currentIndex, 0, child);
          console.log("found later", code.name, "for", codes.get(parentId)?.name);
          return idInstances.get(child);
        }
      }
    }

    console.log("did not find matching children", code.name);
  } else {
    console.log("there were no children for", codes.get(parentId)?.name);
  }
};

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

const startAsync = async function () {
  // If instance is already running, delay this run until it finishes
  const pendingPromise = pendings.get(id);
  if (pendingPromise) {
    console.log("??? waiting for", Components.get(id).name, "to finish before applying");
    // TODO: suspend
    await pendingPromise;
    // TODO: unsuspend
    console.log("??? continuing with", Components.get(id).name);
  }

  if (memoized) {
    const needsUpdate = checkForUpdate();
    if (!needsUpdate) {
      // console.log("+++ no update needed, returning previous value", Component.name, newProps);
      return valueCache.get(id);
    }
  }

  runCleanup();

  // Run the instance's Component
  currentIndexes.set(id, 0);
  let awaitedResult;

  try {
    awaitedResult = code.apply(thisArgument, argumentsList);

    pendings.set(id, result);
    awaitedResult = await result;

    // Save the new value
    valueCache.set(id, awaitedResult);
    needsUpdates.delete(id);
  } catch (error) {
    reportError(error);
  } finally {
    pendings.delete(id);
    return finish(awaitedResult);
  }
};

const start = function () {
  if (memoized) {
    const needsUpdate = checkForUpdate();
    if (!needsUpdate) {
      // console.log("+++ no update needed, returning previous value", Component.name, newProps);
      return valueCache.get(id);
    }
  }

  runCleanup();

  // Run the instance's Component
  currentIndexes.set(id, 0);
  let result;

  try {
    result = code.apply(thisArgument, argumentsList);

    // Save the new value
    valueCache.set(id, result);
    needsUpdates.delete(id);
  } catch (error) {
    reportError(error);
  } finally {
    return finish(awaitedResult);
  }
};

const checkForUpdate = function () {
  // See if the instance should re-run
  let needsUpdate = forceUpdate || needsUpdates.has(id);

  if (!needsUpdate) {
    const previousArguments = argumentCache.get(id);

    if (previousArguments?.length !== newArguments?.length) {
      console.log("argument length changed", previousArguments, newArguments);
      needsUpdate = true;
    } else if (!needsUpdate && newArguments && previousArguments) {
      for (let index = 1; index < newArguments.length; index++) {
        const previousArgument = previousArguments[index];
        const newArgument = newArguments[index];

        if (Object.is(newArgument, previousArgument)) {
          console.log("argument has changed", previousArgument, newArgument);
          needsUpdate = true;
          break;
        }
      }
    }
  }

  // Save this run's arguments and props for next time
  argumentCache.set(id, newArguments);

  return needsUpdate;
};

const runCleanup = function () {
  console.log("+++ start of", Component.name, newProps);

  // Run the cleanup, if there is one
  const cleanup = cleanups.get(id);

  if (cleanup) {
    console.log("/// cleaning up", Component.name, newProps);
    cleanup(saves.get(id));
    cleanups.delete(id);
  }
};

const finish = function (result) {
  // Destroy children that were not visited on this execution
  const children = childrens.get(id);
  if (children) {
    const nextIndex = currentIndexes.get(id);
    const { length } = children;

    if (nextIndex < length) {
      console.log("/// destroying leftover children in", Component.name, length - nextIndex);
      for (let index = nextIndex; index < length; index++) {
        destroy(children[index]);
      }
      children.splice(nextIndex);
    }
  }

  console.log("--- returning", result, "from", Component.name, instance);
  return result;
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

export const cleanup = function (cleaner) {
  cleanups.set(id, cleaner);
};

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

export const use = function () {};
