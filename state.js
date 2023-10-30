import { getId, getParentId, load, save, update } from "./index.js";

export const State = function (initialValue) {
  const state = load();
  if (state) return state;

  let value = initialValue;
  const parents = new Set();
  const parentId = getParentId();
  if (parentId !== undefined) parents.add(parentId);

  const getter = () => {
    const parentId = getId();
    if (parentId !== undefined) parents.add(parentId);

    return value;
  };

  const setter = (newValue) => {
    value = newValue;

    for (const parentId of parents) {
      update(parentId);
    }

    return newValue;
  };

  const newState = [getter, setter, parents];

  return save(newState);
};
