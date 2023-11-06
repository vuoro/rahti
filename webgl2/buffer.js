import { requestPreRenderJob } from "./animationFrame.js";

export const Buffer = function ({
  context,
  data,
  binding = "ARRAY_BUFFER",
  usage = "STATIC_DRAW",
  types = dataToTypes(data[0]),
}) {
  const { gl, setBuffer, requestRendering } = context;
  const BINDING = gl[binding];

  const [bufferType, shaderType] = types;
  const Constructor = bufferTypeToConstructor(bufferType);

  const buffer = gl.createBuffer();
  setBuffer(buffer, BINDING);

  const dimensions = data[0].length || 1;
  let allData = new Constructor(data.length * dimensions);

  for (let index = 0; index < data.length; index++) {
    const datum = data[index];

    if (dimensions > 1) {
      allData.set(datum, index * dimensions);
    } else {
      allData[index] = datum;
    }
  }

  const { BYTES_PER_ELEMENT } = allData;
  const count = data.length;
  const USAGE = gl[usage];

  const countSubscribers = new Set();

  const bufferObject = {
    allData,
    buffer,
    bufferType,
    shaderType,
    Constructor,
    count,
    dimensions,
    countSubscribers,
  };

  let firstDirty = Infinity;
  let lastDirty = 0;
  let shouldSet = true;

  const set = (data = allData) => {
    if (dead) return;

    allData = data;
    bufferObject.allData = allData;
    bufferObject.count = allData.length / dimensions;

    for (const subscriber of countSubscribers) {
      subscriber(bufferObject.count);
    }

    shouldSet = true;
    requestPreRenderJob(commitUpdates);
  };

  requestPreRenderJob(set);

  const update = function (data, offset) {
    if (dead) return;

    const length = data?.length;

    firstDirty = Math.min(offset, firstDirty);
    lastDirty = Math.max(offset + length, lastDirty);

    if (length) {
      allData.set(data, offset);
    } else {
      allData[offset] = data;
    }

    requestPreRenderJob(commitUpdates);
  };

  const commitUpdates = function () {
    if (dead) return;

    setBuffer(buffer, BINDING);

    if (shouldSet) {
      // console.log("set", bufferObject.count);
      gl.bufferData(BINDING, allData, USAGE);
      shouldSet = false;
    } else {
      // console.log("update", allData.length, firstDirty, lastDirty);
      gl.bufferSubData(
        BINDING,
        firstDirty * BYTES_PER_ELEMENT,
        allData,
        firstDirty,
        lastDirty - firstDirty,
      );
    }

    firstDirty = Infinity;
    lastDirty = 0;

    requestRendering();
  };

  bufferObject.set = set;
  bufferObject.update = update;

  let dead = false;

  this.cleanup(() => {
    dead = true;
    gl.deleteBuffer(buffer);
  });

  return bufferObject;
};

export const dataToTypes = (data) => {
  if (typeof data === "number") {
    return ["FLOAT", "float"];
  }

  if (typeof data === "boolean") {
    return ["BYTE", "bool"];
  }

  if (Array.isArray(data)) {
    return ["FLOAT", data.length > 4 ? `mat${Math.sqrt(data.length)}` : `vec${data.length}`];
  }

  switch (data.constructor.name) {
    case "Float32Array":
      return ["FLOAT", data.length > 4 ? `mat${Math.sqrt(data.length)}` : `vec${data.length}`];
    case "Int8Array":
      return ["BYTE", `ivec${data.length}`];
    case "Uint8Array":
    case "Uint8ClampedArray":
      return ["UNSIGNED_BYTE", `uvec${data.length}`];
    case "Int16Array":
      return ["SHORT", `ivec${data.length}`];
    case "Uint16Array":
      return ["UNSIGNED_SHORT", `uvec${data.length}`];
    default:
      throw new Error("Finding types failed");
  }
};

export const bufferTypeToConstructor = (type) => {
  switch (type) {
    case "BYTE":
      return Int8Array;
    case "UNSIGNED_BYTE":
      return Uint8Array;
    case "SHORT":
      return Int16Array;
    case "UNSIGNED_SHORT":
      return Uint16Array;
    default:
      return Float32Array;
  }
};
