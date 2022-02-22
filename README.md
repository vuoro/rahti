# Rahti

`npm install @vuoro/rahti`

- Write reactive JS components with async/await
  ```js
  const parent = component(function (hello) {
    child(this, hello);
  });
  const child = asyncComponent(async function (text) {
    await idle();
    console.log(text);
  });
  parent(self, "hello");
  ```
- Simple API
  ```js
  import { component, asyncComponent, html, svg, mount, state } from "rahti"; // for most use cases
  import { cleanup, createGlobalState, idle, update } from "rahti"; // for advanced usage
  ```
- Supports any DOM elements, including web components
  ```js
  html.p(this, "hello");
  html["my-web-component"](this, "world");
  svg.svg(this, svg.rect(this, { width: 300, height: 300, fill: "red" }));
  ```
- No compile steps
- Low garbage generation and runtime overhead
- Bad docs 😅

## API & example

```js
import { root, mount, state, cleanup, createGlobalState, idle, update } from "rahti";

const app = component(function(greeting) {
  // you can call any component inside any other component, as long as you pass `this`
  // as the first argument
  child(this, greeting);

  // passing a string creates DOM component
  // `p` here is an actual `<p>` element
  const someHtml = html.p(this, greeting);
  console.log(someHtml);

  // passing DOM components into DOM components nests them inside
  const someSvg = svg.svg(this, svg.rect(this));

  // maintain DOM attributes by passing an object into a DOM component
  svg.rect(this, width: 300, height: 300, fill: "red" });

  // maintain event handlers with a special `events` attribute
  html.button(this, { type: "button", events: { click: console.log } });
  html.button(this, { type: "button", events: { pointermove: [console.log, { passive: true }] } });

  // components can be given keys by passing something unique before `this`
  // keys help identify the same component between re-runs,
  // avoiding unexpected results when components are used inside loops or conditionals
  html.p("keyed paragraph!", this)

  // none of the above DOM components will actually appear on the page,
  // unless passed to a `mount` component,
  // where the first argument after `this` is the element they should be prepended into
  mount(this, document.body, someHtml, someSvg);
})

// components created with `asyncComponent` can be async and use await freely
const child = asyncComponent(async function (greeting) {
  logger(this, "waking up…", performance.now());

  // `idle` is a helper that halts execution until `requestIdleCallback`
  await idle();

  logger(this, greeting, performance.now());
})

// the outermost components must be initialized with `self` instead of `this`
app(self, "hello");

// components can have state
// when a component's state changes, it re-runs
// if it returns some value, its parent component will also re-run
const statefulApp = component(function() {
  const timestamp = timer(this);

  mount(this, document.body, this("p")(timestamp));
});

const timer = component(function() {
  // the first argument will be the state's initial value
  // returns [current value, function for changing the state]
  const [timestamp, setTimestamp] = state(this, performance.now());
  requestAnimationFrame(setTimestamp);
  return timestamp;
});

statefulApp(self);

// you can override the setter by passing in a function as the second argument
const createActions = (get, set) => {
  return {
    increment: (newValue) => set(get() + 1),
    decrement: (newValue) => set(get() - 1),
  };
};

const timer = component(function() {
  const [timestamp, setTimestamp] = state(this, performance.now(), createActions);
})

// `createGlobalState` is a helper for sharing the same state between multiple components
// it accepts the same arguments as `state`
const [globalTimer, setGlobalTimestamp] = createGlobalState(performance.now());
setInterval(() => setGlobalTimestamp(performance.now()), 200);

const a = component(function() {
  const [timestamp, setGlobalTimestamp] = globalTimer(this);
})

const b = component(function() {
  const [timestamp, setGlobalTimestamp] = globalTimer(this);
})

// you can also create custom state mechanisms with `update`
// (check out state.js and globalState.js for how they use it)
component(function () {
  console.log("ran at", performance.now());
  setTimeout(() => update(this), 1000);
})

// finally, components can have cleanups
// (both `cleanup` and `cleanUp` will work!)
component(function () {
  const element = document.createElement("div");
  cleanup(this, (isFinal) => {
    // if isFinal is true, the component is being destroyed
    // else it's just updating
    if (isFinal) element.remove();
  });
  return element;
})
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
