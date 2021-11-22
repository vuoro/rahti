const defaultCompare = (a, b) => a === b;
const schedule = window.requestIdleCallback || window.requestAnimationFrame;
let later;
const updateQueue = new Set();
const processQueue = () => {
  for (const context of updateQueue) {
    updateState(context, context.nextValue);
  }
  later = null;
};
const updateState = (context, newValue) => {
  context.body[0] = newValue;
  rerun(context.parent);
};
export const rerun = (context) =>
  context === rootContext ? undefined : context.body.apply(null, context.argumentCache.values());

const createContext = (body, type) => ({
  argumentCache: new Map(),
  children: [],
  cleanUps: new Set(),
  value: null,
  type,
  body,
});
const rootContext = createContext(() => {}, "__0__");
const stateType = "__1__";
let effectTypeCounter = 1;
const indexStack = [-1];
const stack = [rootContext];
export const getContext = (type) => {
  let context;

  const parent = stack[stack.length - 1];
  const { children } = parent;

  indexStack[indexStack.length - 1]++;
  const currentIndex = indexStack[indexStack.length - 1];
  const nextChild = children[currentIndex];

  if (nextChild && nextChild.type === type) {
    context = children[currentIndex];
  }

  return context;
};

export const addContext = (context) => {
  const parent = stack[stack.length - 1];
  const index = indexStack[indexStack.length - 1];
  parent.children.splice(index, 0, context);
  context.parent = parent;
};

export const state = (defaultInitialValue, getSetter, compare = defaultCompare) => {
  const body = (initialValue = defaultInitialValue) => {
    let context = getContext(stateType);

    if (!context) {
      const body = [initialValue];

      const get = () => body[0];
      const set = (newValue) => {
        if (!compare(body[0], newValue)) {
          if (stack.length > 1) {
            updateQueue.add(context);
            body.nextValue = newValue;
            later = later || schedule(processQueue);
          } else {
            updateState(context, newValue);
          }
        }
      };
      body[1] = getSetter ? getSetter(get, set) : set;

      context = createContext(body, stateType);
      addContext(context);
    }

    return context.body;
  };

  return body;
};

export const effect = (thing, compare = defaultCompare) => {
  const type = `__${effectTypeCounter++}__`;

  const body = () => {
    let shouldUpdate = false;

    let context = getContext(type);

    if (!context) {
      context = createContext(body, type);
      addContext(context);
      shouldUpdate = true;
    }

    const { argumentCache } = context;

    for (let index = 0; index < Math.max(arguments.length, argumentCache.size); index++) {
      const argument = argumentCache.get(index);
      const newArgument = arguments[index];
      if (!compare(argument, newArgument)) {
        argumentCache.set(index, newArgument);
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      stack.push(context);
      indexStack.push(-1);

      runCleanUp(context);
      context.value = thing.apply(null, arguments);

      // Destroy children that were not visited on this execution
      const { children } = context;
      const { length } = children;
      const nextIndex = indexStack[indexStack.length - 1];
      for (let index = nextIndex; index < length; index++) {
        destroy(child);
      }
      children.splice(nextIndex);

      stack.pop();
      indexStack.pop();
    }

    return context.value;
  };

  return body;
};

const destroy = (context) => {
  runCleanUp(context);
  context.parent = null;
  context.argumentCache.clear();

  for (const child of context.children) {
    destroy(child);
  }
  context.children.splice(0);
};

const runCleanUp = ({ cleanUps }) => {
  for (const cleanUp of cleanUps) {
    cleanUp();
  }
  cleanUps.clear();
};

export const onCleanUp = (cleanUp) => {
  stack[stack.length - 1].cleanUps.add(cleanUp);
};

export const html = {};

export const event = () => {};

export const text = () => {};
