const reportError = globalThis.reportError || console.error;

let idCounter = Number.MIN_SAFE_INTEGER;

const codes = new Map();
const parents = new Map();
const childrens = new Map();
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

let stack = [undefined];
let stackIndexes = [0];

export const Component = {
  apply: function (code, thisArgument, argumentsList) {
    const memoized = code.memoized === true;
    const isKeyed = code.keyed === true;

    // Find or create instance
    const parentId = stack.at(-1);
    const parentChildIndex = stackIndexes.at(-1);
    const key = isKeyed ? argumentsList[code.rahtiKeyIndex || 0] : undefined;
    const id =
      getInstance(code, parentId, parentChildIndex, key) || createInstance(code, parentId, parentChildIndex, key);

    // Increment parent's child index
    if (parentId !== undefined) stackIndexes[stackIndexes.length - 1]++;

    return (isAsync(code) ? startAsync : start)(code, id, thisArgument, argumentsList, memoized);
  },
};

const getInstance = (code, parentId, parentChildIndex, key) => {
  // console.log("looking for", code.name, "in", codes.get(parentId)?.name, "with key:", key);
  const children = childrens.get(parentId);

  if (children) {
    // Find the current child
    const currentChild = children[parentChildIndex];

    if (currentChild && codes.get(currentChild) === code && keys.get(currentChild) === key) {
      // The child looks like what we're looking for
      // console.log("found here", code.name, "for", codes.get(parentId)?.name);
      return currentChild;
    } else {
      // Try to find the a matching child further on
      for (let index = parentChildIndex + 1, { length } = children; index < length; index++) {
        const child = children[index];
        if (codes.get(child) === code && keys.get(child) === key) {
          // This one looks correct, so move it into its new place
          children.splice(index, 1);
          children.splice(parentChildIndex, 0, child);
          // console.log("found later", code.name, "for", codes.get(parentId)?.name);
          return child;
        }
      }
    }

    // console.log("did not find matching children", code.name);
  } else {
    // console.log("there were no children for", codes.get(parentId)?.name);
  }
};

const createInstance = (code, parentId, parentChildIndex, key) => {
  idCounter = idCounter === Number.MAX_SAFE_INTEGER ? Number.MIN_SAFE_INTEGER : idCounter + 1;
  const id = idCounter;

  // Get or create parent's children
  let children = childrens.get(parentId);
  if (!children) {
    // console.log("starting children for", codes.get(parentId)?.name);
    children = [];
    childrens.set(parentId, children);
  }

  // Save this into parent's children
  children.splice(parentChildIndex, 0, id);

  // Save the parent, the key, and the code
  parents.set(id, parentId);
  if (key !== undefined) keys.set(id, key);
  codes.set(id, code);

  // Mark as needing an update
  needsUpdates.add(id);

  // console.log("created", code.name, "for", codes.get(parentId)?.name, "at", parentChildIndex);

  return id;
};

const start = function (code, id, thisArgument, argumentsList, memoized) {
  if (memoized) {
    const needsUpdate = checkForUpdate(id, argumentsList);
    if (!needsUpdate) {
      console.log("+++ no update needed, returning previous value", code.name);
      return valueCache.get(id);
    }
  }

  runCleanup(id);

  // Run the instance's Component
  console.log("+++ start of ", code.name);
  needsUpdates.delete(id);
  stack.push(id);
  stackIndexes.push(0);
  let result;

  try {
    result = code.apply(thisArgument, argumentsList);

    // Save the new value
    if (memoized) valueCache.set(id, result);
  } catch (error) {
    reportError(error);
  } finally {
    return finish(code, id, result);
  }
};

const startAsync = async function (code, id, thisArgument, argumentsList, memoized) {
  // If instance is already running, delay this run until it finishes
  if (pendings.has(id)) {
    console.log("??? waiting for", code.name, "to finish before applying");
    await pendings.get(id);
    console.log("??? continuing with", code.name);
  }

  if (memoized) {
    const needsUpdate = checkForUpdate(id, argumentsList);
    if (!needsUpdate) {
      console.log("+++ no update needed, returning previous value", code.name);
      return valueCache.get(id);
    }
  }

  runCleanup(id);

  // Run the instance's Component
  console.log("+++ start of ", code.name);
  needsUpdates.delete(id);
  stack.push(id);
  stackIndexes.push(0);
  let awaitedResult;

  try {
    awaitedResult = code.apply(thisArgument, argumentsList);
    pendings.set(id, awaitedResult);
    awaitedResult = await awaitedResult;

    // Save the new value
    if (memoized) valueCache.set(id, awaitedResult);
  } catch (error) {
    reportError(error);
  } finally {
    pendings.delete(id);
    return finish(code, id, awaitedResult);
  }
};

const checkForUpdate = function (id, argumentsList) {
  // See if the instance should re-run
  let needsUpdate = needsUpdates.has(id);

  if (!needsUpdate) {
    const previousArguments = argumentCache.get(id);

    if (previousArguments?.length !== argumentsList?.length) {
      // console.log("argument length changed", previousArguments, argumentsList);
      needsUpdate = true;
    } else if (!needsUpdate && argumentsList && previousArguments) {
      for (let index = 1; index < argumentsList.length; index++) {
        const previousArgument = previousArguments[index];
        const newArgument = argumentsList[index];

        if (!Object.is(newArgument, previousArgument)) {
          // console.log("argument has changed", previousArgument, newArgument);
          needsUpdate = true;
          break;
        }
      }
    }
  }

  // Save this run's arguments for next time
  argumentCache.set(id, argumentsList);

  return needsUpdate;
};

