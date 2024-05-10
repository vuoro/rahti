import { Component } from "../rahti/component.js";
import { Buffer } from "./buffer.js";

export const Elements = new Proxy(function ({ context, data }) {
  return Buffer({
    context,
    data,
    binding: "ELEMENT_ARRAY_BUFFER",
    types: ["UNSIGNED_SHORT", "int"],
  });
}, Component);
