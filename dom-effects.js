import { effect, onCleanup } from "./effect.js";
import { isServer, ServerElement } from "./server-side-rendering.js";

const eventKey = "__vuoro_event__";
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
  } else if (type === "object" && !(Symbol.iterator in argument)) {
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
  (a, b) => {
    if (typeof a !== typeof b) return false;

    if (typeof a === "object" && !(Symbol.iterator in a)) {
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
