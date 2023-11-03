import { updateParent } from "./component.js";

export const State = function ({ initialValue }, initialValueFromArgs) {
  const state = this.load();
  if (state) return state;

  const instance = this;

  const newState = [
    initialValue === undefined ? initialValueFromArgs : initialValue,
    (newValue, immediately = false) => {
      newState[0] = newValue;
      updateParent(instance, immediately);
    },
    () => newState[0],
  ];

  return this.save(newState);
};
