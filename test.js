import { Component, cleanup, save, load, getId, getParentId, Use } from "./index.js";
import { State } from "./state.js";
import { Event, EventListener, Mount, html, svg } from "./dom.js";
import { Idle } from "./idle.js";

const [getGlobalTest, setGlobalTest] = State(this, 0);
setInterval(() => setGlobalTest(getGlobalTest() + 1), 2618);

const TestWrapper = new Proxy(async function TestWrapper(rahti) {
  const [getCounter, setState] = State(rahti, 0);
  const counter = getCounter();
  const timer = setTimeout(setState, 1000, counter + 1);
  cleanup(() => clearTimeout(timer));

  const testComponents = [];
  const max = 10;
  for (let index = 0; index < max; index++) {
    // if (deadline.timeRemaining() === 0) deadline = await use(idle());
    try {
      if (Math.random() > 0.1) {
        const testComponent = TestItem(rahti, testComponents.length + 1, counter);
        testComponents.push(testComponent);
      }
    } catch (e) {}
  }

  await idle();

  return Dom(rahti).html`
    <p style="color: red">
      Something is wrong if: a) there's ever <em>consistently</em> over ${max} items here, b) <em>every</em> element is faslhing red on updates.
    </p>
    <style>
      * {
        animation: enter 1000ms ease-out;
        outline: 2px solid transparent;
      }

      @keyframes enter {
        0% { outline-color: rgba(255,0,0, 0.618) }
        100% { outline-color: transparent; }
      }
    </style>
    <p>${`Parent: ${counter} / Global: ${getGlobalTest()}`}</p>
    <ol class="lol">
      ${testComponents}
      ${Event("click", console.log)}
    </ol>
  `;
}, Component);

const TestItem = new Proxy(function TestItem(rahti, index, counter) {
  const [getLocal, setLocal] = State(rahti, 0);
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

const App = new Proxy(async function App(rahti, hello) {
  Mount(
    rahti,
    document.body,
    Dom(rahti).html`<h1>${hello}</h1>`,
    TestWrapper(),
    html.div(`an SVG follows`),
    svg.svg(svg.rect({ fill: "turquoise", stroke: "green", width: "300", height: "150" })),
  );

  EventListener(document, "click", console.log, { passive: true });
}, Component);

App("hello");
