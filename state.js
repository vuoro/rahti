import { CleanUp, updateParent } from "./component.js";

const states = new Map();

export const State = function ({ initialValue, actions }) {
  let state = states.get(this.id);

  if (!state) {
    state = [initialValue];
    const setter = (newValue) => {
      state[0] = newValue;
      updateParent(this.id);
    };

    if (actions) {
      const getter = () => state[0];
      state.push(actions(getter, setter));
    } else {
      state.push(setter);
    }

    states.set(this.id, state);
  }

  this.run(CleanUp, { cleaner: cleanState });

  return state;
};

function cleanState(isFinal) {
  if (isFinal) {
    states.delete(this.id);
  }
}
