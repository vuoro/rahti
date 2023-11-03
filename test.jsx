import {
  rahti,
  idle,
  createGlobalState,
  State,
  Mount,
  Event,
  EventListener,
  update,
} from "./rahti/rahti.js";
import {
  Context,
  UniformBlock,
  Attribute,
  Elements,
  Instances,
  Command,
  Texture,
  Camera,
  useAnimationFrame,
} from "./webgl2/webgl2.js";

const [GlobalTest, setGlobalTest, getGlobalTest] = createGlobalState({ initialValue: 0 });
setInterval(() => setGlobalTest(getGlobalTest() + 1), 5000);

const TestWrapper = async function () {
  <GlobalTest />;
  const [counter, setState] = <State initialValue={0} />;
  const timer = setTimeout(setState, 1000, counter + 1);
  this.cleanup(() => console.log("cleaning timer", timer));
  this.cleanup(() => clearTimeout(timer));

  let deadline = await idle();

  const testComponents = [];
  const max = 20;
  for (let index = 0; index < (0.5 + Math.random() * 0.5) * max; index++) {
    if (deadline.timeRemaining() <= 0) deadline = await idle();
    try {
      if (Math.random() > 0.1)
        testComponents.push(
          await (
            <TestItem counter={counter} index={testComponents.length} key={testComponents.length} />
          ),
        );
    } catch (e) {}
  }

  return (
    <>
      <p style="color: red">
        Something is wrong if: a) there's ever <em>consistently</em> over {max} items here, b){" "}
        <em>every</em> element is flashing red on updates.
      </p>
      <style>
        {`
          * {
            animation: enter 1000ms ease-out;
            outline: 2px solid transparent;
          }

          @keyframes enter {
            0% { outline-color: rgba(255,0,0, 0.618) }
            100% { outline-color: transparent; }
          }
        `}
      </style>
      <ol class="lol">
        <Event type="click" listener={console.log} />
        {testComponents}
      </ol>
    </>
  );
};

const TestItem = async function ({ counter, index }) {
  const [local, setLocal] = <State initialValue={0} />;
  const [global] = <GlobalTest />;

  const timer = setTimeout(setLocal, 200 + Math.random() * 5000, Math.random());
  this.cleanup(() => clearTimeout(timer));
  if (Math.random() < 0.05) throw new Error();

  await idle();

  return (
    <li>
      {index + 1}
      <input type="checkbox" checked={local > 0.5} /> Parent: {counter} / Global: {global} / Local:{" "}
      {local}
      <Event type="click" listener={(...args) => console.log(...args)} passive={true} />
    </li>
  );
};

const App = async function (props, hello) {
  console.log("========", hello, "world");

  const canvas = <canvas style="width: 100%; height: 25vh" />;
  const gfx = <WebGL2Renderer>{canvas}</WebGL2Renderer>;

  <Mount>
    {canvas}
    {await (<TestWrapper />)}
    <svg:svg>
      <svg:rect fill="cyan" stroke="turquoise" width="300" height="150" />
      <svg:text x={100} y={100}>
        SVG
      </svg:text>
    </svg:svg>
  </Mount>;

  <WebGL2App {...gfx} />;

  <EventListener type="click" listener={console.log} passive={true} once={true}>
    {document.body}
  </EventListener>;
};

const WebGL2App = function ({
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
  useAnimationFrame(this);
  smallTexture.update(
    Uint8Array.of(Math.random() * 255, Math.random() * 255, Math.random() * 255, 255),
    Math.random() * 64,
    Math.random() * 64,
  );
};

const QuadUpdater = function ({ QuadInstance }) {
  const [max, setMax] = <State>{100}</State>;
  console.log(max);
  // setTimeout(setMax, Math.random() * 2000, 100 * (0.5 + Math.random() * 0.5));

  for (let index = 0; index < max; index++) {
    if (Math.random() < 0.2) continue;
    <Quad key={index} QuadInstance={QuadInstance} />;
  }
};

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

const WebGL2Renderer = function (props, canvas) {
  const context = <Context canvas={canvas} debug={true} />;

  const shape = (
    <Attribute
      context={context}
      data={[
        Float32Array.of(0, 0),
        Float32Array.of(1, 0),
        Float32Array.of(1, 1),
        Float32Array.of(0, 1),
      ]}
    />
  );
  const shared = <UniformBlock context={context} uniforms={{ time: 0, lightColor: [0, 0, 0] }} />;
  const smallTexture = (
    <Texture
      context={context}
      pixels={new Uint8Array(64 * 64 * 4).fill(128)}
      anisotropicFiltering={16}
    />
  );
  const [cameraController, camera] = <Camera context={context} fov={90} />;

  const triangleElements = <Elements context={context} data={Int16Array.of(0, 1, 2)} />;
  const quadElements = <Elements context={context} data={Int16Array.of(0, 1, 2, 2, 3, 0)} />;

  const QuadInstance = (
    <Instances
      context={context}
      attributes={{
        color: [1, 1, 1],
        offset: [0, 0],
      }}
    />
  );

  const drawTriangle = (
    <Command
      context={context}
      attributes={{ shape }}
      textures={{ smallTexture }}
      elements={triangleElements}
      vertex={`
      out vec2 textureCoordinates;
      void main () {
        textureCoordinates = shape;
        gl_Position = vec4(shape, 0.0, 1.0);
      }
    `}
      fragment={`
      in vec2 textureCoordinates;
      out vec4 fragment;

      float fDistance(float x) {
        return length(vec2(dFdx(x), dFdy(x)));
      }

      float aLine(float threshold, float value, float thickness) {
        return clamp(thickness - abs(threshold - value) / fDistance(value), 0.0, 1.0);
      }

      void main () {
        fragment = vec4(texture(smallTexture, textureCoordinates).rgb, 1.0);
        fragment.rgb *= 1.0 - aLine(0.5, length(textureCoordinates), 1.0);
      }
    `}
    />
  );

  const drawQuads = (
    <Command
      context={context}
      attributes={{ shape }}
      uniformBlocks={{ camera }}
      elements={quadElements}
      instances={QuadInstance}
      vertex={`
      out vec3 colorOut;

      void main () {
        colorOut = color;
        gl_Position = projectionView * vec4(shape + offset, -offset.x, 1.0);
      }
    `}
      fragment={`
      in vec3 colorOut;
      out vec4 fragment;

      void main () {
        fragment = vec4(colorOut, 1.0);
      }
    `}
    />
  );

  return {
    frame: context.frame,
    resize: context.resize,
    drawTriangle,
    drawQuads,
    clear: context.clear,
    QuadInstance,
    shared,
    cameraController,
    smallTexture,
  };
};

rahti.run(App, null, "Hello");
