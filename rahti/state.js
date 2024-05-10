import { Component, getInstance, load, save, updateParent } from "./component.js";

export const State = new Proxy(function (initialValue) {
  const state = load();
  if (state) return state;

  const instance = getInstance();

  const newState = [
    initialValue,
    (newValue, immediately = false) => {
      newState[0] = newValue;
      updateParent(instance, immediately);
    },
    () => newState[0],
  ];

  return save(newState);
}, Component);
