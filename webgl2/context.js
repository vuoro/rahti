import { update } from "./../rahti/rahti.js";
import { cancelJobsAndStopFrame, requestRenderJob } from "./animationFrame.js";

const defaultAttributes = {
  antialias: false,
  alpha: true,
};

const defaultHints = {
  FRAGMENT_SHADER_DERIVATIVE_HINT: "NICEST",
};

export const Context = function ({
  canvas,
  attributes: inputAttributes,
  hints: inputHints,
  clearColor = [0, 0, 0, 1],
  pixelRatio = 1,
  debug = false,
  drawingBufferColorSpace = "display-p3",
  unpackColorSpace = drawingBufferColorSpace,
}) {
  if (!canvas || !(canvas instanceof Node)) throw new Error("Missing canvas");

  const attributes = { ...defaultAttributes, ...inputAttributes };

  const gl = canvas.getContext("webgl2", attributes);
  if ("drawingBufferColorSpace" in gl) gl.drawingBufferColorSpace = drawingBufferColorSpace;
  if ("unpackColorSpace" in gl) gl.unpackColorSpace = unpackColorSpace;
  const textureIndexes = new Map();

  // Hints
  const hints = { ...defaultHints, ...inputHints };
  for (const target in hints) {
    const mode = hints[target];
    gl.hint(gl[target], gl[mode]);
  }

  // Caches and setters
  let currentProgram = null;
  let currentVao = null;
  let currentBuffer = null;
  let currentTexture = null;
  let currentFramebuffer = null;
  let currentDepth = null;
  let currentCull = null;
  let currentBlend = null;

  const setProgram = (program) => {
    if (currentProgram !== program) {
      gl.useProgram(program);
      currentProgram = program;
    }
  };
  const setVao = (vao = null) => {
    if (currentVao !== vao) {
      gl.bindVertexArray(vao);
      currentVao = vao;
    }
  };
  const setBuffer = (buffer, type = gl.ARRAY_BUFFER) => {
    if (currentBuffer !== buffer) {
      gl.bindBuffer(type, buffer);
      currentBuffer = buffer;
    }
  };
  const setDepth = (depth) => {
    if (currentDepth !== depth) {
      if (depth) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl[depth]);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }
      currentDepth = depth;
    }
  };
  const setCull = (cull) => {
    if (currentCull !== cull) {
      if (cull) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl[cull]);
      } else {
        gl.disable(gl.CULL_FACE);
      }
      currentCull = cull;
    }
  };

  const setBlend = (sourceFactor, destinationFactor) => {
    if (currentBlend !== sourceFactor + destinationFactor) {
      if (sourceFactor && destinationFactor) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl[sourceFactor], gl[destinationFactor]);
      } else {
        gl.disable(gl.BLEND);
      }
      currentBlend = sourceFactor + destinationFactor;
    }
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  const setTexture = (texture, TARGET = gl.TEXTURE_2D) => {
    if (currentTexture !== texture) {
      if (!textureIndexes.has(texture)) {
        textureIndexes.set(texture, textureIndexes.size);
      }

      const index = textureIndexes.get(texture);
      gl.activeTexture(gl[`TEXTURE${index}`]);
      gl.bindTexture(TARGET, texture);
    }

    currentTexture = texture;
  };

  const setFramebuffer = (framebuffer) => {
    if (currentFramebuffer !== framebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      currentFramebuffer = framebuffer;
    }
  };

  // Clearing
  let lastDepth = 1;
  const setClear = (color = clearColor, depth = lastDepth) => {
    color.forEach((value, index) => {
      clearColor[index] = value;
    });
    gl.clearColor(...clearColor);
    if (lastDepth.current !== depth) {
      gl.clearDepth(depth);
      lastDepth = depth;
    }
  };
  setClear();
  const clear = (value = 16640) => {
    gl.clear(value);
  };

  let currentPixelRatio = pixelRatio;
  let width = canvas.offsetWidth;
  let height = canvas.offsetHeight;

  const resizeSubscribers = new Set();
  const subscribe = (subscriber) => {
    resizeSubscribers.add(subscriber);
    subscriber(0, 0, width, height, pixelRatio);
  };
  const unsubscribe = (subscriber) => resizeSubscribers.delete(subscriber);

  const resize = (pixelRatio = currentPixelRatio) => {
    currentPixelRatio = pixelRatio;

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    for (const subscriber of resizeSubscribers) {
      subscriber(0, 0, width, height, pixelRatio);
    }

    requestRendering();
  };

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];

    if (entry.devicePixelContentBoxSize) {
      width = entry.devicePixelContentBoxSize[0].inlineSize;
      height = entry.devicePixelContentBoxSize[0].blockSize;
    } else if (entry.contentBoxSize) {
      // Annoying fallback. Assumes window.devicePixelRatio includes browser zoom.
      // Currently that's how it works in Chrome, but not in Safari.
      // As a result current Safari will end up with the wrong size if browser zoom is in use.
      width = Math.round(entry.contentBoxSize[0].inlineSize * window.devicePixelRatio);
      height = Math.round(entry.contentBoxSize[0].blockSize * window.devicePixelRatio);
    }

    resize();
  });

  try {
    observer.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    observer.observe(canvas);
  }

  const instance = this;

  const handleLost = (event) => {
    console.log("context lost");
    event.preventDefault();
    stopped = true;
    cancelJobsAndStopFrame();
  };
  const handleRestored = () => {
    console.log("restoring context");
    update(instance);
  };

  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);

  this.cleanup(() => {
    stopped = true;
    cancelJobsAndStopFrame();
    observer.disconnect();
    canvas.removeEventListener("webglcontextlost", handleLost);
    canvas.removeEventListener("webglcontextrestored", handleRestored);
  });

  let renderFunction;
  let stopped = false;
  const frame = (renderPass) => {
    renderFunction = renderPass;
    requestRendering();
  };
  const executeRender = (timestamp, sinceLastFrame, frameNumber) => {
    if (renderFunction && !stopped) renderFunction(timestamp, sinceLastFrame, frameNumber);
  };

  const requestRendering = () => {
    requestRenderJob(executeRender);
  };

  return {
    gl,
    setProgram,
    setVao,
    setBuffer,
    setDepth,
    setCull,
    setBlend,
    setTexture,
    textureIndexes,
    setFramebuffer,
    setClear,
    clear,
    subscribe,
    unsubscribe,
    resize,
    uniformBindIndexCounter: 0,
    frame,
    requestRendering,
    debug,
  };
};
