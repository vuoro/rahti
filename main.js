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
  rerun(context.parent, true);
};

const createContext = (body, type) => ({
  argumentCache: new Map(),
  children: [],
  cleanups: new Set(),
  value: null,
  shouldUpdate: true,
  type,
  body,
});

const rootContext = createContext(() => {
  for (const child of rootContext.children) {
    rerun(child);
  }
}, "root");
const stateType = "state";
let effectTypeCounter = 1;
const indexStack = [-1];
const stack = [rootContext];

export const rerun = (context, forceUpdate = false) => {
  stack.push(context.parent);
  indexStack.push(-1);
  context.shouldUpdate = forceUpdate;
  context.body.call(null, ...context.argumentCache.values());
  context.shouldUpdate = false;
  stack.pop();
  indexStack.pop();
};

const getContext = (type) => {
  let context;

  const parent = stack[stack.length - 1];
  const { children } = parent;

  indexStack[indexStack.length - 1]++;
  const currentIndex = indexStack[indexStack.length - 1];
  const currentChild = children[currentIndex];

  console.log("get", `${type} at ${indexStack}`);

  if (currentChild && currentChild.type === type) {
    // If the current child looks like this one, use it
    console.log("found here");
    context = currentChild;
  } else {
    // Try to find the next matching child
    for (let index = currentIndex, { length } = children; index < length; index++) {
      const child = children[index];
      if (child.type === type) {
        console.log("found later at", index);
        context = child;
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

export const getEffect = () => stack[stack.length - 1];

export const state = (defaultInitialValue, getSetter, compare = defaultCompare) => {
  const body = (initialValue = defaultInitialValue) => {
    let context = getContext(stateType);

    if (!context) {
      const body = [initialValue];

      const get = () => body[0];
      const set = (newValue) => {
        console.log("===================================== trying to set", newValue);
        if (!compare(body[0], newValue)) {
          if (stack.length > 1) {
            console.log("setting later", newValue);
            updateQueue.add(context);
            body.nextValue = newValue;
            later = later || schedule(processQueue);
          } else {
            console.log("setting now", newValue);
            updateState(context, newValue);
          }
        }
      };

      body[1] = getSetter ? getSetter(get, set) : set;

      console.log("create state");
      context = createContext(body, stateType);
      addContext(context);
    }

    console.log("getting state", context.body);

    return context.body;
  };

  return body;
};

export const effect = (thing, compare = defaultCompare) => {
  const type = effectTypeCounter++;

  const body = function () {
    let context = getContext(type);
    let shouldUpdate = false;

    if (!context) {
      console.log("create", type);
      context = createContext(body, type);
      addContext(context);
      shouldUpdate = true;
    }

    const { argumentCache } = context;
    shouldUpdate = shouldUpdate || context.shouldUpdate;

    for (let index = 0; index < Math.max(arguments.length, argumentCache.size); index++) {
      const argument = argumentCache.get(index);
      const newArgument = arguments[index];
      if (!compare(argument, newArgument, index)) {
        argumentCache.set(index, newArgument);
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      stack.push(context);
      indexStack.push(-1);

      // try {
      runCleanup(context);
      context.value = thing.apply(null, arguments);
      // } catch (error) {
      // console.error(error);
      // }

      // Destroy children that were not visited on this execution
      const { children } = context;
      const { length } = children;
      const nextIndex = Math.max(indexStack[indexStack.length - 1], 0);
      for (let index = nextIndex; index < length - 1; index++) {
        console.log("destroying leftover child", index, length);
        destroy(children[index]);
      }
      children.splice(nextIndex + 1);

      stack.pop();
      indexStack.pop();
    }

    return context.value;
  };

  return body;
};

const destroy = (context) => {
  runCleanup(context, true);
  context.parent = null;
  context.argumentCache.clear();

  for (const child of context.children) {
    destroy(child);
  }
  context.children.splice(0);
};

const runCleanup = ({ cleanups }, isFinal = false) => {
  for (const cleanup of cleanups) {
    console.log(isFinal ? "running final cleanup" : "running cleanup", cleanup);
    cleanup(isFinal);
  }
  cleanups.clear();
};

export const onCleanup = (cleanup) => {
  stack[stack.length - 1].cleanups.add(cleanup);
};

const htmlCache = new Map();
const communalFragment = new DocumentFragment();
const communalSet = new Set();
export const html = new Proxy(
  {},
  {
    get: function (target, tagName) {
      const cached = htmlCache.get(tagName);
      if (cached) return cached;

      const tagEffect = effect(function () {
        const element = htmlElement(tagName);

        for (let index = 0, { length } = arguments; index < length; index++) {
          const argument = arguments[index];
          const type = typeof argument;

          if (argument instanceof Node || type === "string" || type === "number") {
            communalSet.add(argument);
          } else if (type === "object" && argument !== null && !Array.isArray(argument)) {
            if (argument.__event__) {
              htmlEventHandler(element, argument);
            } else {
              htmlAttributes(element, argument);
            }
          }
        }

        htmlChildren(element, ...communalSet);
        communalSet.clear();

        return element;
      });

      htmlCache.set(tagName, tagEffect);
      return tagEffect;
    },
  }
);

const htmlElement = effect((tagName) => document.createElement(tagName));
const htmlChildren = function () {
  const element = arguments[0];

  for (let index = 1, { length } = arguments; index < length; index++) {
    const child = arguments[index];
    const type = typeof child;

    const node = type === "string" || type === "number" ? new Text(child) : child;
    communalFragment.append(node);
  }

  element.replaceChildren(communalFragment);
};
const htmlAttributes = effect(
  (element, attributes) => {
    for (const key in attributes) {
      const value = attributes[key];
      if (key === "style") {
        element.style.cssText = value;
        onCleanup(() => (element.style.cssText = ""));
      } else {
        element.setAttribute(key, typeof value === "boolean" ? key : value);
        onCleanup(() => element.removeAttribute(key));
      }
    }
  },
  (a, b, index) => {
    if (index === 1 && a && b) {
      // Shallow-compare attributes
      for (var key in a) {
        if (!(key in b) || a[key] !== b[key]) {
          return false;
        }
      }
      for (var key in b) {
        if (!(key in a) || a[key] !== b[key]) {
          return false;
        }
      }
      return true;
    }

    return a === b;
  }
);
const htmlEventHandler = effect((element, { __event__: event, handler: handler, ...options }) => {
  console.log("attaching handler", event);
  element.addEventListener(event, handler, options);
  onCleanup(() => {
    console.log("removing handler", event);
    element.removeEventListener(event, handler);
  });
});

export const event = effect((event, handler, options) => {
  return { __event__: event, handler, ...options };
});

export const createRoot = (element) =>
  effect(function () {
    htmlChildren(element, ...arguments);
  });
