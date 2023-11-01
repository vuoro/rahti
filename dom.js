import { Component, cleanup, load, save } from "./index.js";

export const Mount = new Proxy(function Mount(root, ...children) {
  if (!(root instanceof Node)) throw new Error("The first argument in Mount needs to be a DOM element");
  processChildren(children, root, 0, 0);
  return root;
}, Component);

const domHandler = {
  get: function (target, tagName) {
    if (!(tagName in target)) {
      target[tagName] = new Proxy(function DomElement(...children) {
        const element = Element(tagName, target.isSvg);
        if (children.length > 0) processChildren(children, element, 0, 0);
        return element;
      }, Component);
    }

    return target[tagName];
  },
};
export const html = new Proxy({}, domHandler);
export const svg = new Proxy({ isSvg: true }, domHandler);

const Element = new Proxy(function Element(tagName, isSvg) {
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);
  save(element);
  cleanup(cleanNode);
  return element;
}, Component);

const TextNode = new Proxy(function TextNode() {
  const node = new Text();
  save(node);
  cleanup(cleanNode);
  return node;
}, Component);

function cleanNode(node) {
  node.remove();
  removedNodes.add(node);
}

const removedNodes = new Set();

const processChildren = function (children, element, slotIndex = 0, startIndex = 0) {
  for (let index = startIndex, { length } = children; index < length; index++) {
    const child = children[index];

    let previousAttributes = load();
    let newAttributes;

    if (child instanceof Node) {
      // it's already an element of some kind, so let's just mount it
      Slot(child, element, slotIndex++);
    } else if (Array.isArray(child)) {
      // treat as a list of grandchildren
      slotIndex = processChildren.call(this, child, element, slotIndex);
    } else {
      const type = typeof child;

      if (type === "object") {
        // treat as list of properties
        for (const key in child) {
          const value = child[key];
          newAttributes = newAttributes || new Map();
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
      } else if (type === "string" || type === "number") {
        // treat as Text
        const textNode = TextNode();
        textNode.nodeValue = child;
        Slot(textNode, element, slotIndex++);
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
  }

  return slotIndex;
};

const Slot = new Proxy(function Slot(child, parent, index) {
  slotChildren.set(child, parent);
  slotIndexes.set(child, index);

  if (!slotQueueWillRun) {
    slotQueueWillRun = true;
    queueMicrotask(processSlotQueue);
  }
}, Component);

let slotQueueWillRun = false;
const slotChildren = new Map();
const slotIndexes = new Map();

const processSlotQueue = () => {
  for (const [child, parent] of slotChildren) {
    const index = slotIndexes.get(child);

    if (removedNodes.has(child)) {
      removedNodes.delete(child);
    } else {
      if (index > parent.children.length) {
        parent.appendChild(child);
      } else if (parent.children.item(index) !== child) {
        parent.insertBefore(child, parent.children[index]);
      }
    }

    slotChildren.delete(child);
    slotIndexes.delete(child);
  }

  slotQueueWillRun = false;
};

export const EventListener = new Proxy(function EventListener(target, key, value, options) {
  target.addEventListener(key, value, options);
  save([target, key, value, options]);
  cleanup(cleanEventListener);
}, Component);

function cleanEventListener([target, key, value, options]) {
  target.removeEventListener(key, value, options);
}

export const Event = new Proxy(function Event() {}, Component);
