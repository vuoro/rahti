import htm from "htm";

import { component, cleanup } from "./component.js";

export const mount = component(function mount(element, ...children) {
  processChildren(children, element, this);
  return element;
});

const catchDom = function () {
  return arguments;
};
const parseDom = htm.bind(catchDom);

export const html = component(function html() {
  const results = parseDom.apply(catchDom, arguments);
  return handleDom(this, results, false);
});

export const svg = component(function svg() {
  const results = parseDom.apply(catchDom, arguments);
  return handleDom(this, results, true);
});

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
          event(instance, key)(key, value[key], element);
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

const domElement = component(function element(tagName, isSvg) {
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);

  cleanup(this, () => element.remove());

  return element;
});

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
  cleanup(this, () => node.remove());
  return node;
});

const slot = component(function slot(child, parent, index) {
  if (index >= parent.children.length) {
    parent.appendChild(child);
  } else {
    parent.insertBefore(child, parent.children[index]);
  }
});

const cleaners = new Map();

const style = component(function style(value, element) {
  element.style.cssText = value;

  let cleaner = cleaners.get(this);
  if (!cleaner) {
    cleaner = (isFinal) => {
      if (isFinal) {
        element.style.cssText = "";
        cleaners.delete(this);
      }
    };
  }
  cleanup(this, cleaner);
});

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

  let cleaner = cleaners.get(this);
  if (!cleaner) {
    cleaner = (isFinal) => {
      if (isFinal) {
        element.removeAttribute(key);
        cleaners.delete(this);
      }
    };
  }
  cleanup(this, cleaner);
});

const event = component(function event(key, value, element) {
  if (Array.isArray(value)) {
    element.addEventListener(key, value[0], value[1]);
    cleanup(this, () => element.removeEventListener(key, value[0]));
  } else {
    element.addEventListener(key, value);
    cleanup(this, () => element.removeEventListener(key, value));
  }
});
