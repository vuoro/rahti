import { component, cleanup } from "./component.js";

export const mount = component(function mount(element, ...children) {
  processArguments(children, element, this);
  return element;
});

const domComponents = new Map();

const proxyHandler = {
  get(target, tagName) {
    let domComponent = domComponents.get(tagName);
    if (!domComponent) {
      domComponent = function () {
        const el = element(this, tagName, target.isSvg);
        processArguments(arguments, el, this);
        return el;
      };

      Object.defineProperty(domComponent, "name", { value: tagName, configurable: true });

      domComponent = component(domComponent);
      Object.defineProperty(domComponent, "name", {
        value: `apply_${tagName}`,
        configurable: true,
      });
      domComponents.set(domComponent);
    }

    return domComponent;
  },
};

export const html = new Proxy({}, proxyHandler);
export const svg = new Proxy({ isSvg: true }, proxyHandler);

const element = component(function element(tagName, isSvg) {
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);

  cleanup(this, () => element.remove());
  return element;
});

const { iterator } = Symbol;

const processArguments = (args, element, component, startIndex = 0) => {
  let slotIndex = startIndex;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const type = typeof argument;

    if (argument instanceof Node) {
      // it's an element
      slot(argument, component, argument, element, slotIndex++);
    } else if (argument && type === "object") {
      if (iterator in argument) {
        // treat as a list of arguments
        slotIndex = processArguments(argument, element, component, slotIndex);
      } else {
        for (const key in argument) {
          const value = argument[key];

          if (key === "style") {
            // inline style
            style(component, value, element);
          } else if (key === "events") {
            // events object
            for (const key in value) {
              event(component, key, value[key], element);
            }
          } else {
            // attribute
            attribute(key, component, key, value, element);
          }
        }
      }
    } else {
      // treat as Text
      const textNode = text(component);
      textNode.nodeValue = argument;
      slot(textNode, component, textNode, element, slotIndex++);
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

const style = component(function style(value, element) {
  element.style.cssText = value;
  cleanup(this, (isFinal) => {
    if (isFinal) element.style.cssText = "";
  });
});

const attribute = component(function attribute(key, value, element) {
  element.setAttribute(key, typeof value === "boolean" ? key : value);
  cleanup(this, (isFinal) => {
    if (isFinal) element.removeAttribute(key);
  });
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
