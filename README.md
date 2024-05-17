# Rahti

`npm install @vuoro/rahti`

Write reactive JS components without JSX. Docs WIP.

```js
import { Component } from "@vuoro/rahti";
import { State } from "@vuoro/rahti/state";

const Parent = new Proxy(function (hello) {
  const [time, setTime] = State(Date.now());
  setTimeout(() => setTime(Date.now()), Math.random() * 2000);

  Child(hello, time);
}, Component);

const Child = new Proxy(function (hello, time) {
  console.log(hello, time);
}, Component);

Parent("Hello world");
```

# Upcoming features

- "Global", signal-like components to lessen the need for prop drilling
- Better API for DOM elements

# API & example

```js
import { Component, cleanup, save, load } from "@vuoro/rahti";
import { getInstance, update, updateParent } from "@vuoro/rahti";
import { State } from "@vuoro/rahti/state";
import { createGlobalState } from "@vuoro/rahti/globalState";
import { Mount, html, svg } from "@vuoro/rahti/dom";

const App = new Proxy(function () {
  // You can call any component inside any other component.
  Child();

  // You can create DOM elements using `html` and `svg`.
  // Object arguments turn into DOM attributes.
  // Text and number arguments turn into text nodes.
  html.p(
    {style: "color: red"}, 
    "Hello world"
  );
  svg.svg(
    svg.rect({width: "300" height: "300" fill: "red"})
  );

  // Events can be handled with `EventHandler`…
  html.button(
    {type: "button"},
    EventHandler({type: "click", listener: console.log, {passive: true, once: true}})
  );

  // or with `EventListener`.
  EventListener(
    document.body,
    "click",
    (event) => console.log(event),
    {passive: true}
  );

  // Finally, none of the above DOM components will actually appear on the page,
  // unless passed to `Mount`. The first argument is the mount target.
  const paragraph = html.p("Hello from document.body!");
  Mount(document.body, paragraph)
}, Component);

App();

// Components can have `State`.
// When a component's `State` changes, it re-runs.
// If the component returns a different value than the last time it ran,
// it'll tell its parent to re-run too.
// Any other components that the parent then calls will also try to re-run, 
// but all components are _memoized_, 
// meaning they will only re-run if they receive different arguments from when they last ran,
// otherwise they'll just return their previous return value.
const StatefulApp = new Proxy(function () {
  const [timestamp, setTimestamp, getTimestamp] = State(performance.now());
  requestAnimationFrame(setTimestamp);

  Mount(document.body, html.p(timestamp))
}, Component);

// The setter function of a State accepts two arguments:
// 1. the State's new value
// 2. a boolean: `true` if it should update immediately, or `false` (the default) if later using `requestIdleCallback`
setTimestamp(performance.now(), false); // updates on the next `requestIdleCallback`
setTimestamp(performance.now(), true); // updates immediately

// `createGlobalState` is a helper for sharing the same state between multiple components.
// It returns a component that works like State, a setter function, and a getter function.
const [
  GlobalTimer,
  setGlobalTimestamp,
  getGlobalTimestamp
] = createGlobalState(performance.now());

const A = new Proxy(function () {
  const [timestamp, setGlobalTimestamp, getGlobalTimestamp] = GlobalTimer(performance.now());
  console.log("from a", timestamp);
}, Component);

const B = new Proxy(function () {
  const [timestamp, setGlobalTimestamp, getGlobalTimestamp] = GlobalTimer(performance.now());
  console.log("from b", timestamp);
}, Component);

requestAnimationFrame(setGlobalTimestamp);

// The getter function lets you easily check or set the state outside components,
// inside event handlers and such.
setTimeout(() => console.log("from setTimeout", getGlobalTimestamp()), 1000);

// You can also create custom state mechanisms with `getInstance`, `update` and `updateParent`.
// (Check out state.js and globalState.js for how they use it.)
// `update(instance)` causes the instance to re-run on the next `requestIdleCallback`. 
// `update(instance, true)` causes the instance to re-run immediately. 
// The above goes for `updateParent` too.
const CustomStateTest = new Proxy(function () {
  const instance = getInstance();
  console.log("ran at", performance.now());
  setTimeout(() => update(instance), 1000);
}, Component);

// Components can have keys, which lets them be identified better between re-runs of their parents.
// Define a `getKey` function as below. It gets passed the same arguments as the component.
// Whatever `getKey` returns will be the key for that component instance.
const Child = new Proxy(function (index) {
  console.log(index);
}, {...Component, getKey: index => index});

// `save` & `load` are an additional way to persist data between component reruns.
// Handy for avoiding creating new objects every time the component runs.
// The data will be cleared if the component is destroyed.
const SaveAndLoad = new Proxy(function () {
  const savedArray = load() || save([]);
  savedArray.push(Math.random());
}, Component);

// Finally, components can have a `cleanup` callback.
// It gets called before a component re-runs, and when it gets destroyed.
const Cleanup = new Proxy(function () {
  const element = document.createElement("div");
  cleanup(() => element.remove());
  return element;
}, Component);

// Cleanups are called with some pieces of data you can use to perform complicated cleanup logic.
// Be very mindful when using these, as it's easy to introduce bugs with them.
// - 1st argument = the component instance object also returned by `getInstance`, which can be used for identification (but be keep in mind that after the component instance gets destroyed the object may be reused by new component instances)
// - 2st argument = the last data the component has saved with `save`, if any
// - 3nd argument = a boolean indicating whether the component is being destroyed (`true`) or just updating (`false`)
const CleanupAdvanced = new Proxy(function () {
  const element = document.createElement("div");
  console.log(getInstance);
  cleanup(cleanElement);
  return element;
}, Component);

function cleanElement(instance, savedData, isBeingDestroyed) {
  console.log(instance);
  element.remove();
}
```

## Hot module reloading for Vite

Rahti supports HMR in [Vite](https://vitejs.dev) when `vite-plugin-rahti` is loaded in `vite.config.js`:

```js
import { rahtiPlugin } from "@vuoro/rahti/vite-plugin-rahti";

export default {
  plugins: [rahtiPlugin()]
};
```

HMR will work best in files that export nothing but Components. Otherwise Vite's HMR system seems to go into an infinite loop sometimes, and I don't know how to fix or even debug it.

```js
// This should work perfectly
export const SomeComponent = new Proxy(function() {}, Component);
const somethingElse = "hello";

// This probably won't
export const SomeComponent = new Proxy(function() {}, Component);
export const somethingElse = "hello";
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