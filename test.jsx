import { rahti, idle, createGlobalState, State, Mount, CleanUp } from "./index.js";

const [GlobalTest, setGlobalTest] = createGlobalState(0);
setInterval(() => setGlobalTest(Math.random()), 3000);

const TestWrapper = async function () {
  <GlobalTest />;
  const [counter, setState] = <State initialValue={0} />;
  const timer = setTimeout(setState, 3500, counter + 1);
  <CleanUp cleaner={() => clearTimeout(timer)} />;

  let deadline = await idle();

  const testComponents = [];
  const max = 20;
  for (let index = 0; index < (0.5 + Math.random() * 0.5) * max; index++) {
    if (deadline.timeRemaining() <= 0) deadline = await idle();
    try {
      if (Math.random() > 0.1)
        testComponents.push(await (<TestItem counter={counter} index={testComponents.length} />));
    } catch (e) {}
  }

  return (
    <>
      <p style="color: red">
        Something is wrong if: a) there's ever <em>consistently</em> over {max} items here, b){" "}
        <em>every</em> element is flashing red on updates.
      </p>
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
      <div>an SVG follows:</div>
    </>
  );
};

const TestItem = async function ({ parentValue, index }) {
  const [local, setLocal] = <State initialValue={0} />;
  const [global] = <GlobalTest />;

  const timer = setTimeout(setLocal, Math.random() * 10000, Math.random());
  <CleanUp cleaner={() => clearTimeout(timer)} />;
  if (Math.random() < 0.05) throw new Error();

  await idle();

  return (
    <li>
      {index + 1}
      <input
        type="checkbox"
        checked={local > 0.5}
        events={{
          click: console.log,
        }}
      />{" "}
      Parent: {parentValue} / Global: {global} / Local: {local}
    </li>
  );
};

const App = async function (props, hello) {
  console.log("========", hello, "world");
  <Mount to={document.body}>
    {await (<TestWrapper />)}
    <svg:svg>
      <svg:rect fill="none" stroke="black" width="300" height="150" />
    </svg:svg>
  </Mount>;
};

rahti.run(App, null, "Hello");
