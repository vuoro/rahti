import { ssrIdentifier, isServer } from "./server-side-rendering.js";

const createContext = (body, type, key) => {
  // console.log("create", type, key);
  return {
    children: [],
    cleanups: new Set(),
    value: null,
    shouldUpdate: true,
    parent: null,
    key,
    type,
    body,
  };
};

export const rootContext = createContext(() => {}, "rootContext");
export const stack = [rootContext];
export const indexStack = [-1];

export const defaultAreSame = (a, b) => a === b;
export const argumentCache = new WeakMap();
export const hasReturneds = new WeakSet();
let effectTypeCounter = 0;

const getContext = (type, key) => {
  let context;

  const parent = stack[stack.length - 1];
  const { children } = parent;

  indexStack[indexStack.length - 1]++;
  const currentIndex = indexStack[indexStack.length - 1];
  const currentChild = children[currentIndex];

  if (currentChild && currentChild.type === type && currentChild.key === key) {
    // If the current child looks like this one, use it
    // console.log("found here", `${type}:${key} at ${indexStack}`);
    context = currentChild;
  } else {
    // Try to find the next matching child
    for (let index = currentIndex + 1, { length } = children; index < length; index++) {
      const child = children[index];
      if (child.type === type && child.key === key) {
        // console.log("found later at", index, `${type}:${key} at ${indexStack}`);
        context = child;
        // Move it into its new place
        children.splice(index, 1);
        children.splice(currentIndex, 0, child);
        break;
      }
    }
  }

  return context;
};

const addContext = (context) => {
  const parent = stack[stack.length - 1];
  const index = indexStack[indexStack.length - 1];
  parent.children.splice(index, 0, context);
  context.parent = parent;
};

export const effect = (thing, areSame = defaultAreSame, shouldUseKey = true) => {
  // const type = `${thing.name || "anonymous"} (${effectTypeCounter++})`;
  const type = effectTypeCounter++;

  const body = function () {
    const key = shouldUseKey ? arguments[0] : undefined;
    let context = getContext(type, key);

    if (!context) {
      context = createContext(body, type, key);
      addContext(context);
    }

    if (!context.shouldUpdate || !areSame) {
      const previousArguments = argumentCache.get(context);
      const newLength = arguments.length;
      const previousLength = previousArguments.length;

      if (newLength !== previousLength) {
        context.shouldUpdate = true;
      } else {
        for (let index = 0; index < arguments.length; index++) {
          const previousArgument = previousArguments[index];
          const newArgument = arguments[index];
          if (!areSame(newArgument, previousArgument)) {
            context.shouldUpdate = true;
            break;
          }
        }
      }
    }

    argumentCache.set(context, arguments);

    if (context.shouldUpdate) {
      context.shouldUpdate = false;
      stack.push(context);
      indexStack.push(-1);

      runCleanup(context);
      try {
        context.value = thing.apply(null, arguments);
      } catch (error) {
        console.error(error);
      }

      if (context.value !== undefined && !hasReturneds.has(body)) hasReturneds.add(body);

      // Destroy children that were not visited on this execution
      const { children } = context;
      const { length } = children;
      const nextIndex = indexStack[indexStack.length - 1] + 1;

      if (nextIndex < length) {
        // console.log("Destroying leftover children in ", type, key);
        for (let index = nextIndex; index < length; index++) {
          destroy(children[index]);
        }
        children.splice(nextIndex);
      }

      stack.pop();
      indexStack.pop();
    }

    return context.value;
  };

  if (isServer) body[ssrIdentifier] = true;
  return body;
};

const destroy = (context) => {
  // console.log("destroying", context.type, context.key);
  runCleanup(context, true);
  context.parent = null;
  context.value = null;
  context.key = null;

  for (const child of context.children) {
    destroy(child);
  }
  context.children.splice(0);
};

const runCleanup = ({ cleanups }, isFinal = false) => {
  for (const cleanup of cleanups) {
    // console.log(isFinal ? "running final cleanup" : "running cleanup", cleanup);
    try {
      cleanup(isFinal);
    } catch (error) {
      console.error(error);
    }
  }
  cleanups.clear();
};

export const onCleanup = (cleanup) => {
  stack[stack.length - 1].cleanups.add(cleanup);
};
