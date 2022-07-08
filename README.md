# Rahti

`npm install @vuoro/rahti`

- Write reactive JS components with async/await
  ```js
  const parent = component(function (hello) {
    child(this)(hello);
  });
  const child = component(async function (text) {
    await idle();
    console.log(text);
  });
  parent(globalThis)("hello");
  ```
- Simple API
  ```js
  import { component, state, html, svg, mount } from "rahti"; // for most use cases
  import { createGlobalState, idle, update } from "rahti"; // for advanced usage
  ```
- Supports any DOM elements, via <https://github.com/developit/htm>
  ```js
  html(this)`<p>hello</p>`;
  html(this)`<my-web-component>world</my-web-component>`;
  svg(this)`<svg><rect width=${300} height=${300} fill="red"></rect></svg>`;
  ```
- No compile steps
- Low garbage generation and runtime overhead
- Bad docs 😅

## API & example

```js
import { component, html, mount, state, createGlobalState, idle, update } from "rahti";

// components must be normal, non-arrow functions
// `component(function() {})` = correct
// `component(() => {})` = wrong
const app = component(function (greeting) {
  // you can call any component inside any other component
  // call it twice: first with `this`, then with your arguments
  // `this` contains the component's ID, used to correctly find or create its children,
  // even when using async/await
  child(this)(greeting);

  // to create HTML, use the built in `html` component,
  // which uses <https://github.com/developit/htm> internally
  // `paragraph` here is an actual `<p>` element
  const paragraph = html(this)`<p>${greeting}</p>`;
  console.log(paragraph);

  // passing DOM components into other DOM components nests them
  const someDiv = html(this)`<div>${paragraph}</div>`;

  // set attributes on DOM components using the <https://github.com/developit/htm> API
  svg(this)`<svg><rect width=${300} height=${300} fill="red"></rect></svg>`;

  // maintain event handlers with the special `events` attribute
  html(this)`<button type="button" events=${{ click: console.log }}></button>`;
  html(
    this
  )`<button type="button" events=${{ pointermove: [console.log, { passive: true }] }}></button>`;

  // you can pass a key to a component as the second argument of the first call
  // keys help identify the same component between re-runs,
  // avoiding unexpected results when components are used inside loops or conditionals
  html(this, "keyed paragraph!")`<p>keyed hello!</p>`;

  // none of the above DOM components will actually appear on the page,
  // unless passed to a `mount` component,
  // where the first argument is the element they should be prepended into
  mount(this)(document.body, someDiv);
});

// components can be async functions and may use await freely
const child = component(async function (greeting) {
  logger(this)("waking up…", performance.now());

  // `idle` is a helper that halts execution until `requestIdleCallback`
  await idle();

  logger(this)(greeting, performance.now());
});

// the outermost components must be called with `globalThis` instead of `this`
app(globalThis)("hello");

// components can have state
// when a component's state changes, it re-runs
// if it returns a different value than the last time it ran,
// it'll tell its parent to re-run too
const statefulApp = component(function () {
  const timestamp = timer(this)();

  mount(this)(document.body, html(this)`<p>${timestamp}</p>`);
});

const timer = component(function () {
  // the first argument will be the state's initial value
  // returns [current value, function for changing the state]
  const [timestamp, setTimestamp] = state(this)(performance.now());
  requestAnimationFrame(setTimestamp);
  return timestamp;
});

statefulApp(globalThis)();

// you can override the setter by passing in a function as the second argument
const createActions = (get, set) => {
  return {
    increment: (newValue) => set(get() + 1),
    decrement: (newValue) => set(get() - 1),
  };
};

const timerWithActions = component(function () {
  const [timestamp, setTimestamp] = state(this)(performance.now(), createActions);
});

// `createGlobalState` is a helper for sharing the same state between multiple components
// it accepts the same arguments as `state`
const [globalTimer, setGlobalTimestamp] = createGlobalState(performance.now());
setInterval(() => setGlobalTimestamp(performance.now()), 200);

const a = component(function () {
  const [timestamp, setGlobalTimestamp] = globalTimer(this);
});

const b = component(function () {
  const [timestamp, setGlobalTimestamp] = globalTimer(this);
});

// global states can additionally be called with `globalThis`
// it lets you easily check or set the state outside components,
// or inside event handlers and such
console.log(globalTimer(globalThis)());

// you can also create custom state mechanisms with `update`
// (check out state.js and globalState.js for how they use it)
component(function () {
  console.log("ran at", performance.now());
  setTimeout(() => update(this), 1000);
});

// finally, components can have an optional cleanup function,
// passed as the second argument to `component`
// it runs before the component is re-run, and when it's being destroyed
const elements = new Map();

component(
  function () {
    let element = elements.get(this);

    if (!element) {
      element = document.createElement("div");
      elements.set(this, element);
    }

    return element;
  },
  function (isFinal) {
    // if isFinal is true, the component is being destroyed
    // else it's just re-running
    if (isFinal) {
      elements.get(this).remove();
      elements.delete(this);
    }
  }
);
```

## ~~Server-side rendering with Astro~~

**Only supported in 1.x.x for now!**

Rahti has a custom renderer for [Astro](https://astro.build): https://github.com/vuoro/astro-renderer-rahti

1. `npm install @vuoro/astro-renderer-rahti @vuoro/rahti`
2. Add the renderer to your Astro project configuration. At the time of writing you need to add a file named `astro.config.mjs` to the root of your project, with the contents: `export default { renderers: ['@vuoro/astro-renderer-rahti'] };`. For details about configuring Astro, see <https://docs.astro.build>.
3. Now you should be able to mount any Effect in Astro as a Component. `<YourEffect someProp={"someValue"}>blah</YourEffect>` should call your Effect like this: `YourEffect(root, {someProp: "someValue"}, ["blah"])`.
4. Your effect should use the provided `root` for any DOM Effects, and also pass the provided `children` array to it: `const YourEffect = effect((root, props, children) => { root(p("Hello world"), children) })`.

## WebGL 2 Effects

Since I'm using this library to develop games, I'm also building a set of cp,åpmemts for working with WebGL 2: [rahti-webgl2](https://github.com/vuoro/rahti-webgl2).

## Inspirations

- <https://reactjs.org>
- <https://github.com/adamhaile/S>
- <https://developer.apple.com/xcode/swiftui/>
- <https://www.solidjs.com>
