import { Component, cleanup, load, save } from "./component.js";

export const Mount = new Proxy(function (to, ...children) {
  if (children.length > 0) processChildren(children, to, 0);
  return to;
}, Component);

const getElement = function ({ components, isSvg }, tagName) {
  let component = components.get(tagName);
  if (component) return component;

  component = new Proxy(function (...children) {
    const element = Element(tagName, isSvg);
    if (children.length > 0) processChildren(children, element, 0);
    return element;
  }, Component);

  components.set(tagName, component);
  return component;
};

export const html = new Proxy(
  { components: new Map(), isSvg: false },
  {
    get: getElement,
  },
);

export const svg = new Proxy(
  { components: new Map(), isSvg: true },
  {
    get: getElement,
  },
);

const Element = new Proxy(function (tagName, isSvg) {
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);
  save(element);
  cleanup(cleanNode);
  return element;
}, Component);

const processChildren = function (children, element, slotIndex) {
  let currentSlotIndex = slotIndex;

  for (let index = 0, { length } = children; index < length; index++) {
    const child = children[index];

    if (child instanceof Node) {
      // it's already an element of some kind, so let's just mount it
      Slot(child, element, currentSlotIndex);
      currentSlotIndex++;
    } else if (child instanceof EventOfferer) {
      const { type, listener, options } = child;
      EventListener(element, type, listener, options);
    } else if (Array.isArray(child)) {
      // treat as a list of grandchildren
      currentSlotIndex = processChildren(child, element, currentSlotIndex);
    } else if (typeof child === "object") {
      // treat as attributes
      Attributes(element, child);
    } else {
      const type = typeof child;

      if (type === "string" || type === "number") {
        // treat as Text
        const textNode = TextNode();
        textNode.nodeValue = child;
        Slot(textNode, element, currentSlotIndex);
        currentSlotIndex++;
      }
    }
  }

  return currentSlotIndex;
};

const TextNode = new Proxy(function () {
  const node = new Text();
  save(node);
  cleanup(cleanNode);
  return node;
}, Component);

const removedNodes = new Set();

function cleanNode(node) {
  node.remove();
  removedNodes.add(node);
}

const Attributes = new Proxy(function (element, attributes) {
  const newAttributes = new Map();
  const previousAttributes = load();

  for (const key in attributes) {
    const value = attributes[key];
    newAttributes.set(key, value);
    if (previousAttributes) previousAttributes.delete(key);

    if (key === "style") {
      // inline style
      element.style.cssText = value;
    } else {
      // attribute
      if (typeof value === "boolean") {
        if (value) {
          element.setAttribute(key, key);
        } else {
          element.removeAttribute(key);
        }
      } else {
        element.setAttribute(key, value);
      }
    }
  }

  // Remove unused previous attributes
  if (previousAttributes) {
    for (const [key] in previousAttributes) {
      if (key === "style") {
        element.style.cssText = "";
      } else {
        element.removeAttribute(key);
      }
    }
  }
  if (newAttributes?.size) save(newAttributes);
}, Component);

let slotQueueWillRun = false;
const slotChildren = new Map();
const slotIndexes = new Map();

const Slot = new Proxy(function (child, parent, index) {
  slotChildren.set(child, parent);
  slotIndexes.set(child, index);

  if (!slotQueueWillRun) {
    slotQueueWillRun = true;
    queueMicrotask(processSlotQueue);
  }
}, Component);

const processSlotQueue = () => {
  for (const [child, parent] of slotChildren) {
    const index = slotIndexes.get(child);

    if (removedNodes.has(child)) {
      removedNodes.delete(child);
      child.remove();
    } else if (index > parent.childNodes.length) {
      parent.appendChild(child);
    } else {
      const childInTheWay = parent.childNodes.item(index);
      if (childInTheWay !== child) parent.insertBefore(child, childInTheWay);
    }

    slotChildren.delete(child);
    slotIndexes.delete(child);
  }

  slotQueueWillRun = false;
};

export const EventListener = new Proxy(function (target, type, listener, options) {
  target.addEventListener(type, listener, options);
  save([target, type, listener, options]);
  cleanup(cleanEventListener);
}, Component);

function cleanEventListener([target, type, listener, options]) {
  target.removeEventListener(type, listener, options);
}

export const EventHandler = new Proxy(function (type, listener, options) {
  const offerer = new EventOfferer();
  offerer.type = type;
  offerer.listener = listener;
  offerer.options = options;
  return offerer;
}, Component);

class EventOfferer {
  type = "click";
  listener = null;
  options = null;
}
