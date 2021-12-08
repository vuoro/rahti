# Rahti

`npm install @vuoro/rahti`

- Write reactive JS
  ```js
  p("like this.");
  ```
- Simple [API](#api)
  ```js
  import { state, globalState, effect, onCleanup, html, svg, event, createRoot } from "rahti";
  ```
- Supports any [DOM elements](#rendering-html-and-svg-with-dom-effects):
  ```js
  const { h1, p, nav } = html;
  const { "my-web-component": myWebComponent } = html;
  const { rect, text } = svg;
  ```
- Supports [server-side rendering with Astro](#server-side-rendering-with-astro).
- No compile steps.
- Low garbage generation.

## State and Effects

If you've used something like React, S.js, or SolidJS you'll probably know how these work. State can change its value and re-runs the Effects the change impacts. (In React terms, Effects do the job of both Components and Hooks.)

```js
import { state, effect } from "rahti";

const counter = state(0);

const app = effect(() => {
  const [count, setCount] = counter();
  console.log(count);
  setTimeout(() => setCount(count + 1), 1000);
});

app();
```

## Cleanups

Effects can contain cleanups. They run just before the Effect re-runs or gets destroyed. (This is the same as when React Hooks return a cleanup function.)

```js
import { effect, onCleanup } from "rahti";

const app = effect(() => {
  const interval = setInterval(() => console.log("Hi!"), 1000);
  onCleanup(() => clearInterval(interval));
});

app();
```

## Rendering HTML and SVG with DOM Effects

Just one rule to remember: DOM Effects must be passed as arguments to another DOM Effect. Otherwise they won't get added to the document. There also needs to be a root DOM Effect wrapping them, created using `createRoot`.

DOM Effects take any number of these kinds of arguments:

- other DOM Effects
- strings and numbers: they turn into text fragments
- objects: their properties will be set as attributes
- `event()` Effects: they maintain an event handler on their parent DOM Effect
- Arrays or Sets containing any of the above (works kinda like React's Fragments)

Note that these are not going to top any benchmarks. There's no "VDOM", "fine reactivity", "Suspense", or advanced scheduling. The nice thing is they're built using the public API of this library, so there's no magic. They follow the same rules as your code, so you can even replace them if you want to.

```js
import { createRoot, effect, html, svg, event } from "rahti";
const { p, button } = html;

const app = effect((root) => {
  root(
    // Either of these will work, but the first one runs a little faster,
    // because `html` & `svg` are Proxies.
    p("Hello world"),
    html.p("Hello world"),

    button(
      "I wish <buttons> had `type=button` by default",
      { type: "button" },
      event("click", console.log)
    ),

    svg.svg(
      svg.rect({ width: 300, height: 300, fill: "red" }),
      svg.text("Surprise svg!", { x: 50, y: 50, fill: "white" })
    ),

    customHelloWorld()
  );
});

const customHelloWorld = effect(() => {
  return [p("Hello."), p("World.")];
});

app(createRoot(document.body));
```

## Custom State setters/actions, and initial values

The `setState` function of a State can be replaced, with for example an object containing "actions" similar to what you see in many JS state management libraries.

Also, the default initial value of a State can be set when defining the it: `const counter = state(0)`, but it can be overridden when first using it: `const [count, setCount] = counter(100)`.

```js
import { state, effect } from "rahti";

const counter = state(0, {
  getActions: (get, set) => ({
    increment: () => set(get() + 1),
    decrement: () => set(get() - 1),
  }),
});

const app = effect(() => {
  const [count, { increment }] = counter(100); // this will start off at `100` instead of `0`
  console.log(count);
  setTimeout(increment, 1000);
});

app();
```

## Setting state during rendering

Much like in React, you can update State during "rendering": while an Effect is running. The new value won't take effect or cause re-runs immediately. Instead it will be delayed and set using `requestIdleCallback` (or `requestAnimationFrame` if not supported).

If you use this feature, be careful of infinite loops!

```js
import { state, effect } from "rahti";

const counter = state(0);

const app = effect(() => {
  const [count, setCount] = counter();

  // protect against infinite loop with the if-clause
  if (count === 0) {
    setCount(1); // nothing will happen yet
  }

  console.log(count); // `count` is still `0` here
  // a bit later `app` will re-run and `count` will be `1`
});

app();
```

## Custom old vs. new value comparison functions

When setting a new value for a State, or passing new arguments to an Effect, the library checks whether the new value matches the previous value. By default they're checked for strict equality: `(oldValue, newValue) => oldValue === newValue`.

This comparison function can be replaced (pass a function), or turned off altogether (pass `false`). DOM Effects use this feature to check for changed attributes and event handlers.

For State, if the new value matches the current value, the new value won't be set, and no re-runs will occur. For Effects, if all new arguments match the old arguments, the Effect will skip running and instead return its previous return value.

```js
import { state, effect } from "rahti";

const counter = state(
  0,
  { areSame: false } // turn off new value equality check
);

const app = effect(() => {
  const [count, setCount] = counter();
  if (count === 0) setCount(1);
  console.log("this should get logged twice");
  child({ hello: "world" });
});

const child = effect(
  ({ hello }) => {
    console.log("this should only get logged once");
  },
  // custom argument comparison function
  { areSame: (oldValue, newValue) => oldValue.hello === newValue.hello }
);

app();
```

## Keyed Effects

By default, the first argument passed to an Effect is used as its key. This key is used to find the Effect when its parent Effect gets re-run. If you use Effects inside conditionals or loops, keys will help prevent useless re-runs and re-initializations.

If you're familiar with keys in React components, this works the same way. The only difference is that instead of `<YourComponent key="blah"/>`, you do `yourEffect("blah")`.

Also similar to React is that Effects of a different type (like p() and strong()) that share the same key won't get confused together. Keys are also scoped to the current parent Effect, so you can't use them to "re-parent" an Effect.

See below for how to customize keys with `getKey`.

```js
import { effect, state, createRoot } from "rahti";

const data = [];
for (let index = 0; index < 10; index++) {
  data.push({ id: Math.random() });
}
const dataStorage = state(
  data,
  (get, set) => () => {
    console.log("Sorting");
    return set(get().sort());
  },
  false
);

const app = effect((root) => {
  const [data, sortData] = dataStorage();

  for (const {} of data) {
    childWithKeys(id);
  }

  root(button("Sort", event("click", sortData)));
});

const childWithKeys = effect((id) => {
  console.log("This should log 10 times initially, and 0 times after clicking the button");
},
// `getKey` receives the same arguments you are passing to your Effect
{ getKey: (firstArgument) => firstArgument } // use the first argument as key (default)

const childWithoutKeys = effect(
  (id) => {
    console.log("This should log 10 times initially, and 10 times after clicking the button");
  },
  undefined,
  { getKey: () => {} } // keys are turned off, because all keys will be the same: `undefined`
);

app(createRoot(document.body));
```

## Global state

A special kind of State where one value is shared by each Effect that accesses it.

```js
import { globalState, effect } from "rahti";

const counter = globalState(0);

const app = effect(() => {
  console.log("this will only log once");
  for (let index = 0; index < 10; index++) {
    child();
  }
});

const child = effect(() => {
  const [count] = counter();
  console.log(count);
});

app();

const [count, setCount] = counter();
setCount(1); // all 10 children will log "1"
```

## Idle Effects

If you mark an effect as `idle`, it will not execute immediately. Instead it will execute using `requestIdleCallback` (or `requestAnimationFrame`, if not available). This also means it will always return `undefined`.

This is handy for any expensive work that isn't needed immediately. For example: I use it to generate map tiles in game development, and have it write the result directly to a WebGL texture.

```js
import { state, effect } from "rahti";

const counter = state(0);

const app = effect(
  (calledAt) => {
    console.log(`This ran ${calledAt - Date.now()} ms later`);
  },
  { idle: true }
);

app(Date.now());
```

## API

```js
import { state, globalState, effect, onCleanup, html, svg, event, createRoot } from "rahti";

const counter = state(
  // the default initial value
  0,
  {
    // whatever this function returns replaces the "setState": [value, THIS_HERE]
    getActions: (get, set) => set,
    // comparison function used when a new value is set,
    // to determine if the new value should take effect and Effects should re-run
    // can be set to `false` to disable checking
    areSame: (oldValue, newValue) => oldValue === newValue,
  }
);

const globalCounter = globalState(0); // same API as above
const [globalCount, setGlobalCount] = globalCounter();

const app = effect(
  // your function
  () => {
    const [count, setCount] = counter();
    const [globalCount, setGlobalCount] = globalCounter();

    console.log("Hello world");

    // Run before the effect is re-run and when it gets destroyed
    onCleanup((isFinal) => {
      // isFinal is true when the effect is being destroyed
      console.log(isFinal ? "Bye world" : "Still here!");
    });
  },
  {
    // comparison function used to check if previous and new arguments match
    // if they match, your function will not re-run and the effect will return its previous value
    // can be set to `false` to disable checking
    areSame: (oldValue, newValue) => oldValue === newValue,
    // determines the key of your effect instance
    // (the real efault is actually a more efficient version of this)
    getKey: (...argumentsYouPassYourEffect) => argumentsYouPassYourEffect[0],
    // if set, this effect always returns `undefined` and is not executed immediately,
    // but on using requestIdleCallback (or requestAnimationFrame if not supported)
    idle: false,
  }
);

// these are proxies, so you can destructure any DOM Effect you want out of them
const { h1, p, button, "my-web-component": myWebComponent } = html;
const { svg: svgRoot, rect } = svg;

// this creates a DOM Effect out of an element of your choosing
const root = createRoot(document.getElementById("root"));

// DOM Effects accept strings, numbers, attributes as objects, event Effects, and other DOM Effects
root(
  h1("Hello"),
  p("World!"),
  myWebComponent("Fancy!"),
  svgRoot(rect({ width: 100, height: 100, fill: "red" })),
  button(
    "Click me!",
    { type: "button", style: "color: red;" },
    // maintains an event handler on its parent, same API as addEventListener
    event("click", () => console.log("Clicked me!"), { passive: true })
  )
);
```

## Server-side rendering with Astro

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
