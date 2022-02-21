import { cleanup, component, update } from "./component.js";

const states = new Map();
const cleaners = new Map();

export const state = component(function state(initialValue, actions) {
  let state = states.get(this);

  if (!state) {
    state = [initialValue];
    const setter = (newValue) => {
      state[0] = newValue;
      update(this);
    };

    if (actions) {
      const getter = () => state[0];
      state.push(actions(getter, setter));
    } else {
      state.push(setter);
    }

    states.set(this, state);

    cleaners.set(this, (isFinal) => {
      if (isFinal) {
        states.delete(this);
        cleaners.delete(this);
      }
    });
  }

  cleanup(this).finally(cleaners.get(this));

  return state;
});
