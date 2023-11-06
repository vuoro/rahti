import { cancelPreRenderJob, requestPreRenderJob } from "./animationFrame.js";
import { dataToTypes } from "./buffer.js";

export const UniformBlock = function ({ context, uniforms: uniformMap }) {
  const { gl, setBuffer, requestRendering } = context;

  const offsets = new Map();
  const bindIndex = context.uniformBindIndexCounter++;

  const buffer = gl.createBuffer();
  setBuffer(buffer, gl.UNIFORM_BUFFER);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, bindIndex, buffer);

  let byteCounter = 0;
  let elementCounter = 0;

  const uniforms = {};

  for (const key in uniformMap) {
    const value = uniformMap[key];

    const [, shaderType] = dataToTypes(value);
    const elementCount = value.length || 1;

    // std140 alignment rules
    const [alignment, size] =
      elementCount === 1 ? [1, 1] : elementCount === 2 ? [2, 2] : [4, elementCount];

    // std140 alignment padding
    // | a |...|...|...|b.x|b.y|b.z|b.w| c | d |...|...|
    const padding = (alignment - (elementCounter % alignment)) % alignment;
    elementCounter += padding;
    byteCounter += padding * 4;

    let data;
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      data = value;
    } else {
      data = [value];
    }

    const uniform = {
      shaderType,
      padding,
      size,
      byteOffset: byteCounter,
      elementOffset: elementCounter,
      data,
    };

    uniforms[key] = uniform;
    offsets.set(key, uniform.elementOffset);

    elementCounter += size;
    byteCounter += size * 4;
  }

  const endPadding = (4 - (elementCounter % 4)) % 4;
  elementCounter += endPadding;

  const allData = new Float32Array(elementCounter);
  const { BYTES_PER_ELEMENT } = allData;

  for (const key in uniforms) {
    const { data, elementOffset } = uniforms[key];
    allData.set(data, elementOffset);
  }

  gl.bufferData(gl.UNIFORM_BUFFER, allData, gl.DYNAMIC_DRAW);

  let firstDirty = Infinity;
  let lastDirty = 0;

  const update = (key, data) => {
    if (dead) return;

    const length = data.length || 1;
    const offset = offsets.get(key);

    firstDirty = Math.min(offset, firstDirty);
    lastDirty = Math.max(offset + length, lastDirty);

    if (data.length) {
      allData.set(data, offset);
    } else {
      allData[offset] = data;
    }

    requestPreRenderJob(commitUpdate);
  };

  const { UNIFORM_BUFFER } = gl;

  const commitUpdate = () => {
    if (dead) return;

    setBuffer(buffer, UNIFORM_BUFFER);
    gl.bufferSubData(
      UNIFORM_BUFFER,
      firstDirty * BYTES_PER_ELEMENT,
      allData,
      firstDirty,
      lastDirty - firstDirty,
    );

    firstDirty = Infinity;
    lastDirty = 0;

    requestRendering();
  };

  let dead = false;

  this.cleanup(() => {
    dead = true;
    cancelPreRenderJob(commitUpdate);
    gl.deleteBuffer(buffer);
  });

  return { uniforms, update, bindIndex };
};
