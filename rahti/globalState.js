import { updateParent } from "./component.js";

export const createGlobalState = ({ initialValue }) => {
  const instances = new Set();
  const state = [
    initialValue,
    (newValue, immediately = false) => {
      state[0] = newValue;
      for (const instance of instances) {
        updateParent(instance, immediately);
      }
    },
    () => state[0],
  ];

  const GlobalState = function () {
    instances.add(this);
    this.cleanup(cleanGlobalState);
    return state;
  };

  function cleanGlobalState() {
    instances.delete(this);
  }

  return [GlobalState, state[1], state[2]];
};
