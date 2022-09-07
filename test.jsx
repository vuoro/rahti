import { rahti, idle, createGlobalState, State, Mount } from "./index.js";

const [GlobalTest, setGlobalTest] = createGlobalState(0);
setInterval(setGlobalTest, 1000, Math.random());

const TestWrapper = async function () {
  const [testValue, setGlobalTest] = <GlobalTest />;
  const [counter, setState] = <State initialValue={0} />;
  setTimeout(setState, 3500, counter + 1);

  let deadline = await idle();

  const testComponents = [];
  const max = 10;
  for (let index = 0; index < (0.5 + 0.5 * Math.random()) * max; index++) {
    if (deadline.timeRemaining() <= 0) deadline = await idle();
    if (Math.random() > 0.1) testComponents.push(await (<TestItem>{counter}</TestItem>));
  }

  return (
    <>
      <p style="color: red">If there's ever over {max} items here, something is wrong.</p>
      <style>
        {`
          * { 
            animation: enter 1000ms ease-out;
            outline: 2px solid transparent;
          }

          @keyframes enter {
            0% { outline-color: rgba(255,0,0, 0.618) }
            100% { outline-color: transparent; }
          }
        `}
      </style>
      <ol
        class="lol"
        events={{
          click: console.log,
        }}
      >
        {testComponents}
      </ol>
      <div>This is the bottom</div>
    </>
  );
};

const TestItem = async function (counter) {
  const [value, setValue] = <State></State>;

  setTimeout(setValue, Math.random() * 20000, Math.random());
  if (Math.random() < 0.01) throw new Error();

  await idle();

  return (
    <li>
      <input
        type="checkbox"
        checked={value > 0.5}
        events={{
          click: console.log,
        }}
      />{" "}
      {value > 0.5} {counter} / {value}
    </li>
  );
};

const App = async function (hello) {
  console.log(hello, "world");
  <Mount to={document.body}>
    {await (<TestWrapper />)}
    <svg>
      <svg:a></svg:a>
    </svg>
    <p></p>
  </Mount>;
};

rahti(App, null, "Hello");
