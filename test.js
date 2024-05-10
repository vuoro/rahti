import TestWorker from "./TestWorker.js?worker";
import { Component, GlobalComponent, cleanup } from "./rahti/component.js";
import { EventListener, Mount, html, svg } from "./rahti/dom.js";
import { GlobalState } from "./rahti/globalState.js";
import { State } from "./rahti/state.js";
// import { TestGraphics } from "./testGraphics.js";
// import { Webgl2App } from "./testWebgl2.js";

new TestWorker();

const [GlobalTest, setGlobalTest, getGlobalTest] = GlobalState(0);
setInterval(() => setGlobalTest(getGlobalTest() + 1), 5000);

const TestWrapper = new Proxy(function () {
  GlobalTest();

  const [counter, setState] = State(0);
  const timer = setTimeout(setState, 1000, counter + 1);
  cleanup(() => {
    console.log("cleaning additional timer", timer);
    clearTimeout(timer);
  });

  const testComponents = [];
  const max = 20;

  for (let index = 0; index < (0.5 + Math.random() * 0.5) * max; index++) {
    try {
      if (Math.random() > 0.1) testComponents.push(TestItem(counter, testComponents.length));
    } catch (error) {
      reportError(error);
    }
  }

  return [
    html.p(
      { style: "color: red" },
      `Something is wrong if: a) there's ever`,
      html.em(" consistently "),
      `over ${max} items here, b)`,
      html.em(" every "),
      "element is flashing red on updates.",
    ),
    html.style(`
      * {
        animation: enter 1000ms ease-out;
        outline: 2px solid transparent;
      }

      @keyframes enter {
        0% { outline-color: rgba(255,0,0, 0.618) }
        100% { outline-color: transparent; }
      }
    `),
    html.ol({ class: "lol" }, Event({ type: "click", listener: console.log }), testComponents),
  ];
}, GlobalComponent);

const TestItem = new Proxy(
  function (counter, index) {
    const [local, setLocal] = State(0);
    const [global] = GlobalTest();

    const timer = setTimeout(setLocal, 200 + Math.random() * 5000, Math.random());
    cleanup(() => clearTimeout(timer));
    if (Math.random() < 0.01) throw new Error("intentional test error");

    return html.li(
      index + 1,
      html.input({ type: "checkbox", checked: local > 0.5 }),
      ` Parent: ${counter} / Global: ${global} / Local: ${local}`,
      Event({ type: "click", listener: (...args) => console.log(...args), passive: true }),
    );
  },
  { ...Component, getKey: (counter, index) => index },
);

const App = async function (hello) {
  console.log("========", hello, "world");

  const canvasElement = html.canvas({ style: "width: 100%; height: 25vh" });
  // const gfx = <TestGraphics>{canvasElement}</TestGraphics>;

  Mount(
    html.body,
    canvasElement,
    TestWrapper(),
    svg.svg(
      svg.rect({ fill: "cyan", stroke: "turquoise", width: "300", height: "150" }),
      svg.text({ x: 100, y: 100 }, "SVG"),
    ),
  );

  // <Webgl2App {...gfx} />;

  EventListener(document.body, "click", console.log, { passive: true, once: true });
};

App("hello");
