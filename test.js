import { Component, use, cleanup, save, load } from "./index.js";
import { State } from "./state.js";
import { idle } from "./idle.js";
import { Event, EventListener, Mount, html, svg } from "./dom.js";

const [getGlobalTest, setGlobalTest] = State(0);
// setInterval(() => setGlobalTest(Math.random()), 3000);

const TestWrapper = new Proxy(async function () {
  getGlobalTest();
  const [counter, setState] = State(0);
  // const timer = setTimeout(setState, 2000, counter + 1);
  // cleanup(() => clearTimeout(timer));

  let deadline = await use(idle());

  const testComponents = [];
  const max = 20;
  for (let index = 0; index < (0.5 + Math.random() * 0.5) * max; index++) {
    if (deadline.timeRemaining() <= 0) deadline = await use(idle());
    try {
      if (Math.random() > 0.1) testComponents.push(await TestItem(counter, index));
    } catch (e) {}
  }

  return [
    html.p(
      { style: "color: red" },
      `Something is wrong if: a) there's ever <em>consistently</em> over {max} items here, b) <em>every</em> element is
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

const TestItem = new Proxy(async function (counter, index) {
  const [local, setLocal] = State(0);
  getGlobalTest();

  // const timer = setTimeout(setLocal, 4000 + Math.random() * 10000, Math.random());
  // save(timer);
  // cleanup(cleanTestItem);
  if (Math.random() < 0.05) throw new Error();

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

const cleanTestItem = function () {
  const timer = load();
  clearTimeout(timer);
};

const App = new Proxy(async function (hello) {
  console.log("========", hello, "world");
  Mount(document.body, [await use(TestWrapper()), html.div(`an SVG follows`)]);
  svg.svg(svg.rect({ fill: "none", stroke: "red", width: "300", height: "150" }));

  EventListener(document, "click", console.log(), { passive: true });
}, Component);

App("hello");
