import { Component, use, cleanup, save, load, getId, getParentId } from "./index.js";
import { State } from "./state.js";
import { idle } from "./idle.js";
import { Event, EventListener, Mount, html, svg } from "./dom.js";

const [getGlobalTest, setGlobalTest] = State(0);
// setInterval(() => setGlobalTest(Math.random()), 3000);
// setTimeout(() => {
//   setGlobalTest(Math.random());
// }, 3000);

const TestWrapper = new Proxy(async function TestWrapper() {
  const [getCounter, setState] = State(0);
  const counter = getCounter();
  // const timer = setTimeout(setState, 5000, counter + 1);
  // cleanup(() => clearTimeout(timer));

  let deadline = await use(idle());

  const testComponents = [];
  const max = 5;
  for (let index = 0; index < max; index++) {
    if (deadline.timeRemaining() <= 0) deadline = await use(idle());
    try {
      if (Math.random() > 0.2) testComponents.push(use(await TestItem(counter, index)));
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
    html.ol(
      {
        class: "lol",
      },
      testComponents,
      Event("click", console.log),
    ),
  ];
}, Component);

const TestItem = new Proxy(async function TestItem(counter, index) {
  const [getLocal, setLocal] = State(0);
  const local = getLocal();
  const global = getGlobalTest();

  // const timer = setTimeout(setLocal, 4000 + Math.random() * 10000, Math.random());
  // save(timer);
  // cleanup(cleanTestItem);
  // if (Math.random() < 0.05) throw new Error();

  await use(idle());

  return html.li(
    index + 1,
    html.input({
      type: "checkbox",
      checked: local > 0.5,
    }),
    `Parent: ${counter} / Global: ${global} / Local: ${local}`,
    Event("click", console.log),
  );
}, Component);

TestItem.memoized = true;

const cleanTestItem = function () {
  const timer = load();
  clearTimeout(timer);
};

const App = new Proxy(async function App(hello) {
  console.log("========", hello, "world");
  Mount(
    document.body,
    await use(TestWrapper()),
    html.div(`an SVG follows`),
    svg.svg(svg.rect({ fill: "turquoise", stroke: "green", width: "300", height: "150" })),
  );

  EventListener(document, "click", console.log, { passive: true });
}, Component);

App("hello");
