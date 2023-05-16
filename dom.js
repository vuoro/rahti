import { CleanUp } from "./component.js";

export const Mount = function ({ to }, ...children) {
  if (!to) throw new Error("Missing `to` from <Mount to={DOMElement}>…</Mount>");
  processChildren.call(this, children, to, 0, 0);
  return to;
};

export const DomElement = function (props, type, ...children) {
  const isSvg = type.startsWith("svg:");
  const element = this.run(Element, null, type, isSvg);

  for (const key in props) {
    if (key === "rahti:element") continue;

    const value = props[key];

    if (key === "style") {
      // inline style
      this.run(Style, null, value, element);
    } else if (key === "events") {
      // events object
      for (const key in value) {
        const eventValue = value[key];
        if (Array.isArray(eventValue)) {
          this.run(EventListener, null, element, key, ...eventValue);
        } else {
          this.run(EventListener, null, element, key, eventValue);
        }
      }
    } else {
      // attribute
      this.run(Attribute, null, key, value, element);
    }
  }

  if (children.length > 0) processChildren.call(this, children, element, 0, 0);

  return element;
};

const nodes = new Map();

const Element = function (props, tagName, isSvg) {
  const finalTagName = isSvg ? tagName.slice(4) : tagName;
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", finalTagName)
    : document.createElement(finalTagName);

  nodes.set(this.id, element);
  this.run(CleanUp, null, cleanNode);

  return element;
};

const TextNode = function () {
  const node = new Text();
  nodes.set(this.id, node);
  this.run(CleanUp, null, cleanNode);
  return node;
};

function cleanNode(isFinal) {
  if (isFinal) {
    const node = nodes.get(this.id);
    node.remove();
    nodes.delete(this.id);
    slotChildren.delete(node);
    slotIndexes.delete(node);
  }
}

const tempProps = {};

const processChildren = function (children, element, slotIndex = 0, startIndex = 0) {
  for (let index = startIndex, { length } = children; index < length; index++) {
    const child = children[index];

    if (child instanceof Node) {
      // it's already an element of some kind, so let's just mount it
      tempProps.key = child;
      this.run(Slot, tempProps, child, element, slotIndex++);
    } else if (Array.isArray(child)) {
      // treat as a list of grandchildren
      slotIndex = processChildren.call(this, child, element, slotIndex);
    } else {
      const type = typeof child;

      if (type === "string" || type === "number") {
        // treat as Text
        const textNode = this.run(TextNode);
        textNode.nodeValue = child;
        tempProps.key = textNode;
        this.run(Slot, tempProps, textNode, element, slotIndex++);
      }
    }
  }

  return slotIndex;
};

const Slot = function (props, child, parent, index) {
  slotChildren.set(child, parent);
  slotIndexes.set(child, index);

  if (!slotQueueWillRun) {
    slotQueueWillRun = true;
    queueMicrotask(processSlotQueue);
  }
};

let slotQueueWillRun = false;
const slotChildren = new Map();
const slotIndexes = new Map();

const processSlotQueue = () => {
  for (const [child, parent] of slotChildren) {
    const index = slotIndexes.get(child);

    if (index > parent.children.length) {
      parent.appendChild(child);
    } else if (parent.children.item(index) !== child) {
      parent.insertBefore(child, parent.children[index]);
    }

    slotChildren.delete(child);
    slotIndexes.delete(child);
  }

  slotQueueWillRun = false;
};

const Style = function (props, value, element) {
  element.style.cssText = value;

  nodes.set(this.id, element);
  this.run(CleanUp, null, cleanStyle);
};

function cleanStyle(isFinal) {
  if (isFinal) {
    nodes.get(this.id).style.cssText = "";
    nodes.delete(this.id);
  }
}

const Attribute = function (props, key, value, element) {
  if (typeof value === "boolean") {
    if (value) {
      element.setAttribute(key, key);
    } else {
      element.removeAttribute(key);
    }
  } else {
    element.setAttribute(key, value);
  }

  nodes.set(this.id, element);
  attributeKeys.set(this.id, key);
  this.run(CleanUp, null, cleanAttribute);
};

const attributeKeys = new Map();

function cleanAttribute(isFinal) {
  if (isFinal) {
    nodes.get(this.id).removeAttribute(attributeKeys.get(this.id));
    nodes.delete(this.id);
    attributeKeys.delete(this.id);
  }
}

export const EventListener = function (props, target, key, value, options) {
  target.addEventListener(key, value, options);

  nodes.set(this.id, target);
  eventKeys.set(this.id, key);
  eventValues.set(this.id, value);
  eventOptions.set(this.id, options);

  this.run(CleanUp, null, cleanEventListener);
};

const eventKeys = new Map();
const eventValues = new Map();
const eventOptions = new Map();

function cleanEventListener(isFinal) {
  const node = nodes.get(this.id);
  const key = eventKeys.get(this.id);
  const value = eventValues.get(this.id);
  const options = eventValues.get(this.id);

  node.removeEventListener(key, value, options);

  if (isFinal) {
    nodes.delete(this.id);
    eventKeys.delete(this.id);
    eventValues.delete(this.id);
    eventOptions.delete(this.id);
  }
}
