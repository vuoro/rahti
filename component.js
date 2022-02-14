const parents = new WeakMap();
const childrens = new WeakMap();
const currentIndexes = new WeakMap();
const appliers = new WeakMap();
const keys = new WeakMap();
const codes = new WeakMap();
const pendings = new WeakSet();
const argumentCache = new WeakMap();
const valueCache = new WeakMap();

export const root = (code, key) => {
  const component = createComponent(code, rootComponent, key);
  return appliers.get(component);
};

const rootComponent = {};
codes.set(rootComponent, root);

const reportError = window.reportError || console.error;

const createComponent = (code, parent, key) => {
  // Create `this()`
  const component = function (code, key) {
    // Find or create the child component
    console.log(
      "looking for",
      code.name,
      "in",
      codes.get(component).name,
      "with key",
      key,
      "at",
      currentIndexes.get(component)
    );
    const found = getComponent(code, component, key);
    const child = found || createComponent(code, component, key);
    currentIndexes.set(component, currentIndexes.get(component) + 1);

    return appliers.get(child);
  };

  // Create `this(code)()`
  const applyComponent = function () {
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

    argumentCache.set(component, arguments);

    if (needsUpdate) {
      console.log("+++ start of", code.name);
      const cleaner = cleanupResolvers.get(component);
      if (cleaner) {
        console.log("running cleanup for", codes.get(component).name);
        cleaner(false);
      }

      let result;
      try {
        result = code.apply(component, arguments);
      } catch (error) {
        reportError(error);
      }

      if (result !== undefined && !mightReturns.has(code)) {
        mightReturns.add(code);
      }

      const promise = Promise.resolve(result);
      pendings.add(promise);
      promise.catch(reportError).finally(handleEndOfComponent);

      valueCache.set(component, result);
      needsUpdates.delete(component);

      return result;
    } else {
      console.log("!!! skipping update for", code.name);
      return valueCache.get(component);
    }
  };
  appliers.set(component, applyComponent);

  const handleEndOfComponent = () => {
    // Destroy children that were not visited on this execution
    const children = childrens.get(component);
    if (children) {
      const { length } = children;
      const nextIndex = currentIndexes.get(component) + 1;

      if (nextIndex < length) {
        console.log("Destroying leftover children in ", codes.get(component).name);
        for (let index = nextIndex; index < length; index++) {
          destroy(children[index]);
        }
        children.splice(nextIndex);
      }
    }

    pendings.delete(component);
    currentIndexes.set(component, 0);
    console.log("--- end of", code.name);
  };

  // Get or create parent's children
  let children = childrens.get(parent);
  if (!children) {
    console.log("starting children for", codes.get(parent).name);
    children = [];
    childrens.set(parent, children);
    currentIndexes.set(parent, 0);
  }

  // Get parent's current index and save as a child using it
  const index = currentIndexes.get(parent);
  children.splice(index, 0, component);

  // Save the parent, the key, and the code
  parents.set(component, parent);
  keys.set(component, key);
  codes.set(component, code);

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
        if (codes.get(currentChild) === code && keys.get(currentChild) === key) {
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
  const cleaner = cleanupResolvers.get(component);
  if (cleaner) {
    console.log("running final cleanup for", codes.get(component).name);
    cleaner(true);
  }

  const children = childrens.get(component);

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
  queueMicrotask(runUpdateQueue);
};

const runUpdateQueue = () => {
  for (const component of updateQueue) {
    updateQueue.delete(component);
    const applier = appliers.get(component);
    applier.apply(undefined, argumentCache.get(component));
  }
};

const states = new WeakMap();

export const state = function (initialValue, actions) {
  let state = states.get(this);

  if (!state) {
    state = [initialValue];
    const setter = (newValue) => {
      state[0] = newValue;
      update(this);
    };

    if (actions) {
      const getter = () => state[0];
      state.push(actions(getter, setter));
    } else {
      state.push(setter);
    }

    states.set(this, state);
  }

  return state;
};

export const createGlobalState = (initialValue, actions) => {
  let value = initialValue;
  const states = new Map();
  const cleaners = new WeakMap();

  const getter = () => value;
  const setter = (newValue) => {
    value = newValue;
    for (const [component, state] of states) {
      state[0] = value;
      update(component);
    }
  };
  const finalSetter = actions ? actions(getter, setter) : setter;

  const globalState = function () {
    let state = states.get(this);

    if (!state) {
      state = [value, finalSetter];
      states.set(this, state);
      cleaners.set(this, (isFinal) => {
        if (isFinal) states.delete(this);
      });
    }

    cleanup(this).finally(cleaners.get(this));
    return state;
  };

  return [globalState, finalSetter];
};
