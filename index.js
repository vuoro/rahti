import { requestIdleCallbackPonyfilled } from "./requestIdleCallback";

let idCounter = Number.MIN_SAFE_INTEGER;

const codes = new Map();
const parents = new Map();
const childrens = new Map();
const keys = new Map();

const argumentCache = new Map();
const valueCache = new Map();

const cleanups = new Map();
const needsUpdates = new Set();
const saves = new Map();

let stack = [undefined];
let stackIndexes = [0];

export class Key {
  key = undefined;
  constructor(key) {
    this.key = key;
  }
}

export const Component = {
  apply: function (code, thisArgument, argumentsList) {
    // Find or create instance
    const parentId = stack.at(-1);
    const parentChildIndex = stackIndexes.at(-1);
    const lastArgument = argumentsList.at(-1);
    const key = lastArgument instanceof Key ? lastArgument.key : undefined;
    const id =
      getInstance(code, parentId, parentChildIndex, key) || createInstance(code, parentId, parentChildIndex, key);

    // Increment parent's child index
    if (parentId !== undefined) stackIndexes[stackIndexes.length - 1]++;

    return start(code, id, thisArgument, argumentsList);
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

const start = function (code, id, thisArgument, argumentsList) {
  const needsUpdate = checkForUpdate(id, argumentsList);
  if (!needsUpdate) {
    // console.log("+++ no update needed, returning previous value", valueCache.get(id));
    return valueCache.get(id);
  }

  runCleanup(id);

  // Run the instance's Component
  // console.log("+++ start of ", code.name);
  stack.push(id);
  stackIndexes.push(0);
  let result;

  try {
    result = code.apply(thisArgument, argumentsList);

    // Save the new value
    needsUpdates.delete(id);
    valueCache.set(id, result);
  } catch (error) {
    (globalThis.reportError || console.error)(error);
  } finally {
    return finish(code, id, result);
  }
};

const checkForUpdate = function (id, argumentsList) {
  // See if the instance should re-run
  let needsUpdate = needsUpdates.has(id);

  if (!needsUpdate) {
    const previousArguments = argumentCache.get(id);

    if (previousArguments?.length !== argumentsList.length) {
      // console.log("argument length changed", previousArguments, argumentsList);
      needsUpdate = true;
    } else if (previousArguments) {
      for (let index = 0; index < argumentsList.length; index++) {
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

  // console.log("--- returning from", code.name, result);
  return result;
};

const destroy = (id) => {
  // console.log("destroying", codes.get(id)?.name);

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

  cleanups.delete(id);
  needsUpdates.delete(id);
  saves.delete(id);
};

export const cleanup = function (cleaner) {
  cleanups.set(getId(), cleaner);
};

export const update = (id, immediately = false) => {
  if (immediately) {
    runUpdate(id);
  }

  updateQueue.add(id);
  if (!updateQueueWillRun) {
    requestIdleCallbackPonyfilled(runUpdateQueue);
  }

  // const code = codes.get(id);
  // if (!code) {
  //   // console.log("??? cancelling update because code is gone", id);
  //   return;
  // }
  // runUpdate(id, code);
};

export const updateParent = (id, immediately = false) => {
  const parentId = parents.get(id);
  if (parentId !== undefined) update(parentId, immediately);
};

const updateQueue = new Set();
let updateQueueWillRun = false;

const runUpdateQueue = async function (deadline) {
  for (const id of updateQueue) {
    if (deadline.timeRemaining() === 0) {
      console.log("new deadline");
      return requestIdleCallbackPonyfilled(runUpdateQueue);
    }

    updateQueue.delete(id);
    runUpdate(id);
  }

  updateQueueWillRun = false;
};

const runUpdate = function (id) {
  const code = codes.get(id);
  if (!code) {
    // console.log("??? cancelling update because code is gone", id);
    return;
  }

  // console.log("=== updating", code.name);
  needsUpdates.add(id);

  try {
    const oldValue = valueCache.get(id);
    const newValue = start(code, id, null, argumentCache.get(id));
    const shouldEscalate = newValue !== oldValue;

    if (shouldEscalate) {
      // console.log("escalating update to parent from", code.name);
      updateParent(id);
    }
  } catch (error) {
    (globalThis.reportError || console.error)(error);
  }
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

export const returnPromiseLater = function (promise) {
  const id = getId();
  const handler = (value) => {
    valueCache.set(id, value);
    updateParent(id);
  };
  promise.then(handler, handler);
  return valueCache.get(id);
};

export const getId = function () {
  return stack.at(-1);
};

export const getParentId = function () {
  return parents.get(getId());
};
