import htm from "htm";

import { component, cleanup } from "./component.js";

export const mount = component(function mount(element, ...children) {
  processChildren(children, element, this);
  return element;
});

const catchDom = function () {
  return arguments;
};

export const html = (instance) => {
  nextHtml = instance;
  return htmlApplier;
};
let nextHtml = null;
const htmlApplier = function () {
  const results = htm.apply(catchDom, arguments);
  const instance = nextHtml;
  nextHtml = null;
  return handleDom(instance, results, false);
};

export const svg = (instance) => {
  nextSvg = instance;
  return svgApplier;
};
let nextSvg = null;
const svgApplier = function () {
  const results = htm.apply(catchDom, arguments);
  const instance = nextSvg;
  nextSvg = null;
  return handleDom(instance, results, true);
};

const handleDom = function (instance, results, isSvg) {
  const hasMany = Array.isArray(results);

  if (hasMany) {
    const resultsBin = [];

    for (const result of results) {
      if (typeof result === "object") resultsBin.push(processDom(instance, result, isSvg));
    }

    return resultsBin;
  } else {
    return processDom(instance, results, isSvg);
  }
};

const processDom = function (instance, result, isSvg) {
  const type = result[0];
  const props = result[1];

  const element = domElement(instance)(type, isSvg);

  if (props) {
    for (const key in props) {
      const value = props[key];

      if (key === "style") {
        // inline style
        style(instance)(value, element);
      } else if (key === "events") {
        // events object
        for (const key in value) {
          const eventValue = value[key];
          if (Array.isArray(eventValue)) {
            eventListener(instance, key)(element, key, ...eventValue);
          } else {
            eventListener(instance, key)(element, key, eventValue);
          }
        }
      } else {
        // attribute
        attribute(instance, key)(key, value, element);
      }
    }
  }

  if (result.length > 2) processChildren(result, element, instance, 0, 2, isSvg);

  return element;
};

const nodes = new Map();

const domElement = component(function element(tagName, isSvg) {
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);

  nodes.set(this, element);
  cleanup(this, cleanNode);

  return element;
});

function cleanNode() {
  nodes.get(this).remove();
  nodes.delete(this);
}

const processChildren = (children, element, instance, slotIndex = 0, startIndex = 0, isSvg) => {
  for (let index = startIndex, { length } = children; index < length; index++) {
    const child = children[index];

    if (child instanceof Node) {
      // it's already an element of some kind, so let's just mount it
      slot(instance, child)(child, element, slotIndex++);
    } else if (Array.isArray(child)) {
      // treat as a list of grandchildren
      slotIndex = processChildren(child, element, instance, slotIndex);
    } else if (typeof child === "object" && child?.length) {
      // treat as list DOM children
      const childElement = processDom(instance, child, isSvg);
      slot(instance, childElement)(childElement, element, slotIndex++);
    } else {
      // treat as Text
      const textNode = text(instance)();
      textNode.nodeValue = child;
      slot(instance, textNode)(textNode, element, slotIndex++);
    }
  }

  return slotIndex;
};

const text = component(function text() {
  const node = new Text();
  nodes.set(this, node);
  cleanup(this, cleanNode);
  return node;
});

const slot = component(function slot(child, parent, index) {
  if (index >= parent.children.length) {
    parent.appendChild(child);
  } else {
    parent.insertBefore(child, parent.children[index]);
  }
});

const style = component(function style(value, element) {
  element.style.cssText = value;

  nodes.set(this, element);
  cleanup(this, cleanStyle);
});

function cleanStyle(isFinal) {
  if (isFinal) {
    nodes.get(this).style.cssText = "";
    nodes.delete(this);
  }
}

const attribute = component(function attribute(key, value, element) {
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
});

const attributeKeys = new Map();

function cleanAttribute(isFinal) {
  if (isFinal) {
    nodes.get(this).removeAttribute(attributeKeys.get(this));
    nodes.delete(this);
    attributeKeys.delete(this);
  }
}

export const eventListener = component(function eventListener(target, key, value, options) {
  target.addEventListener(key, value, options);

  nodes.set(this, target);
  eventKeys.set(this, key);
  eventValues.set(this, value);
  eventOptions.set(this, options);

  cleanup(this, cleanEventListener);
});

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
