# bad-react (working title)

A reactive JS library, with the goals of: composing reactive JS without JSX or tagged template literals, having no compile step, and having low garbage generation at runtime.

## State and Effects

If you've used something like React, S.js, or SolidJS you'll probably know how these work. State can change its value and re-runs the Effects the change impacts. (In React terms, Effects do the job of both Components and Hooks.)

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

## Custom State setters/actions, and initial values

The `setState` function returned by State can be replaced, with for example an object containing "actions" similar to what you see in many third-party React state management libraries.

The default initial value of a State can be set when defining the it: `const counter = state(0)`, but it can be overridden when first using it: `counter(100)`.

```js
import { state, effect } from "bad-react";

const counter = state(0, (get, set) => ({
  increment: () => set(get() + 1),
  decrement: () => set(get() - 1),
}));

const app = effect(() => {
  const [count, { increment }] = counter(100); // this will start off at `100` instead of `0`
  console.log(count);
  setTimeout(increment, 1000);
});

app();
```

## Setting state during rendering

Much like in React, you can use `setState` during "rendering": while an Effect is running. The new value won't take effect or cause re-runs immediately. Instead it will be delayed until the next `requestIdleCallback` (or `requestAnimationFrame` if not available).

If you use this feature, be careful of infinite loops!

```js
import { state, effect } from "bad-react";

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

## Custom new vs. old value comparison functions

When setting a new value for a State, or passing new arguments to an Effect, the library checks whether the new value matches the previous value. By default they're checked for strict equality: `(new, old) => new === old`.

This comparison function can be replaced (pass a function), or turned off altogether (pass `false`).

For State, if the new value matches the current value, the new value won't be set, and no re-runs will occur. For Effects, if all new arguments match the old arguments, the Effect will skip running and instead return its previous return value. (The DOM Effects use this feature to check for changed attributes and event handlers.)

```js
import { state, effect } from "bad-react";

const counter = state(
  0,
  undefined, // use default setter
  false // turn off comparisons
);

const app = effect(() => {
  const [count, setCount] = counter();
  if (count === 0) setCount(1);

  child({ hello: "world" });
});

const child = effect(
  ({ hello }) => {
    console.log(hello); // this should only get logged once
  },
  // custom comparison function
  (old, new) => old.hello === new.hello
);

app();
```

<!-- ## Keyed State and Effects

When using State or Effects conditionally or inside loops, be sure to use keys. These work the same way as Component keys in React: the key helps the library find the correct instance, even if it moves around or something else takes its place.

As in React, Effects of a different type (like p() and strong()) sharing the same key won't get confused together. Keys are also scoped to the current parent Effect, so you can't use them to "re-parent" an Effect.

```js
import { effect, state, createRoot } from "bad-react";

const data = [];
for (let index = 0; index < 100; index++) {
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

  for (const { id } of data) {
    child.key(id)();
  }

  root(button("Sort", event("click", sortData)));
});

const child = effect(() => {
  console.log("This should log 100 times initially, and 0 times after clicking the button");
});

app(createRoot(document.body));
``` -->

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
- [x] Fewer bugs
- [ ] Less stupid "reconciler"
- [ ] Server-side rendering with Astro
