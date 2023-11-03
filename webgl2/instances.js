import { preRenderJobs, requestPreRenderJob } from "./animation-frame.js";
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

  const additions = new Map();
  const deletions = new Set();

  const instancesToSlots = new Map();
  const slotsToInstances = new Map();
  const datas = new Map();

  const freeSlots = [];
  const changes = new Map();
  const orphans = new Set();

  const buildInstances = () => {
    const oldSize = instancesToSlots.size;
    const newSize = oldSize + additions.size - deletions.size;

    // Mark deletions as free slots
    for (const instance of deletions) {
      const slot = instancesToSlots.get(instance);
      instancesToSlots.delete(instance);
      slotsToInstances.delete(slot);
      datas.delete(instance);

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
    for (const [instance, data] of additions) {
      const slot = freeSlots.length ? freeSlots.pop() : instancesToSlots.size;
      datas.set(instance, data);
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

    // Create new typedarrays
    for (const [key, { allData, Constructor, dimensions, set, defaultValue }] of attributes) {
      let newData;

      if (newSize <= oldSize) {
        // slice old array
        newData = allData.subarray(0, newSize * dimensions);
      } else {
        // create new array
        newData = new Constructor(newSize * dimensions);
        newData.set(allData);
      }

      // And fill in the changes
      for (const [instance, slot] of changes) {
        const data = datas.get(instance);

        const isMap = data instanceof Map;
        const isObject = data instanceof Object;
        const value = isMap
          ? data.has(key)
            ? data.get(key)
            : defaultValue
          : isObject && key in data
          ? data[key]
          : defaultValue;

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

  const InstanceCreator = function (props, data) {
    const { id } = this;
    const isNew = !instancesToSlots.has(id);

    if (isNew) {
      additions.set(id, data);
      requestPreRenderJob(buildInstances);
    } else if (data) {
      datas.set(id, data);

      const isMap = data instanceof Map;
      const isObject = data instanceof Object;

      for (const [key, { dimensions, update, defaultValue, allData }] of attributes) {
        const value = isMap
          ? data.has(key)
            ? data.get(key)
            : defaultValue
          : isObject && key in data
          ? data[key]
          : defaultValue;

        const offset = dimensions * instancesToSlots.get(id);

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

    this.save(id);
    this.cleanup(cleanInstance);

    return id;
  };

  function cleanInstance(id) {
    if (additions.has(id)) {
      additions.delete(id);
    } else if (!dead) {
      deletions.add(id);
      requestPreRenderJob(buildInstances);
    }
  }

  InstanceCreator.rahti_attributes = attributes;
  InstanceCreator.rahti_instances = instancesToSlots;

  let dead = false;
  this.cleanup(() => {
    preRenderJobs.delete(buildInstances);
    dead = true;
  });

  return InstanceCreator;
};
