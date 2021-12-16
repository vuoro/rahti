export const isServer = import.meta?.env?.SSR || typeof window === "undefined";
export const ssrIdentifier = "__vuoro_rahti__";
export class ServerElement {
  constructor(tagName) {
    if (!tagName) {
      this.isFragment = true;
    } else {
      this.tagName = tagName;
    }

    this.isServerElement = true; // for some reason instanceof randomly fails
    this.style = {};
    this.attributes = new Map();
    this.children = new Set();
  }

  append(child) {
    if (child.isFragment) {
      for (const grandChild of child.children) {
        this.append(grandChild);
      }
      child.children.clear();
    } else {
      this.children.add(child);
    }
  }
  replaceChildren(fromElement) {
    this.children.clear();

    if (fromElement.isFragment) {
      for (const child of fromElement.children) {
        this.append(child);
      }
      fromElement.children.clear();
    } else {
      this.append(fromElement);
    }
  }

  getAttribute(key) {
    this.attributes.get(key);
  }
  setAttribute(key, value) {
    this.attributes.set(key, key === value ? true : value);
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }

  addEventListener() {}
  removeEventListener() {}

  toString() {
    let result = "";

    if (!this.isFragment) {
      result += `<${this.tagName}`;

      for (const [key, value] of this.attributes) {
        result += ` ${key}`;
        if (typeof value !== "boolean") result += `="${value}"`;
      }

      if (this.style.cssText) result += ` style="${this.style.cssText}"`;

      let childHtml = "";
      for (const child of this.children) {
        if (result.isServerElement || typeof result === "string" || typeof result === "number") {
          childHtml += child;
        }
      }

      if (childHtml) {
        result += `>${childHtml}</${this.tagName}>`;
      } else {
        result += "/>";
      }
    }

    return result;
  }
}
