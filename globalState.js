import { updateParent } from "./component.js";

export const createGlobalState = ({ initialValue }) => {
  let value = initialValue;
  const states = new Map();

  const getter = () => value;
  const setter = (newValue, immediately = false) => {
    value = newValue;
    for (const [id, state] of states) {
      state[0] = value;
      updateParent(id, immediately);
    }
  };

  const GlobalState = function () {
    let state = states.get(this.id);

    if (!state) {
      state = [value, setter, getter];
      states.set(this.id, state);
    }

    this.cleanup(cleanGlobalState);
    return state;
  };

  function cleanGlobalState() {
    states.delete(this.id);
  }

  return [GlobalState, setter, getter];
};
