export const isServer = import.meta?.env?.SSR || typeof window === "undefined";
export const identifier = "__vuoro_rahti__";
export class ServerElement {
  constructor(tagName) {
    if (!tagName) {
      this.isFragment = true;
    } else {
      this.tagName = tagName;
    }

    this.isServerElement = true; // for some reason instanceof randomly fails
    this.style = {};
    this.attributes = new Map();
    this.children = new Set();
  }

  append(child) {
    if (child.isFragment) {
      for (const grandChild of child.children) {
        this.append(grandChild);
      }
      child.children.clear();
    } else {
      this.children.add(child);
    }
  }
  replaceChildren(fromElement) {
    this.children.clear();

    if (fromElement.isFragment) {
      for (const child of fromElement.children) {
        this.append(child);
      }
      fromElement.children.clear();
    } else {
      this.append(fromElement);
    }
  }

  getAttribute(key) {
    this.attributes.get(key);
  }
  setAttribute(key, value) {
    this.attributes.set(key, key === value ? true : value);
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }

  addEventListener() {}
  removeEventListener() {}

  toString() {
    let result = "";

    if (!this.isFragment) {
      result += `<${this.tagName}`;

      for (const [key, value] of this.attributes) {
        result += ` ${key}`;
        if (typeof value !== "boolean") result += `="${value}"`;
      }

      if (this.style.cssText) result += ` style="${this.style.cssText}"`;

      result += `>`;
    }

    for (const child of this.children) {
      if (result.isServerElement || typeof result === "string" || typeof result === "number") {
        result += child;
      }
    }

    if (!this.isFragment) result += `</${this.tagName}>`;

    return result;
  }
}

const defaultCompare = (a, b) => a === b;
const schedule = isServer ? () => {} : window.requestIdleCallback || window.requestAnimationFrame;
let later;
const updateQueue = new Set();
const processQueue = () => {
  for (const context of updateQueue) {
    updateState(context, context.body.nextValue);
  }
  later = null;
};
const updateState = (context, newValue) => {
  // console.log("================ setting", newValue);
  context.body[0] = newValue;

  const { globalParents } = context.body;

  if (globalParents) {
    for (const parent of globalParents) {
      rerun(parent, true);
    }
  } else {
    rerun(context.parent, true);
  }
};

