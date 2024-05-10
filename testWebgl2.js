import { update } from "./rahti/component";
import { EventListener } from "./rahti/dom";
import { State } from "./rahti/state";
import { AnimationFrame } from "./webgl2/animationFrame";

export const Webgl2App = function ({
  smallTexture,
  QuadInstance,
  cameraController,
  frame,
  clear,
  drawTriangle,
  drawQuads,
}) {
  <EventListener
    type="pointermove"
    listener={({ x, y }) => {
      cameraController.target[0] = -x * 0.001;
      cameraController.target[1] = y * 0.001;
    }}
  >
    {document}
  </EventListener>;

  <TriangleUpdater>{smallTexture}</TriangleUpdater>;
  <QuadUpdater QuadInstance={QuadInstance} />;

  frame(() => {
    clear();
    drawTriangle();
    drawQuads();
  });
};

const TriangleUpdater = function (props, smallTexture) {
  <AnimationFrame />;
  smallTexture.update(
    Uint8Array.of(Math.random() * 255, Math.random() * 255, Math.random() * 255, 255),
    Math.random() * 64,
    Math.random() * 64
  );
};

const QuadUpdater = function ({ QuadInstance }) {
  // const [max, setMax] = <State>{100}</State>;
  // this.save(setTimeout(setMax, Math.random() * 2000, 100 * (0.5 + Math.random() * 0.5)));
  // this.cleanup(cleanTimer);

  const max = 100 * (0.5 + Math.random() * 0.5);
  // <AnimationFrame />;

  for (let index = 0; index < max; index++) {
    if (Math.random() < 0.1) continue;
    <Quad key={index} QuadInstance={QuadInstance} />;
  }
};

const cleanTimer = (timer) => clearTimeout(timer);

const Quad = function ({ key, QuadInstance }) {
  // const [_, setState] = <State />;
  // this.save(setTimeout(setState, Math.random() * 2000, Math.random()));
  // this.cleanup(cleanTimer);

  <AnimationFrame />;

  const data =
    this.load() ||
    this.save({
      offset: Float32Array.of(-key * 0.02, -key * 0.02),
      color: Float32Array.of(Math.random(), Math.random(), Math.random()),
    });

  data.offset[0] += (Math.random() * 2 - 1) * 0.003;
  data.offset[1] += (Math.random() * 2 - 1) * 0.003;

  const quadInstance = <QuadInstance>{data}</QuadInstance>;
};
