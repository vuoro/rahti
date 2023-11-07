import {
  rahti,
  idle,
  createGlobalState,
  State,
  Mount,
  Event,
  EventListener,
} from "./rahti/rahti.js";
import { TestGraphics } from "./testGraphics.jsx";
import { Webgl2App } from "./testWebgl2.jsx";

const [GlobalTest, setGlobalTest, getGlobalTest] = createGlobalState(0);
setInterval(() => setGlobalTest(getGlobalTest() + 1), 5000);

const TestWrapper = async function () {
  <GlobalTest />;
  const [counter, setState] = <State initialValue={0} />;
  const timer = setTimeout(setState, 1000, counter + 1);
  this.cleanup(() => clearTimeout(timer));
  this.cleanup(() => console.log("cleaning additional timer", timer));

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
  if (Math.random() < 0.01) throw new Error("intentional test error");

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
  // console.log("========", hello, "world");

  const canvas = <canvas style="width: 100%; height: 25vh" />;
  const gfx = <TestGraphics>{canvas}</TestGraphics>;

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

  <Webgl2App {...gfx} />;

  <EventListener type="click" listener={console.log} passive={true} once={true}>
    {document.body}
  </EventListener>;
};

rahti.run(App, null, "Hello");
