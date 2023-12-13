# Rahti

`npm install @vuoro/rahti`

- Write reactive JS components with async/await
  ```js
  const Parent = function ({ hello }, world) {
    <Child>
      {hello} {world}
    </Child>;
  };
  const Child = async function (props, text) {
    await idle();
    console.log(text);
  };
  rahti.run(Parent, { hello: "Hello" }, "world");
  ```
- Simple API
  ```js
  import { rahti, State, Mount } from "rahti"; // for most use cases
  import { EventListener, createGlobalState, idle, update, updateParent } from "rahti"; // for advanced usage
  ```
- Supports any DOM elements
  ```js
  <p>hello</p>;
  <my-web-component>world</my-web-component>;
  <svg:svg>
    <svg:rect width={300} height={300} fill="red"></svg:rect>
  </svg:svg>;
  ```
- Somewhat low garbage generation and runtime overhead
- Also works without JSX
- Bad docs 😅

## API & example

```js
import { rahti, Mount, State, createGlobalState, idle, update, updateParent } from "rahti";

// Components must be normal, non-arrow functions
// `function() {}` = correct
// `() => {}` = wrong
const App = function (props, greeting) {
  // You can call any component inside any other component, using JSX.
  <Child>{greeting}</Child>;

  // Here's the same as above, but without JSX.
  // JSX hides `this`, which is used to identify the currently running component,
  // without getting confused by any `await`s it might use.
  this.run(Child, null, "greeting")

  // HTML works the same as in other JSX-based libraries.
  // `paragraph` here is an actual `<p>` DOM element.
  const paragraph = <p>{greeting}</p>;
  // const paragraph = this.run("p", null, greeting);
  console.log(paragraph);

  // SVG elements need to be prefixed with `svg:`.
  <svg:svg>
    <svg:rect width="300" height="300" fill="red"></svg:rect>
  </svg:svg>;

  // Passing DOM components into other DOM components nests them.
  const someDiv = <div>{paragraph}</div>;

  // Event handlers can be added with the `<Event>` component.
  <button type="button">
    <Event type="click" listener={console.log}/>
  </button>;

  <button type="button">
    <Event
      type="pointermove"
      listener={console.log}
      passive={true}
      once={true}
    />
  </button>;

  // Or using the `EventListener` component.
  <EventListener type="click" listener={console.log}>{document.body}</EventListener>;
  <EventListener
    target={document.body}
    type="click"
    listener={(event) => console.log(event)}
    passive={true}
  />;

  // You can pass a key to a component using the special `key` prop.
  // Keys help identify the same component between re-runs,
  // avoiding unexpected results when components are used inside loops or conditionals.
  <YourComponent key="keyed component!"/>;
  <p key="keyed paragraph!">keyed hello!</p>;

  // Finally, none of the above DOM components will actually appear on the page,
  // unless passed to a `mount` component.
  <Mount to={document.body}>{someDiv}</Mount>;
});

// Components can be async functions and may use await freely.
const Child = async function (greeting) {
  console.log("waking up…", performance.now());

  // `idle` is a helper that halts execution until `requestIdleCallback`
  await idle();

  console.log(greeting, performance.now());
};

// The outermost components must be initialized without JSX, using `rahti.run`
rahti.run(App, null, "hello");

// Components can have state, using the State component.
// When a component's state changes, it re-runs.
// If it returns a different value than the last time it ran
// it'll tell its parent to re-run too.
const StatefulApp = function () {
  const [timestamp, setTimestamp, getTimestamp] = <State initialValue={performance.now()}/>;
  requestAnimationFrame(setTimestamp);

  <Mount to={document.body}>
    <p>{timestamp}</p>
  </Mount>;
});

// The setter function of a State accepts two arguments:
// 1. the State's new value
// 2. a boolean: `true` if it should update quickly using `queueMicrotask`, or `false` (the default) if lazily using `requestIdleCallback`
setTimestamp(performance.now(), true); // updates as soon as possible
setTimestamp(performance.now(), false); // updates later

rahti.run(StatefulApp);

// `createGlobalState` is a helper for sharing the same state between multiple components.
// It returns a component that works like State, a setter function, and a getter function.
const [
  GlobalTimer,
  setGlobalTimestamp,
  getGlobalTimestamp
] = createGlobalState(performance.now());

const A = function () {
  const [timestamp, setGlobalTimestamp, getGlobalTimestamp] = <GlobalTimer initialValue={performance.now()} />;
  console.log("from a", timestamp);
};

const B = function () {
  const [timestamp, setGlobalTimestamp, getGlobalTimestamp] = <GlobalTimer initialValue={performance.now()} />;
  console.log("from b", timestamp);
};

requestAnimationFrame(setGlobalTimestamp);

// The getter function lets you easily check or set the state outside components,
// inside event handlers and such.
setTimeout(() => console.log("from setTimeout", getGlobalTimestamp()), 1000);

// You can also create custom state mechanisms with `update` and `updateParent`.
// (Check out state.js and globalState.js for how they use it.)
const CustomStateTest = function () {
  const instance = this;
  console.log("ran at", performance.now());
  setTimeout(() => update(instance), 1000);
};

// `this.save` & `this.load` are an additional way to persist data between component reruns.
// Handy for avoiding creating new objects every time the component runs.
// The data will be cleared if the component is destroyed.
const SaveAndLoad = function () {
  const savedArray = this.load() || this.save([]);
  savedArray.push(Math.random());
};

// Finally, components can have cleanup functions, set using `this.cleanup()`.
// They are run before a component re-runs, and when it gets destroyed.
function () {
  const element = document.createElement("div");
  this.cleanup(() => console.log("will remove element next")));
  this.cleanup(() => element.remove()));
  return element;
};

// Cleanups are called with some pieces of data you can use to perform complicated cleanup logic.
// Be very mindful when using these, as it's easy to introduce bugs with them.
// - `this` = the same `this` as inside the component (not unique: may be reused after the component gets destroyed)
// - 1st argument = the last data the component has saved with `this.save`, if any
// - 2nd argument = a boolean indicating whether the component is being destroyed (`true`) or just updating (`false`)
function () {
  const element = document.createElement("div");
  this.save(element);
  this.cleanup(cleanElement);
  return element;
};

function cleanElement(element = null, isBeingDestroyed = false) {
  console.log(this);
  element.remove();
}
```

