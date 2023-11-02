import { updateParent } from "./component.js";

export const State = function ({ initialValue }) {
  const state = this.load();
  if (state) return state;

  const id = this.id;

  const newState = [
    initialValue,
    (newValue, immediately = false) => {
      newState[0] = newValue;
      updateParent(id, immediately);
    },
    () => newState[0],
  ];

  return this.save(newState);
};
