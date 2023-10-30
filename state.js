import { cleanup, load, save, updateParent } from "./index.js";

export const State = function ({ initialValue, actions }) {
  const state = load(this.id);
  if (state) return state;

  const newState = [initialValue];

  const setter = (newValue) => {
    newState[0] = newValue;
    updateParent(this.id);
  };

  if (actions) {
    const getter = () => newState[0];
    newState[1] = actions(getter, setter);
  } else {
    newState[1] = setter;
  }

  return save(this.id, newState);
};

export const createGlobalState = ({ initialValue, actions } = {}) => {
  let value = initialValue;
  const states = new Map();

  const getter = () => value;
  const setter = (newValue) => {
    value = newValue;
    for (const [id, state] of states) {
      state[0] = value;
      updateParent(id);
    }
  };
  const finalSetter = actions ? actions(getter, setter) : setter;

  const GlobalState = function () {
    let state = states.get(this.id);

    if (!state) {
      state = [value, finalSetter, getter];
      states.set(this.id, state);
    }

    this.run(CleanUp, null, cleanGlobalState);
    return state;
  };

  function cleanGlobalState(isFinal) {
    if (isFinal) {
      states.delete(this.id);
    }
  }

  return [GlobalState, finalSetter, getter];
};
