# Rahti

`npm install @vuoro/rahti`

- Write reactive JS components with async/await
  ```js
  function parent() {
    await this(child)("hello");
  }
  async function child(text) {
    console.log(text);
  }
  root(parent)();
  ```
- Simple API
  ```js
  import { root, mount, state, cleanup } from "rahti"; // for most use cases
  import { createGlobalState, idle, update } from "rahti"; // for advanced usage
  ```
- Supports any DOM elements, including web components
  ```js
  this("p")("hello");
  this("my-web-component")("world");
  this("svg")(this("rect")({ width: 300, height: 300, fill: "red" }));
  ```
- No compile steps
- Low garbage generation and runtime overhead
- Bad docs 😅

## API & example

```js
import { root, mount, state, cleanup, createGlobalState, idle, update } from "rahti";

// components are just normal async functions, with 1 rule:
// Rahti makes use of `this`, so they must NOT be arrow functions
// good: function() {}
// bad: () => {}

function app(greeting) {
  // passing `this` a function creates a new child component
  this(child)(greeting);

  // passing a string creates DOM component
  // `p` here is an actual `<p>` element
  // you can access it by awaiting it
  const p = this("p")(greeting);
  console.log(await p);

  // passing DOM components into DOM components nests them inside
  const svg = this("svg")(this("rect")());

  // set DOM attributes by passing an object into a DOM component
  this("rect")({ width: 300, height: 300, fill: "red" });

  // set event handlers with an `events` attribute
  this("button")({ type: "button", events: { click: console.log } });
  this("button")({ type: "button", events: { pointermove: [console.log, { passive: true }] } });

  // components can be given keys
  // they help identify the same component between re-runs,
  // avoiding unnecessary work & bugs when components are used inside loops or if-clauses
  this("p", "some key here")("keyed paragraph!")

  // none of the above DOM components will actually appear on the page,
  // unless passed to a `mount` component,
  // where the first argument is the element they should be prepended into
  this(mount)(document.body, p, svg);
}

// components can use await freely
async function child(greeting) {
  this(logger)("waking up…", performance.now());

  // `idle` is a helper that halts execution until `requestIdleCallback`
  await idle();

  this(logger)(greeting, performance.now());
}

// if they don't use await, they don't have to be async,
// but this(logger)() will still return a Promise
function logger(...text) {
  console.log(...text);
}

// the outermost components must be initialized with `root`
root(app)("hello");

// components can have state
// when a component's state changes, it re-runs
// if it returns some value, its parent component will also re-run
async function statefulApp() {
  const timestamp = await this(timer)();

  this(mount)(document.body, this("p")(timestamp));
}

async function timer() {
  // the first argument will be the state's initial value
  // returns [current value, function for changing the state]
  const [timestamp, setTimestamp] = await this(state)(performance.now());
  requestAnimationFrame(setTimestamp);
  return timestamp;
}

// you can override the setter by passing in a function as the second argument
const createActions = (get, set) => {
  return {
    increment: (newValue) => set(get() + 1),
    decrement: (newValue) => set(get() - 1),
  };
};

async function timer() {
  const [timestamp, setTimestamp] = await this(state)(performance.now(), createActions);
}

// `createGlobalState` is a helper for sharing the same state between multiple components
// it accepts the same arguments as `state`
const [globalTimer, setGlobalTimestamp] = createGlobalState(performance.now());
setInterval(() => setGlobalTimestamp(performance.now()), 200);

function a() {
  const [timestamp, setGlobalTimestamp] = await this(globalTimer)();
}

function b() {
  const [timestamp, setGlobalTimestamp] = await this(globalTimer)();
}

// you can also create custom state mechanisms with `update`
// (check out state.js and globalState.js for how they use it)
function () {
  console.log("ran at", performance.now());
  setTimeout(() => update(this), 1000);
}

// finally, components can have cleanups
// (both `cleanup` and `cleanUp` will work!)
function () {
  const element = document.createElement("div");
  cleanup(this).then((isFinal) => {
    // if isFinal is true, the component is being destroyed
    // else it's just updating
    if (isFinal) element.remove();
  });
  return element;
}
```

## ~~Server-side rendering with Astro~~

**Only supported in 1.x.x for now!**

Rahti has a custom renderer for [Astro](https://astro.build): https://github.com/vuoro/astro-renderer-rahti

1. `npm install @vuoro/astro-renderer-rahti @vuoro/rahti`
2. Add the renderer to your Astro project configuration. At the time of writing you need to add a file named `astro.config.mjs` to the root of your project, with the contents: `export default { renderers: ['@vuoro/astro-renderer-rahti'] };`. For details about configuring Astro, see <https://docs.astro.build>.
3. Now you should be able to mount any Effect in Astro as a Component. `<YourEffect someProp={"someValue"}>blah</YourEffect>` should call your Effect like this: `YourEffect(root, {someProp: "someValue"}, ["blah"])`.
4. Your effect should use the provided `root` for any DOM Effects, and also pass the provided `children` array to it: `const YourEffect = effect((root, props, children) => { root(p("Hello world"), children) })`.

## WebGL 2 Effects

Since I'm using this library to develop games, I'm also building a set of Effects for working with WebGL 2: [rahti-webgl2](https://github.com/vuoro/rahti-webgl2).

## Inspirations

- <https://reactjs.org>
- <https://github.com/adamhaile/S>
- <https://developer.apple.com/xcode/swiftui/>
- <https://www.solidjs.com>
