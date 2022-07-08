import htm from "htm";

import { component } from "./component.js";

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
          eventHandler(instance, key)(element, key, value[key]);
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
const nodeCleanup = function (isFinal) {
  if (isFinal) {
    nodes.get(this).remove();
    nodes.delete(this);
  }
};

const domElement = component(function element(tagName, isSvg) {
  let element = nodes.get(this);

  if (!element) {
    element = isSvg
      ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
      : document.createElement(tagName);
    nodes.set(this, element);
  }

  return element;
}, nodeCleanup);

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
  let node = nodes.get(this);

  if (!node) {
    node = new Text();
    nodes.set(this, node);
  }

  return node;
}, nodeCleanup);

const slot = component(function slot(child, parent, index) {
  if (index >= parent.children.length) {
    parent.appendChild(child);
  } else {
    parent.insertBefore(child, parent.children[index]);
  }
});

const style = component(
  function style(value, element) {
    element.style.cssText = value;
    nodes.set(this, element);
  },
  function (isFinal) {
    if (isFinal) {
      nodes.get(this).style.cssText = "";
      nodes.delete(this);
    }
  }
);

const attributeKeys = new Map();

const attribute = component(
  function attribute(key, value, element) {
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
    attributeKeys.set(this, element);
  },
  function (isFinal) {
    if (isFinal) {
      nodes.get(this).removeAttribute(attributeKeys.get(this));
      nodes.delete(this);
      attributeKeys.delete(this);
    }
  }
);

const eventKeys = new Map();
const eventValues = new Map();

export const eventHandler = component(
  function eventHandler(element, key, value) {
    if (Array.isArray(value)) {
      element.addEventListener(key, value[0], value[1]);
    } else {
      element.addEventListener(key, value);
    }

    nodes.set(this, element);
    eventKeys.set(this, key);
    eventValues.set(this, value);
  },
  function (isFinal) {
    const key = eventKeys.get(this);
    const value = eventValues.get(this);
    const node = nodes.get(this);

    if (Array.isArray(value)) {
      node.removeEventListener(key, value[0], value[1]);
    } else {
      node.removeEventListener(key, value);
    }

    if (isFinal) {
      nodes.delete(this);
      eventKeys.delete(this);
      eventValues.delete(this);
    }
  }
);
