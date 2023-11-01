import { Component, cleanup, save, load, getId, getParentId } from "./index.js";
import { State } from "./state.js";
import { Event, EventListener, Mount, html, svg } from "./dom.js";

const [getGlobalTest, setGlobalTest] = State(0);
setInterval(() => setGlobalTest(getGlobalTest() + 1), 2618);

const TestWrapper = new Proxy(function TestWrapper() {
  const [getCounter, setState] = State(0);
  const counter = getCounter();
  const timer = setTimeout(setState, 1000, counter + 1);
  cleanup(() => clearTimeout(timer));

  const testComponents = [];
  const max = 10;
  for (let index = 0; index < max; index++) {
    // if (deadline.timeRemaining() === 0) deadline = await use(idle());
    try {
      if (Math.random() > 0.1) {
        const testComponent = TestItem(testComponents.length + 1, counter);
        testComponents.push(testComponent);
      }
    } catch (e) {}
  }

  return [
    html.p(
      { style: "color: red" },
      `Something is wrong if: a) there's ever `,
      html.em("consistently"),
      ` over ${max} items here, b) `,
      html.em("every"),
      ` element is
      flashing red on updates.`,
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
    html.p(`Parent: ${counter} / Global: ${getGlobalTest()}`),
    html.ol(
      {
        class: "lol",
      },
      testComponents,
      Event("click", console.log),
    ),
  ];
}, Component);

const TestItem = new Proxy(function TestItem(index, counter) {
  const [getLocal, setLocal] = State(0);
  const local = getLocal();
  const global = getGlobalTest();

  const timer = setTimeout(setLocal, Math.random() * 2000, local + 1);
  save(timer);
  cleanup(cleanTestItem);
  if (Math.random() < 0.1) throw new Error("random");

  return html.li(
    index,
    html.input({
      type: "checkbox",
      checked: local > 0.5,
    }),
    `Parent: ${counter} / Global: ${global} / Local: ${local}`,
    Event("click", console.log),
  );
}, Component);

const cleanTestItem = function (timer) {
  clearTimeout(timer);
};

const App = new Proxy(async function App(hello) {
  Mount(
    document.body,
    html.h1(hello),
    TestWrapper(),
    html.div(`an SVG follows`),
    svg.svg(svg.rect({ fill: "turquoise", stroke: "green", width: "300", height: "150" })),
  );

  EventListener(document, "click", console.log, { passive: true });
}, Component);

App("hello");
