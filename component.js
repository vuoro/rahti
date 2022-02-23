const reportError = self.reportError || console.error;

const codes = new Map([[self, function root() {}]]);
const asyncs = new Set();

const components = new Set([self]);
const parents = new Map();
const childrens = new Map();
const currentIndexes = new Map();
const keys = new Map();

const argumentCache = new Map();
const valueCache = new Map();
const pendings = new Map();

const cleanups = new Map();
const needsUpdates = new Set();
const mightReturns = new Set();
const updateQueue = new Set();

export const asyncComponent = (code) => component(code, true);

export const component = (code, async = false) => {
  const apply = function (...newArguments) {
    let parent, key;
    const [first, second] = newArguments;

    if (components.has(first)) {
      parent = first;
      newArguments.shift();
    } else if (components.has(second)) {
      parent = second;
      key = first;
      newArguments.shift();
      newArguments.shift();
    } else {
      throw new Error("missing `this`");
    }

    const found = getComponent(code, parent, key);
    const component = found || createComponent(code, parent, key);
    currentIndexes.set(parent, currentIndexes.get(parent) + 1);

    return (async ? startAsync : start)(component, newArguments, code);
  };

  Object.defineProperty(apply, "name", { value: `apply_${code.name}`, configurable: true });

  // async ? console.log("created async", code.name) : console.log("created", code.name);
  if (async) asyncs.add(code);
  apply.isRahtiComponent = true;

  return apply;
};

const start = function (component, newArguments, code) {
  return checkForUpdate(component, newArguments, code);
};

const startAsync = async function (component, newArguments, code) {
  // If component is already running, delay this run until it finishes
  const pendingPromise = pendings.get(component);
  if (pendingPromise) {
    // console.log("??? waiting for", codes.get(component).name, "to finish before applying");
    await pendingPromise;
    // console.log("??? continuing with", codes.get(component).name);
  }

  return checkForUpdate(component, newArguments, code, true);
};

const checkForUpdate = (
  component,
  newArguments = argumentCache.get(component),
  code,
  async = false
) => {
  // See if the component should re-run
  let needsUpdate = needsUpdates.has(component);

  if (!needsUpdate) {
    const previousArguments = argumentCache.get(component);
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
  argumentCache.set(component, newArguments);

  if (needsUpdate) {
    // Run the component
    // console.log("+++ start of", code.name);
    // Run the cleanup, if there is one
    return runCleanup(component, newArguments, code, async);
  } else {
    // Skip running and return the previous value
    // console.log("!!! skipping update for", code.name);
    return valueCache.get(component);
  }
};

const runCleanup = (component, newArguments, code, async = false) => {
  const cleaners = cleanups.get(component);
  if (cleaners) {
    // console.log("running cleanup for", codes.get(component).name);
    for (const cleaner of cleaners) {
      try {
        cleaner(false);
      } catch (error) {
        reportError(error);
      }
    }

    cleaners.clear();
  }

  return (async ? runAsync : run)(component, newArguments, code);
};

const run = (component, newArguments, code) => {
  // Run the component's code
  currentIndexes.set(component, 0);
  let result;

  try {
    result = code.apply(component, newArguments);

    // If it returned something, note that it's code might do so
    checkReturn(code, result);

    // Save the new value
    valueCache.set(component, result);
    needsUpdates.delete(component);
  } catch (error) {
    reportError(error);
  } finally {
    finish(component, code);
  }

  // console.log("returning", result, "from", code.name, component);
  return result;
};

const runAsync = async (component, newArguments, code) => {
  // Run the component's code
  currentIndexes.set(component, 0);
  let result;

  try {
    result = code.apply(component, newArguments);

    pendings.set(component, result);
    const finalResult = await result;

    // If it returned something, note that it's code might do so
    checkReturn(code, finalResult);

    // Save the new value
    valueCache.set(component, finalResult);
    needsUpdates.delete(component);
  } catch (error) {
    reportError(error);
  } finally {
    finish(component, code);
    pendings.delete(component);
  }

  // console.log("returning", result, "from", code.name, component);
  return result;
};

const checkReturn = (code, result) => {
  if (!mightReturns.has(code) && result !== undefined) {
    mightReturns.add(code);
    // console.log(code.name, "might return because of", result);
  }
};

const finish = (component, code) => {
  // Destroy children that were not visited on this execution
  const children = childrens.get(component);
  if (children) {
    const nextIndex = currentIndexes.get(component);
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

const createComponent = (code, parent, key) => {
  const component = `rahti-${idCounter++}`;
  components.add(component);

  // Get or create parent's children
  let children = childrens.get(parent);
  if (!children) {
    // console.log("starting children for", codes.get(parent).name);
    children = [];
    childrens.set(parent, children);
  }

  // Get parent's current index and save as a child using it
  const index = currentIndexes.get(parent);
  children.splice(index, 0, component);

  // Save the parent, the key, and the code
  parents.set(component, parent);
  if (key !== undefined) keys.set(component, key);
  codes.set(component, code);

  // Mark as needing an update
  // console.log("created", code.name, "in", codes.get(parent).name, "at", currentIndexes.get(parent));
  needsUpdates.add(component);

  return component;
};

const getComponent = (code, parent, key) => {
  // console.log("looking for", code.name, "in", codes.get(parent).name, "with key:", key);
  const children = childrens.get(parent);

  if (children) {
    // Find the current child
    const currentIndex = currentIndexes.get(parent);
    const currentChild = childrens.get(parent)[currentIndex];

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

const destroy = (component) => {
  // console.log("destroying", codes.get(component).name);

  // Run the cleanup, if there is any
  const cleaners = cleanups.get(component);

  if (cleaners) {
    // console.log("running cleanup for", codes.get(component).name);
    for (const cleaner of cleaners) {
      try {
        cleaner(true);
      } catch (error) {
        reportError(error);
      }
    }

    cleaners.clear();
  }

  const children = childrens.get(component);

  // Destroy children
  if (children) {
    for (const child of children) {
      destroy(child);
    }
  }

  components.delete(component);
  parents.delete(component);
  childrens.delete(component);
  currentIndexes.delete(component);
  keys.delete(component);

  argumentCache.delete(component);
  valueCache.delete(component);
  pendings.delete(component);

  cleanups.delete(component);
  needsUpdates.delete(component);
  mightReturns.delete(component);
  updateQueue.delete(component);
};

export const cleanup = (component, callback) => {
  let cleaners = cleanups.get(component);

  if (!cleaners) {
    cleaners = new Set();
    cleanups.set(component, cleaners);
  }

  cleaners.add(callback);
};
export const cleanUp = cleanup;

let queueWillRun = false;

export const update = (component) => {
  if (components.has(component)) {
    // console.log("=== updating", codes.get(component).name);

    needsUpdates.add(component);
    let current = component;

    while (mightReturns.has(codes.get(current))) {
      needsUpdates.add(current);
      const parent = parents.get(current);
      if (parent === self) break;
      current = parent;
    }

    // if (current !== component) console.log("escalated update up to", codes.get(current).name);
    needsUpdates.add(current);
    updateQueue.add(current);

    if (!queueWillRun) {
      queueWillRun = true;
      queueMicrotask(runUpdateQueue);
    }
  } else {
    // console.log("!!! skipped updating destroyed", component);
  }
};

const runUpdateQueue = () => {
  for (const component of updateQueue) {
    updateQueue.delete(component);

    const code = codes.get(component);
    // console.log("=== applying update to", code.name, component);
    (asyncs.has(code) ? startAsync : start)(component, undefined, code);
  }

  queueWillRun = false;
};
