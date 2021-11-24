# bad-react (working title)

This is a reactive JS library.

It has State and Effects. If you've used something like React, S.js, or SolidJS you'll probably know how these work. State can change its value and re-runs the Effects the change impacts. (In React terms, Effects do the job of both Components and Hooks.)

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

# Cleanups

Effects can contain cleanups. They run just before the Effect re-runs or gets destroyed. (This is the same as when React Hooks return a cleanup function.)

```js
import { effect, onCleanup } from "bad-react";

const app = effect(() => {
  const interval = setInterval(() => console.log("Hi!"), 1000);
  onCleanup(() => clearInterval(interval));
});

app();
```

# Rendering HTML and SVG

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

# Custom state setters/actions

State "setters" can be customized.

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

# To-do list

- [ ] Keys
- [ ] Global state
- [ ] Fewer bugs
- [ ] Less stupid "reconciler"
- [ ] Server-side rendering with Astro
