import { requestPreRenderJob } from "./animationFrame.js";
import { Buffer } from "./buffer.js";

export const Instances = function ({ context, attributes: attributeMap }) {
  const attributes = new Map();

  for (const key in attributeMap) {
    const value = attributeMap[key];

    const data = [value];
    const bufferObject = this.run(Buffer, { context, data, usage: "DYNAMIC_DRAW" });
    const { Constructor } = bufferObject;

    bufferObject.defaultValue = value.length ? new Constructor(value) : new Constructor(data);

    attributes.set(key, bufferObject);
  }

  const additions = new Set();
  const deletions = new Set();

  const instancesToSlots = new Map();
  const slotsToInstances = new Map();
  const datas = new Map();

  const freeSlots = [];
  const changes = new Map();
  const orphans = new Set();

  const buildInstances = () => {
    if (dead) return;

    const oldSize = instancesToSlots.size;
    const newSize = oldSize + additions.size - deletions.size;

    // Mark deletions as free slots
    for (const instance of deletions) {
      const slot = instancesToSlots.get(instance);
      instancesToSlots.delete(instance);
      slotsToInstances.delete(slot);

      if (slot < newSize) {
        freeSlots.push(slot);
      }
    }

    // Mark orphans
    for (let slot = newSize; slot < oldSize; slot++) {
      const instance = slotsToInstances.get(slot);

      if (instance) {
        orphans.add(instance);
        instancesToSlots.delete(instance);
        slotsToInstances.delete(slot);
      }
    }

    // Add new instances
    for (const instance of additions) {
      const slot = freeSlots.length ? freeSlots.pop() : instancesToSlots.size;
      instancesToSlots.set(instance, slot);
      slotsToInstances.set(slot, instance);
      changes.set(instance, slot);
    }

    // Move orphans into remaining slots
    for (const instance of orphans) {
      const slot = freeSlots.pop();
      instancesToSlots.set(instance, slot);
      slotsToInstances.set(slot, instance);
      changes.set(instance, slot);
    }

    // Resize TypedArrays if needed
    for (const [key, { allData, Constructor, dimensions, set, defaultValue }] of attributes) {
      let newData = allData;

      if (newSize !== oldSize) {
        if (newSize <= oldSize) {
          // slice old array
          newData = allData.subarray(0, newSize * dimensions);
        } else {
          // create new array
          newData = new Constructor(newSize * dimensions);
          newData.set(allData);
        }
      }

      // And fill in the changes
      for (const [instance, slot] of changes) {
        let value = datas.get(instance)?.[key];
        if (value === undefined) value = defaultValue;

        if (dimensions === 1) {
          newData[slot] = value;
        } else {
          newData.set(value, slot * dimensions);
        }
      }

      set(newData);
    }

    deletions.clear();
    additions.clear();
    orphans.clear();
    changes.clear();
  };

  const InstanceComponent = function (_, data) {
    this.cleanup(cleanInstance);
    if (dead) return;

    // FIXME: accursed async programming issues
    this.defaultNeedsUpdate = true;
    deletions.delete(this);

    const slot = instancesToSlots.get(this);
    datas.set(this, data);

    if (slot === undefined) {
      additions.add(this);
      requestPreRenderJob(buildInstances);
    } else {
      for (const [key, { dimensions, update, defaultValue, allData }] of attributes) {
        let value = data?.[key];
        if (value === undefined) value = defaultValue;
        const offset = dimensions * slot;

        let hasChanged = false;

        if (dimensions === 1) {
          hasChanged = allData[offset] !== value;
        } else {
          for (let index = 0; index < dimensions; index++) {
            hasChanged = allData[offset + index] !== value[index];
            if (hasChanged) break;
          }
        }

        if (hasChanged) update(value, offset);
      }
    }
  };

  function cleanInstance(_, isBeingDestroyed) {
    if (isBeingDestroyed) {
      datas.delete(this);

      if (additions.has(this)) {
        additions.delete(this);
      } else {
        deletions.add(this);
        requestPreRenderJob(buildInstances);
      }
    }
  }

  let dead = false;

  this.cleanup(() => {
    dead = true;
  });

  InstanceComponent._attributes = attributes;
  InstanceComponent._instancesToSlots = instancesToSlots;

  return InstanceComponent;
};