const createContext = (body, type, key) => {
  // console.log("create", type, key);
  return {
    argumentCache: new Map(),
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

const rootContext = createContext(() => {}, "rootContext");
const stateType = "state";
const globalStateType = "globalState";
const globalStateAccessorType = "globalStateAccessor";
const eventKey = "__vuoro_event__";
let effectTypeCounter = 0;
const indexStack = [-1];
const stack = [rootContext];

const rerun = (context, shouldUpdate = false) => {
  let contextToRerun = context;
  contextToRerun.shouldUpdate = shouldUpdate;

  // console.log("starting a rerun of", context.type);

  while (contextToRerun.body.hasReturned && contextToRerun.parent !== rootContext) {
    contextToRerun = contextToRerun.parent;
    // console.log("escalating rerun up to", contextToRerun.type);
    contextToRerun.shouldUpdate = shouldUpdate;
  }

  stack.push(contextToRerun.parent);
  indexStack.push(-1);
  contextToRerun.body.call(null, ...contextToRerun.argumentCache.values());
  stack.pop();
  indexStack.pop();
};

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

export const state = (defaultInitialValue, getSetter, compare = defaultCompare) => {
  const body = (initialValue = defaultInitialValue) => {
    let context = getContext(stateType);

    if (!context) {
      const body = [initialValue, null];

      const get = () => body[0];
      const set = (newValue) => {
        if (!compare || !compare(body[0], newValue)) {
          if (stack.length > 1) {
            // TODO: this might break on initial execution
            // console.log("========================= setting later", newValue);
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

  body[identifier] = true;
  return body;
};

export const globalState = (initialValue, getSetter, compare = defaultCompare) => {
  const storage = [initialValue, null];
  const globalParents = new Set();
  storage.globalParents = globalParents;

  const context = createContext(storage, globalStateType, storage);
  addContext(context);

  const get = () => storage[0];
  const set = (newValue) => {
    if (!compare || !compare(storage[0], newValue)) {
      if (stack.length > 1) {
        // TODO: this might break on initial execution
        // console.log("========================= setting later", newValue);
        updateQueue.add(context);
        storage.nextValue = newValue;
        later = later || schedule(processQueue);
      } else {
        updateState(context, newValue);
      }
    }
  };

  storage[1] = getSetter ? getSetter(get, set) : set;

  const body = () => {
    let context = getContext(globalStateAccessorType, storage);

    if (!context) {
      context = createContext(storage, globalStateAccessorType, storage);
      addContext(context);
      globalParents.add(context.parent);
    }

    return context.body;
  };

  body[identifier] = true;
  return body;
};

export const effect = (thing, compare = defaultCompare, shouldUseKey = true) => {
  const type = `${thing.name || "anonymous"} (${effectTypeCounter++})`;

  const body = function () {
    const key = shouldUseKey ? arguments[0] : undefined;
    let context = getContext(type, key);

    if (!context) {
      context = createContext(body, type, key);
      addContext(context);
    }

    const { argumentCache } = context;

    for (let index = 0; index < Math.max(arguments.length, argumentCache.size); index++) {
      const argument = argumentCache.get(index);
      const newArgument = arguments[index];
      if (context.shouldUpdate || !compare || !compare(argument, newArgument, index)) {
        argumentCache.set(index, newArgument);
        if (!context.shouldUpdate) context.shouldUpdate = true;
      }
    }

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

      if (!body.hasReturned && context.value !== undefined) body.hasReturned = true;

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

  body[identifier] = true;
  body.hasReturned = false;
  return body;
};

const destroy = (context) => {
  // console.log("destroying", context.type, context.key);
  runCleanup(context, true);
  context.parent = null;
  context.value = null;
  context.argumentCache.clear();
  context.key = null;
  
  if (context.type === globalStateAccessorType) {
    context.body.globalParents.delete(context);
  }

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

const htmlCache = new Map();
const communalFragment = isServer ? new ServerElement() : new DocumentFragment();
const communalSet = new Set();
export const html = new Proxy(
  {},
  {
    get: function (target, tagName) {
      const cached = htmlCache.get(tagName);
      if (cached) return cached;

      const tagEffect = createTagEffect(tagName);

      htmlCache.set(tagName, tagEffect);
      return tagEffect;
    },
  }
);
export const svg = new Proxy(
  {},
  {
    get: function (target, tagName) {
      const cached = htmlCache.get(tagName);
      if (cached) return cached;

      const tagEffect = createTagEffect(tagName, svgElement);

      htmlCache.set(tagName, tagEffect);
      return tagEffect;
    },
  }
);

const processTagEffectArgument = (argument, element) => {
  const type = typeof argument;

  if (
    (isServer ? argument?.isServerElement : argument instanceof Node) ||
    type === "string" ||
    type === "number"
  ) {
    communalSet.add(argument);
    return true;
  } else if (type === "object" && Symbol.iterator in argument) {
    let hasChildren = false;
    for (const what of argument) {
      const result = processTagEffectArgument(what, element);
      hasChildren = hasChildren || !!result;
    }
    return hasChildren;
  } else if (type === "object" && argument !== null && !Array.isArray(argument)) {
    if (argument[eventKey]) {
      htmlEventHandler(element, argument);
    } else {
      htmlAttributes(element, argument);
    }
  }
};

const createTagEffect = (tagName, elementEffect = htmlElement, overrideElement) => {
  const result = function () {
    const element = overrideElement || elementEffect(tagName);
    let hasChildren = false;

    for (let index = 0, { length } = arguments; index < length; index++) {
      const result = processTagEffectArgument(arguments[index], element);
      hasChildren = hasChildren || !!result;
    }

    if (hasChildren) {
      htmlChildren(element, ...communalSet);
      communalSet.clear();
    }

    return element;
  };
  Object.defineProperty(result, "name", { value: tagName, configurable: true });

  return effect(result);
};

const htmlElement = effect(function htmlElement(tagName) {
  return isServer ? new ServerElement(tagName) : document.createElement(tagName);
});
const svgElement = effect(function svgElement(tagName) {
  return isServer
    ? new ServerElement(tagName)
    : document.createElementNS("http://www.w3.org/2000/svg", tagName);
});
const htmlChildren = effect(function htmlChildren() {
  const element = arguments[0];

  for (let index = 1, { length } = arguments; index < length; index++) {
    const child = arguments[index];
    const type = typeof child;

    const node = !isServer && (type === "string" || type === "number") ? new Text(child) : child;
    communalFragment.append(node);
  }

  element.replaceChildren(communalFragment);
});
const htmlAttributes = effect(
  function htmlAttributes(element, attributes) {
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
      for (const key in a) {
        if (!(key in b) || a[key] !== b[key]) {
          return false;
        }
      }
      for (const key in b) {
        if (!(key in a) || a[key] !== b[key]) {
          return false;
        }
      }
      return true;
    }

    return a === b;
  }
);
const htmlEventHandler = effect(function htmlEventHandler(
  element,
  { [eventKey]: event, handler: handler, ...options }
) {
  // console.log("attaching handler", event);
  element.addEventListener(event, handler, options);
  onCleanup(() => {
    // console.log("removing handler", event);
    element.removeEventListener(event, handler);
  });
});

export const event = effect(function event(event, handler, options) {
  return { [eventKey]: event, handler, ...options };
});

export const createRoot = (element) =>
  createTagEffect("(root) " + element.tagName, undefined, element);
