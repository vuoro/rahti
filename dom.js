export const Mount = function ({ to = globalThis?.document?.body }, ...children) {
  processChildren.call(this, children, to, 0, 0);
  return to;
};

export const DomElement = function (props, type, ...children) {
  const element = this.run(Element, null, type);

  const newAttributes = new Map();
  let previousAttributes = this.load();

  for (const key in props) {
    if (key === "rahti:element") continue;

    const value = props[key];
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
  if (newAttributes?.size) this.save(newAttributes);

  if (children.length > 0) processChildren.call(this, children, element, 0, 0);

  return element;
};

const Element = function (props, tagName) {
  const isSvg = tagName.startsWith("svg:");
  const finalTagName = isSvg ? tagName.slice(4) : tagName;
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", finalTagName)
    : document.createElement(finalTagName);

  this.save(element);
  this.cleanup(cleanNode);

  return element;
};

const TextNode = function () {
  const node = new Text();
  this.save(node);
  this.cleanup(cleanNode);
  return node;
};

const removedNodes = new Set();

function cleanNode(node) {
  node.remove();
  removedNodes.add(node);
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

    if (removedNodes.has(child)) {
      removedNodes.delete(child);
      child.remove();
    } else if (index > parent.children.length) {
      parent.appendChild(child);
    } else if (parent.children.item(index) !== child) {
      parent.insertBefore(child, parent.children[index]);
    }

    slotChildren.delete(child);
    slotIndexes.delete(child);
  }

  slotQueueWillRun = false;
};

export const EventListener = function (props, target, key, value, options) {
  target.addEventListener(key, value, options);
  this.save([target, key, value, options]);
  this.cleanup(cleanEventListener);
};

function cleanEventListener([target, key, value, options]) {
  target.removeEventListener(key, value, options);
}