const runCleanup = function (id) {
  // Run the cleanup, if there is one
  const cleanup = cleanups.get(id);

  if (cleanup) {
    // console.log("/// cleaning up", id);
    cleanup(saves.get(id));
    cleanups.delete(id);
  }
};

const finish = function (code, id, result) {
  // Destroy children that were not visited on this execution
  const children = childrens.get(id);
  const nextIndex = stackIndexes.at(-1);
  stack.pop();
  stackIndexes.pop();

  if (children) {
    const { length } = children;

    if (nextIndex < length) {
      // console.log("/// destroying leftover children in", code.name, length - nextIndex);
      for (let index = nextIndex; index < length; index++) {
        destroy(children[index]);
      }
      children.splice(nextIndex);
    }
  }

  console.log("--- returning from", code.name, result);
  return result;
};

// TODO: split this into destroy and destroyAsync
const destroy = async (id) => {
  // console.log("destroying", codes.get(id)?.name);

  // If there's an ongoing run, wait for it
  const pendingPromise = pendings.get(id);
  if (pendingPromise) {
    console.log("??? waiting for", codes.get(id)?.name, "to finish before destroying");
    await pendingPromise;
    console.log("??? continuing with destroying", codes.get(id)?.name);
  }

  // Run the cleanup, if there is any
  runCleanup(id);

  const children = childrens.get(id);

  // Destroy children
  if (children) {
    for (const child of children) {
      destroy(child);
    }
  }

  parents.delete(id);
  childrens.delete(id);
  keys.delete(id);

  argumentCache.delete(id);
  valueCache.delete(id);
  pendings.delete(id);

  cleanups.delete(id);
  needsUpdates.delete(id);
  saves.delete(id);
};

export const cleanup = function (cleaner) {
  cleanups.set(getId(), cleaner);
};

export const update = (id) => {
  // updateQueue.add(id);
  // if (!updateQueueWillRun) {
  //   queueMicrotask(runUpdateQueue);
  //   updateQueueWillRun = true;
  // }

  const code = codes.get(id);
  if (!code) return console.log("??? cancelling update because code is gone", id);
  // console.log("=== updating", code.name);

  if (isAsync(code)) {
    runUpdateAsync(id);
  } else {
    runUpdate(id);
  }
};

export const updateParent = (id) => {
  const parentId = parents.get(id);
  if (parentId !== undefined) update(parentId);
};

const updateQueue = new Set();
const ongoingUpdates = new Map();
let updateQueueWillRun = false;

const runUpdateQueue = function () {
  for (const id of updateQueue) {
    updateQueue.delete(id);

    const code = codes.get(id);
    if (!code) return console.log("??? cancelling update because code is gone", id);

    if (isAsync(code)) {
      runUpdateAsync(id);
    } else {
      runUpdate(id);
    }
  }

  updateQueueWillRun = false;
};

const runUpdate = function (id) {
  const code = codes.get(id);
  if (!code) return console.log("??? cancelling update because code is gone", id);
  console.log("=== updating", code.name);

  try {
    needsUpdates.add(id);
    const newValue = start(code, id, null, argumentCache.get(id), code.memoized);
    const shouldEscalate = code.memoized ? newValue !== valueCache.get(id) : newValue !== undefined;

    if (shouldEscalate) {
      console.log("escalating update to parent from", code.name);
      updateParent(id);
    }
  } catch (error) {
    reportError(error);
  }
};

const runUpdateAsync = async function (id) {
  const code = codes.get(id);
  if (!code) return console.log("??? cancelling update because code is gone", id);
  console.log("=== updating", code.name);

  try {
    needsUpdates.add(id);
    let newValue = startAsync(code, id, null, argumentCache.get(id), code.memoized);
    ongoingUpdates.set(id, newValue);
    newValue = await newValue;
    const shouldEscalate = code.memoized ? newValue !== valueCache.get(id) : newValue !== undefined;

    if (shouldEscalate) {
      console.log("escalating update to parent from", code.name);
      updateParent(id);
    }
  } catch (error) {
    reportError(error);
  } finally {
    ongoingUpdates.delete(id);
  }
};

export const use = async function (promise) {
  // FIXME: if promise is a component, top of stack is not this component
  // otherwise, top of stack _is_ this component
  const suspendedId = stack.pop();
  const suspendedIndex = stackIndexes.pop();
  console.log("??? suspending", codes.get(suspendedId).name);
  const result = await promise;
  stack.push(suspendedId);
  stackIndexes.push(suspendedIndex);
  console.log("??? resuming", codes.get(suspendedId).name);
  return result;
};

export const save = function (data) {
  const id = getId();
  saves.set(id, data);
  return data;
};

export const load = function () {
  const id = getId();
  return saves.get(id);
};

export const getId = function () {
  return stack.at(-1);
};

export const getParentId = function () {
  return parents.get(getId());
};
