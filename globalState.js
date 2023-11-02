import { updateParent } from "./component.js";

export const createGlobalState = ({ initialValue }) => {
  let value = initialValue;
  const states = new Map();

  const getter = () => value;
  const setter = (newValue, immediately = false) => {
    value = newValue;
    for (const [instance, state] of states) {
      state[0] = value;
      updateParent(instance, immediately);
    }
  };

  const GlobalState = function () {
    let state = states.get(this);

    if (!state) {
      state = [value, setter, getter];
      states.set(this, state);
    }

    this.cleanup(cleanGlobalState);
    return state;
  };

  function cleanGlobalState() {
    states.delete(this);
  }

  return [GlobalState, setter, getter];
};
