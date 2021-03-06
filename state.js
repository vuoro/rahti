import { cleanup, component, update } from "./component.js";

const states = new Map();

export const state = component(function state(initialValue, actions) {
  let state = states.get(this);

  if (!state) {
    state = [initialValue];
    const setter = (newValue) => {
      state[0] = newValue;
      update(this, true);
    };

    if (actions) {
      const getter = () => state[0];
      state.push(actions(getter, setter));
    } else {
      state.push(setter);
    }

    states.set(this, state);
  }

  cleanup(this, cleanState);

  return state;
});

function cleanState(isFinal) {
  if (isFinal) {
    states.delete(this);
  }
}