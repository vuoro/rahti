import { cleanup } from "./component.js";

export const mount = function (element, ...children) {
  processArguments(children, element, this);
  return element;
};

const domCodes = new Map();

export const getDomCode = function (tagName) {
  let code = domCodes.get(tagName);

  if (!code) {
    code = createDomCode(tagName);
    domCodes.set(tagName, code);
  }

  return code;
};

const createDomCode = (tagName) => {
  const code = async function () {
    const el = await this(element)(tagName);
    processArguments(arguments, el, this);
    return el;
  };

  Object.defineProperty(code, "name", { value: tagName, configurable: true });

  return code;
};

const element = function (tagName) {
  const isSvg = svgSet.has(tagName);
  const element = isSvg
    ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
    : document.createElement(tagName);

  cleanup(this).then(() => element.remove());

  return element;
};

const { iterator } = Symbol;

const processArguments = async (args, element, component, startIndex = 0) => {
  let slotIndex = startIndex;

  for (let index = 0; index < args.length; index++) {
    const argument = await args[index];
    const type = typeof argument;

    if (argument instanceof Node) {
      // it's an element
      component(slot, argument)(argument, element, slotIndex++);
    } else if (argument && type === "object") {
      if (iterator in argument) {
        // treat as a list of arguments
        slotIndex = processArguments(argument, element, component, slotIndex);
      } else {
        for (const key in argument) {
          const value = argument[key];

          if (key === "style") {
            // inline style
            component(style)(value, element);
          } else if (key === "events") {
            // events object
            for (const key in value) {
              component(event, key)(key, value[key], element);
            }
          } else {
            // attribute
            component(attribute, key)(key, value, element);
          }
        }
      }
    } else {
      // treat as Text
      const textNode = await component(text)();
      textNode.nodeValue = argument;
      component(slot, textNode)(textNode, element, slotIndex++);
    }
  }

  return slotIndex;
};

const text = function () {
  const node = new Text();
  cleanup(this).then(() => node.remove());
  return node;
};

const slot = function (child, parent, index) {
  if (index >= parent.children.length) {
    parent.appendChild(child);
  } else {
    parent.insertBefore(child, parent.children[index]);
  }
};

const style = function (value, element) {
  element.style.cssText = value;
  cleanup(this).then((isFinal) => {
    if (isFinal) element.style.cssText = "";
  });
};

const attribute = function (key, value, element) {
  element.setAttribute(key, typeof value === "boolean" ? key : value);
  cleanup(this).then((isFinal) => {
    if (isFinal) element.removeAttribute(key);
  });
};

const event = function (key, value, element) {
  if (Array.isArray(value)) {
    element.addEventListener(key, value[0], value[1]);
    cleanup(this).then(() => element.removeEventListener(key, value[0]));
  } else {
    element.addEventListener(key, value);
    cleanup(this).then(() => element.removeEventListener(key, value));
  }
};

const svgSet = new Set([
  "animate",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "discard",
  "mpath",
  "set",
  "circle",
  "ellipse",
  "line",
  "polygon",
  "polyline",
  "rect",
  "a",
  "defs",
  "g",
  "marker",
  "mask",
  "missing-glyph",
  "pattern",
  "svg",
  "switch",
  "symbol",
  "desc",
  "metadata",
  "title",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "feSpecularLighting",
  "feTile",
  "feTurbulence",
  "font",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "hkern",
  "vkern",
  "linearGradient",
  "radialGradient",
  "stop",
  "image",
  "path",
  "text",
  "use",
  "feDistantLight",
  "fePointLight",
  "feSpotLight",
  "clipPath",
  "hatch",
  "script",
  "style",
  "solidcolor",
  "foreignObject",
  "textPath",
  "tspan",
]);
