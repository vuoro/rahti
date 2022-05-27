import { cleanup, component, update } from "./component.js";

export const createGlobalState = (initialValue, actions) => {
  let value = initialValue;
  const states = new Map();
  const cleaners = new Map();

  const getter = () => value;
  const setter = (newValue) => {
    value = newValue;
    for (const [component, state] of states) {
      state[0] = value;
      update(component, true);
    }
  };
  const finalSetter = actions ? actions(getter, setter) : setter;

  const globalState = component(function globalState() {
    let state = states.get(this);

    if (!state) {
      state = [value, finalSetter];
      states.set(this, state);
      cleaners.set(this, (isFinal) => {
        if (isFinal) {
          states.delete(this);
          cleaners.delete(this);
        }
      });
    }

    cleanup(this, cleaners.get(this));
    return state;
  });

  return [globalState, finalSetter];
};
