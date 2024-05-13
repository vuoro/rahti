import { Component, cleanup, load, save, update } from "./rahti/component";
import { EventListener } from "./rahti/dom";
import { State } from "./rahti/state";
import { AnimationFrame } from "./webgl2/animationFrame";

export const Webgl2App = new Proxy(function ({
  smallTexture,
  QuadInstance,
  cameraController,
  frame,
  clear,
  drawTriangle,
  drawQuads,
}) {
  EventListener(document, "pointermove", ({ x, y }) => {
    cameraController.target[0] = -x * 0.001;
    cameraController.target[1] = y * 0.001;
  });
  TriangleUpdater(smallTexture);

  Quads(QuadInstance);

  frame(() => {
    clear();
    drawTriangle();
    drawQuads();
  });
}, Component);

const TriangleUpdater = new Proxy(function (smallTexture) {
  AnimationFrame();
  smallTexture.update(
    Uint8Array.of(Math.random() * 255, Math.random() * 255, Math.random() * 255, 255),
    Math.random() * 64,
    Math.random() * 64,
  );
}, Component);

const Quads = new Proxy(function (QuadInstance) {
  const [max, setMax] = State(100);
  save(setTimeout(setMax, Math.random() * 2000, 100 * (0.5 + Math.random() * 0.5)));
  cleanup(cleanTimer);

  // const max = 100 * (0.5 + Math.random() * 0.5);
  // AnimationFrame();

  for (let index = 0; index < max; index++) {
    if (Math.random() < 0.01) continue;
    Quad(index, QuadInstance);
  }
}, Component);

const cleanTimer = (timer) => clearTimeout(timer);

const Quad = new Proxy(
  function (index, QuadInstance) {
    const instance = QuadInstance();
    instance.offset[0] = -index * 0.02;
    instance.offset[1] = -index * 0.02;
    instance.color[0] = Math.random();
    instance.color[1] = Math.random();
    instance.color[2] = Math.random();

    QuadUpdater(instance);
  },
  { ...Component, getKey: (index) => index },
);

const QuadUpdater = new Proxy(function (instance) {
  AnimationFrame();
  instance.offset[0] += (Math.random() * 2 - 1) * 0.003;
  instance.offset[1] += (Math.random() * 2 - 1) * 0.003;
}, Component);
