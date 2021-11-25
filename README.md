# bad-react (working title)

A reactive JS library, with the goals of: composing reactive JS without JSX or tagged template literals, having no compile step, and having low garbage generation at runtime.

There are State and Effects. If you've used something like React, S.js, or SolidJS you'll probably know how these work. State can change its value and re-runs the Effects the change impacts. (In React terms, Effects do the job of both Components and Hooks.)

```js
import { state, effect } from "bad-react";

const counter = state(0);

const app = effect(() => {
  const [count, setCount] = counter();
  console.log(count);
  setTimeout(() => setCount(count + 1), 1000);
});

app();
```

## Rendering HTML and SVG

There are built-in DOM Effects for rendering HTML and SVG. They're not going to top any benchmarks though. There's no "VDOM", "fine reactivity", or anything like that. The "reconciler" — if you can call it that — is also really dumb.

One rule to remember: DOM Effects must be passed as arguments to another DOM Effect. Otherwise they won't know where to mount. There also needs to be a root DOM Effect, created using `createRoot`.

DOM Effects also accept other arguments:

- text/numbers turn into text fragments
- objects will be set as attributes
- arrays containing DOM Effects are also accepted (works like React's Fragments)
- `event` maintains an event handler on its parent DOM Effect

```js
import { createRoot, effect, html, svg, event } from "bad-react";
const { p, button } = html;

const app = (root) => {
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

    [p("contrived"), p("array"), p("example")]
  );
};

app(createRoot(document.body));
```

## Cleanups

Effects can contain cleanups. They run just before the Effect re-runs or gets destroyed. (This is the same as when React Hooks return a cleanup function.)

```js
import { effect, onCleanup } from "bad-react";

const app = effect(() => {
  const interval = setInterval(() => console.log("Hi!"), 1000);
  onCleanup(() => clearInterval(interval));
});

app();
```

## Custom state setters/actions

The `setState` function returned by State can be replaced, with for example an object containing "actions" similar to what you see in many third-party React state management libraries.

```js
import { state, effect } from "bad-react";

const counter = state(0, (get, set) => ({
  increment: () => set(get() + 1),
  decrement: () => set(get() - 1),
}));

const app = effect(() => {
  const [count, { increment }] = counter();
  console.log(count);
  setTimeout(increment, 1000);
});

app();
```

## Setting state during rendering

Much like in React, you can use `setState` during "rendering": while an Effect is executing. The new value won't take effect or cause reruns immediately. Instead it will be delayed until the next `requestIdleCallback` (or `requestAnimationFrame` if not available). If you use this feature, be careful of infinite loops!

```js
import { state, effect } from "bad-react";

const counter = state(0);

const app = effect(() => {
  const [count, setCount] = counter();
  if (count === 0) {
    // protect against infinite loop
    setCount(1); // nothing will happen yet
  }
  console.log(count); // `count` is still `0` here
  // a bit later `app` will rerun and `count` will be `1`
});

app();
```

<!-- ## Global state

A special kind of State where one value is shared by each Effect that accesses it.

```js
import { globalState, effect } from "bad-react";

const counter = globalState(0);

const app = effect(() => {
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
``` -->

# To-do list

- [ ] Keys
- [ ] Global state
- [ ] Fewer bugs
- [ ] Less stupid "reconciler"
- [ ] Server-side rendering with Astro