## Setting up JSX for rahti

To make JSX work for Rahti, use the following JSX factory and fragment settings.

```js
{
  jsxFactory: "this.run",
  jsxFragment: "'rahti:fragment'"
}
```

For a Vite-compatible configuration file, check `vite.config.js` in this repository.

## Hot module reloading for Vite

Rahti supports HMR in [Vite](https://vitejs.dev) when `vite-plugin-rahti` is loaded in `vite.config.js`:

```js
import { rahtiPlugin } from "@vuoro/rahti/vite-plugin-rahti";

export default {
  plugins: [rahtiPlugin()],
  esbuild: {
    jsxFactory: "this.run",
    jsxFragment: "'rahti:fragment'",
    jsxSideEffects: true,
  }
};
```

HMR will work in files that export nothing but what can be identified as components: functions with a name that starts with an uppercase letter.

```js
// These will work
export const ComponentA = function() {};
export function ComponentB () {};
const somethingElseA = "hello";

// These won't
export const componentC = function() {};
export const somethingElseB = "hello";
```

## WebGL 2 components

Since I'm using this library to develop games, I'm also building a set of components for working with WebGL 2. They are experimental, and will not follow this repository's semantic versioning.

```js
import * as WebGl2 from "@vuoro/rahti/webgl2";
```

## Inspirations

- <https://reactjs.org>
- <https://github.com/adamhaile/S>
- <https://developer.apple.com/xcode/swiftui/>
- <https://www.solidjs.com>
