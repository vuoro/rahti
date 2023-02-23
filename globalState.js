import { CleanUp, updateParent } from "./component.js";

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

    this.run(CleanUp, { cleaner: cleanGlobalState });
    return state;
  };

  function cleanGlobalState(isFinal) {
    if (isFinal) {
      states.delete(this.id);
    }
  }

  return [GlobalState, finalSetter, getter];
};
