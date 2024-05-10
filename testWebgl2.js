import { Component, load, save, update } from "./rahti/component";
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

  QuadUpdater(QuadInstance);

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

const QuadUpdater = new Proxy(function (QuadInstance) {
  // const [max, setMax] = <State>{100}</State>;
  // save(setTimeout(setMax, Math.random() * 2000, 100 * (0.5 + Math.random() * 0.5)));
  // cleanup(cleanTimer);

  const max = 100 * (0.5 + Math.random() * 0.5);
  // <AnimationFrame />;

  for (let index = 0; index < max; index++) {
    if (Math.random() < 0.1) continue;
    Quad(index, QuadInstance);
  }
}, Component);

const cleanTimer = (timer) => clearTimeout(timer);

const Quad = new Proxy(function (index, QuadInstance) {
  // const [_, setState] = <State />;
  // save(setTimeout(setState, Math.random() * 2000, Math.random()));
  // cleanup(cleanTimer);

  AnimationFrame();

  const data =
    load() ||
    save({
      offset: Float32Array.of(-index * 0.02, -index * 0.02),
      color: Float32Array.of(Math.random(), Math.random(), Math.random()),
    });

  data.offset[0] += (Math.random() * 2 - 1) * 0.003;
  data.offset[1] += (Math.random() * 2 - 1) * 0.003;

  QuadInstance(data);
}, Component);
