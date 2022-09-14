import { CleanUp, update } from "./component.js";

export const createGlobalState = ({ initialValue, actions } = {}) => {
  let value = initialValue;
  const states = new Map();

  const getter = () => value;
  const setter = (newValue) => {
    value = newValue;
    for (const [id, state] of states) {
      state[0] = value;
      update(id, true);
    }
  };
  const finalSetter = actions ? actions(getter, setter) : setter;

  const GlobalState = function () {
    let state = states.get(this.id);

    if (!state) {
      state = [value, finalSetter];
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

  return [GlobalState, finalSetter];
};
