import { Buffer } from "./buffer.js";

export const Elements = function ({ context, data }) {
  return this.run(Buffer, {
    context,
    data,
    binding: "ELEMENT_ARRAY_BUFFER",
    types: ["UNSIGNED_SHORT", "int"],
  });
};
