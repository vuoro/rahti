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
  import { CleanUp, EventListener, createGlobalState, idle, update, updateParent } from "rahti"; // for advanced usage
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
import { rahti, Mount, State, CleanUp, createGlobalState, idle, update, updateParent } from "rahti";

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

  // Maintain event handlers with the special `events` attribute.
  <button type="button" events={{ click: console.log }}></button>;
  <button type="button" events={{ pointermove: [console.log, { passive: true }] }}></button>;
  
  // Or use the EventListener component.
  <EventListener>{document.body}{"click"}{(event) => console.log(event)}{{ passive: true }}</Event>

  // You can pass a key to a component using the special `key` prop.
  // Keys help identify the same component between re-runs,
  // avoiding unexpected results when components are used inside loops or conditionals.
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
// If it returns a different value than the last time it ran,
// it'll tell its parent to re-run too.
const StatefulApp = function () {
  const [timestamp, setTimestamp, getTimestamp] = <State initialValue={performance.now()}/>;
  requestAnimationFrame(setTimestamp);

  <Mount to={document.body}>
    <p>{timestamp}</p>
  </Mount>;
});

rahti.run(StatefulApp);

// You can override the setter function of a State by passing in a function in the `actions` prop.
const createActions = (get, set) => {
  return {
    increment: (newValue) => set(get() + 1),
    decrement: (newValue) => set(get() - 1),
  };
};

const TimerWithActions = function () {
  const [timestamp, {increment, decrement}, getTimestamp] = (
    <State
      initialValue={performance.now()}
      actions={createActions}
    />
  );
};

// `createGlobalState` is a helper for sharing the same state between multiple components.
// It accepts the same props as State.
// It returns a component that works like State, a setter function, and a getter function.
const [
  GlobalTimer, 
  setGlobalTimestamp, 
  getGlobalTimestamp
] = createGlobalState({initialValue: performance.now()});

const a = function () {
  const [timestamp, setGlobalTimestamp, getGlobalTimestamp] = <GlobalTimer />;
  console.log("from a", timestamp);
};

const b = function () {
  const [timestamp, setGlobalTimestamp, getGlobalTimestamp] = <GlobalTimer />;
  console.log("from b", timestamp);
};

requestAnimationFrame(setGlobalTimestamp);

// The getter function lets you easily check or set the state outside components,
// inside event handlers and such.
setTimeout(() => console.log("from setTimeout", getGlobalTimestamp()), 1000);

// You can also create custom state mechanisms with `update` and `updateParent`.
// (Check out state.js and globalState.js for how they use it.)
const CustomStateTest = function () {
  console.log("ran at", performance.now());
  setTimeout(() => update(this.id), 1000);
};

// Finally, components can have "cleanups" using the CleanUp component.
// (Both `Cleanup` and `CleanUp` will work!)
function () {
  const element = document.createElement("div");
  <CleanUp cleaner={function (isFinal) {
    // if isFinal is true, the component is being destroyed
    // else it's just re-running
    element.remove();
  }}/>
  return element;
};

// Cleanups are also called with the component's `this`, which has a unique `.id`,
// so in some cases you can share the same cleanup function with multiple components.
const elements = new Map();

function () {
  const element = document.createElement("div");
  elements.set(this.id, element);
  <CleanUp cleaner={cleanElement} />
  return element;
};

function cleanElement(isFinal) {
  elements.get(this.id).remove();
  if (isFinal) elements.delete(this.id);
})
```

# Setting up JSX for rahti

To make JSX work for Rahti, use the following JSX factory and fragment settings.

```js
{
  jsxFactory: "this.run",
  jsxFragment: "'rahti:fragment'"
}
```

For a Vite-compatible configuration file, check `vite.config.js` in this repository.

## WebGL 2 Effects

Since I'm using this library to develop games, I'm also building a set of components for working with WebGL 2: [rahti-webgl2](https://github.com/vuoro/rahti-webgl2).

## Inspirations

- <https://reactjs.org>
- <https://github.com/adamhaile/S>
- <https://developer.apple.com/xcode/swiftui/>
- <https://www.solidjs.com>
