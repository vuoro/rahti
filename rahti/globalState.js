import { Component, cleanup, getInstance, updateParent } from "./component.js";

export const GlobalState = new Proxy((initialValue) => {
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

  const State = new Proxy(function () {
    instances.add(getInstance());
    cleanup(cleanState);
    return state;
  }, Component);

  function cleanState(_, instance) {
    instances.delete(instance);
  }

  return [State, state[1], state[2]];
}, Component);
