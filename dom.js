import { CleanUp } from "./component.js";

export const Mount = function ({ to }) {
  if (!to) throw new Error("Missing `to` from <Mount to={DOMElement}>…</Mount>");
  processChildren.call(this, arguments, to, 0, 1);
  return to;
};

export const DomElement = function (props) {
  const isSvg = props["rahti:element"].startsWith("svg:");

  const element = this.run(Element, null, props["rahti:element"], isSvg);

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

  if (arguments.length > 1) processChildren.call(this, arguments, element, 0, 1);

  return element;
};

const nodes = new Map();

const Element = function (props, tagName, isSvg) {
  const finalTagName = isSvg ? tagName.slice(4) : tagName;
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", finalTagName)
    : document.createElement(finalTagName);

  nodes.set(this, element);
  this.run(CleanUp, { cleaner: cleanNode });

  return element;
};

function cleanNode(isFinal) {
  if (isFinal) {
    nodes.get(this).remove();
    nodes.delete(this);
  }
}

let tempProps = {};

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
      // treat as Text
      const textNode = this.run(TextNode);
      textNode.nodeValue = child;
      tempProps.key = textNode;
      this.run(Slot, tempProps, textNode, element, slotIndex++);
    }
  }

  return slotIndex;
};

const TextNode = function () {
  const node = new Text();
  nodes.set(this, node);
  this.run(CleanUp, { cleaner: cleanNode });
  return node;
};

const Slot = function (props, child, parent, index) {
  if (index >= parent.children.length) {
    parent.appendChild(child);
  } else if (parent.children.item(index) !== child) {
    parent.insertBefore(child, parent.children[index]);
  }
};

const Style = function (props, value, element) {
  element.style.cssText = value;

  nodes.set(this, element);
  this.run(CleanUp, { cleaner: cleanStyle });
};

function cleanStyle(isFinal) {
  if (isFinal) {
    nodes.get(this).style.cssText = "";
    nodes.delete(this);
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

  nodes.set(this, element);
  attributeKeys.set(this, key);
  this.run(CleanUp, { cleaner: cleanAttribute });
};

const attributeKeys = new Map();

function cleanAttribute(isFinal) {
  if (isFinal) {
    nodes.get(this).removeAttribute(attributeKeys.get(this));
    nodes.delete(this);
    attributeKeys.delete(this);
  }
}

export const EventListener = function (props, target, key, value, options) {
  target.addEventListener(key, value, options);

  nodes.set(this, target);
  eventKeys.set(this, key);
  eventValues.set(this, value);
  eventOptions.set(this, options);

  this.run(CleanUp, { cleaner: cleanEventListener });
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
