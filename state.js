import { update } from "./component.js";

const states = new WeakMap();

export const state = function (initialValue, actions) {
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
  }

  return state;
};
