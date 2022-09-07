import { cleanup } from "./component.js";

export const Mount = function (props, ...children) {
  const element = props?.to;
  if (!element) throw new Error("Missing `to` from <Mount to={DOMElement}>…</Mount>");
  processChildren(children, element, this);
  return element;
};

export const DomElement = function (props) {
  const isSvg = false;

  const element = this(Element, null, props["rahti:element"], isSvg);

  for (const key in props) {
    if (key === "rahti:element") continue;

    const value = props[key];

    if (key === "style") {
      // inline style
      this(Style, null, value, element);
    } else if (key === "events") {
      // events object
      for (const key in value) {
        const eventValue = value[key];
        if (Array.isArray(eventValue)) {
          this(EventListener, null, element, key, ...eventValue);
        } else {
          this(EventListener, null, element, key, eventValue);
        }
      }
    } else {
      // attribute
      this(Attribute, null, key, value, element);
    }
  }

  if (arguments.length > 1) processChildren(arguments, element, this, 0, 1, isSvg);

  return element;
};

const nodes = new Map();

const Element = function (tagName, isSvg) {
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);

  nodes.set(this, element);
  cleanup(this, cleanNode);

  return element;
};

function cleanNode() {
  nodes.get(this).remove();
  nodes.delete(this);
}

const processChildren = (children, element, instance, slotIndex = 0, startIndex = 0, isSvg) => {
  for (let index = startIndex, { length } = children; index < length; index++) {
    const child = children[index];

    if (child instanceof Node) {
      // it's already an element of some kind, so let's just mount it
      instance(Slot, null, child, element, slotIndex++);
    } else if (Array.isArray(child)) {
      // treat as a list of grandchildren
      slotIndex = processChildren(child, element, instance, slotIndex);
    } else {
      // treat as Text
      const textNode = instance(TextNode);
      textNode.nodeValue = child;
      instance(Slot, null, textNode, element, slotIndex++);
    }
  }

  return slotIndex;
};

const TextNode = function () {
  const node = new Text();
  nodes.set(this, node);
  cleanup(this, cleanNode);
  return node;
};

const Slot = function (child, parent, index) {
  if (index >= parent.children.length) {
    parent.appendChild(child);
  } else {
    parent.insertBefore(child, parent.children[index]);
  }
};

const Style = function (value, element) {
  element.style.cssText = value;

  nodes.set(this, element);
  cleanup(this, cleanStyle);
};

function cleanStyle(isFinal) {
  if (isFinal) {
    nodes.get(this).style.cssText = "";
    nodes.delete(this);
  }
}

const Attribute = function (key, value, element) {
  if (typeof value === "boolean") {
    if (value) {
      element.setAttribute(key, key);
    } else {
      element.removeAttribute(key);
    }
  } else {
    element.setAttribute(key, value);
  }

  nodes.set(this, element);
  attributeKeys.set(this, key);
  cleanup(this, cleanAttribute);
};

const attributeKeys = new Map();

function cleanAttribute(isFinal) {
  if (isFinal) {
    nodes.get(this).removeAttribute(attributeKeys.get(this));
    nodes.delete(this);
    attributeKeys.delete(this);
  }
}

export const EventListener = function (target, key, value, options) {
  target.addEventListener(key, value, options);

  nodes.set(this, target);
  eventKeys.set(this, key);
  eventValues.set(this, value);
  eventOptions.set(this, options);

  cleanup(this, cleanEventListener);
};

const eventKeys = new Map();
const eventValues = new Map();
const eventOptions = new Map();

function cleanEventListener(isFinal) {
  const node = nodes.get(this);
  const key = eventKeys.get(this);
  const value = eventValues.get(this);
  const options = eventValues.get(this);

  node.removeEventListener(key, value, options);

  if (isFinal) {
    nodes.delete(this);
    eventKeys.delete(this);
    eventValues.delete(this);
    eventOptions.delete(this);
  }
}
