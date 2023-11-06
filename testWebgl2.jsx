import { update } from "./rahti/component";
import { EventListener } from "./rahti/dom";
import { State } from "./rahti/state";
import { useAnimationFrame } from "./webgl2/animationFrame";

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

  console.log("It works?");

  <TriangleUpdater>{smallTexture}</TriangleUpdater>;
  <QuadUpdater QuadInstance={QuadInstance} />;

  frame(() => {
    clear();
    drawTriangle();
    drawQuads();
  });
};

const TriangleUpdater = function (props, smallTexture) {
  useAnimationFrame(this);
  smallTexture.update(
    Uint8Array.of(Math.random() * 255, Math.random() * 255, Math.random() * 255, 255),
    Math.random() * 64,
    Math.random() * 64,
  );
};

const QuadUpdater = function ({ QuadInstance }) {
  const [max, setMax] = <State>{100}</State>;
  this.save(setTimeout(setMax, Math.random() * 2000, 100 * (0.5 + Math.random() * 0.5)));
  this.cleanup(cleanQuadUpdater);

  for (let index = 0; index < max; index++) {
    if (Math.random() < 0.2) continue;
    <Quad key={index} QuadInstance={QuadInstance} />;
  }
};

const cleanQuadUpdater = (timer) => clearTimeout(timer);

const Quad = function ({ key, QuadInstance }) {
  const [_, setState] = <State />;
  setTimeout(setState, Math.random() * 2000, Math.random());

  const data =
    this.load() ||
    this.save({
      offset: Float32Array.of(-key * 0.02, -key * 0.02),
      color: new Float32Array(3),
    });

  const quad = <QuadInstance>{data}</QuadInstance>;

  data.color[0] = 0.236 + Math.random() * 0.236;
  data.color[1] = 0.236 + Math.random() * 0.236;
  data.color[2] = 0.236 + Math.random() * 0.236;
  update(quad);
};
