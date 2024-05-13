import { Component, cleanup, getInstance } from "../rahti/component.js";
import { requestPreRenderJob } from "./animationFrame.js";
import { Buffer } from "./buffer.js";

export const Instances = new Proxy(function ({ context, attributes: attributeMap }) {
  const attributes = new Map();
  const defaultValues = new Map();
  const attributeViews = new Map();

  for (const key in attributeMap) {
    const value = attributeMap[key];

    const data = [value];
    const bufferObject = Buffer({ context, data, usage: "DYNAMIC_DRAW" });
    const { Constructor } = bufferObject;

    attributes.set(key, bufferObject);
    defaultValues.set(key, value.length ? new Constructor(value) : new Constructor(data));
    attributeViews.set(key, new Map());
  }

  const additions = new Set();
  const deletions = new Set();

  const instancesToSlots = new Map();
  const slotsToInstances = new Map();

  const freeSlots = [];
  const changes = new Map();
  const orphans = new Map();

  const buildInstances = () => {
    if (dead) return;

    const oldSize = instancesToSlots.size;
    const newSize = oldSize + additions.size - deletions.size;

    // Mark deletions as free slots
    for (const instance of deletions) {
      const slot = instancesToSlots.get(instance);
      instancesToSlots.delete(instance);
      slotsToInstances.delete(slot);

      for (const [key] of attributes) {
        attributeViews.get(key).delete(instance);
      }

      if (slot < newSize) {
        freeSlots.push(slot);
      }
    }

    // Mark orphans
    for (let slot = newSize; slot < oldSize; slot++) {
      const instance = slotsToInstances.get(slot);

      for (const [key] of attributes) {
        attributeViews.get(key).delete(instance);
      }

      if (instance) {
        orphans.set(instance, slot);
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
    for (const [instance] of orphans) {
      const slot = freeSlots.pop();
      instancesToSlots.set(instance, slot);
      slotsToInstances.set(slot, instance);
      changes.set(instance, slot);
    }

    // Resize TypedArrays if needed
    for (const [key, { allData, Constructor, dimensions, set }] of attributes) {
      let newData = allData;
      const views = attributeViews.get(key);

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
        // Orphans use the value from their previous slot
        if (orphans.has(instance)) {
          const oldSlot = orphans.get(instance);

          if (dimensions === 1) {
            newData[slot] = allData[oldSlot];
          } else {
            newData.set(
              allData.subarray(oldSlot * dimensions, oldSlot * dimensions + dimensions),
              slot * dimensions,
            );
          }
          // Others use their already set value or the default value
        } else {
          const value = views.has(instance) ? views.get(instance) : defaultValues.get(key);
          newData.set(value, slot * dimensions);
        }

        // Delete now invalid views
        views.delete(instance);
      }

      // If a new array was created, views are all invalid
      if (newSize > oldSize) {
        views.clear();
      }

      set(newData);
    }

    deletions.clear();
    additions.clear();
    orphans.clear();
    changes.clear();
  };

  const InstanceComponent = new Proxy(function () {
    cleanup(cleanInstance);
    if (dead) return;

    const instance = getInstance();
    deletions.delete(instance);
    additions.add(instance);
    requestPreRenderJob(buildInstances);

    return new Proxy(
      {},
      {
        get: function (_, key) {
          // This poor man's updater proxy assumes the whole attribute will be updated
          // whenever it's accessed.
          const { allData, Constructor, dimensions, markAsNeedingUpdate } = attributes.get(key);
          const views = attributeViews.get(key);

          // Additions get a dummy view, which will be deleted later
          // Buffer will be updated on additions, so no need to mark as needing update
          if (additions.has(instance)) {
            if (views.has(instance)) return views.get(instance);

            const view = new Constructor(defaultValues.get(key));
            views.set(instance, view);
            return view;
          }

          // Non-additions get a real view, generated on demand
          // Impacted buffer range will be marked as needing update
          const slot = instancesToSlots.get(instance);
          const index = slot * dimensions;
          markAsNeedingUpdate(index, index + dimensions);

          if (views.has(instance)) return views.get(instance);

          const view = allData.subarray(index, index + dimensions);
          views.set(instance, view);
          return view;
        },
      },
    );
  }, Component);

  function cleanInstance(_, instance, isBeingDestroyed) {
    if (isBeingDestroyed) {
      if (additions.has(instance)) {
        // Deleted before ever getting added
        additions.delete(instance);
        for (const [key] of attributes) {
          attributeViews[key].delete(instance);
        }
      } else {
        deletions.add(instance);
        requestPreRenderJob(buildInstances);
      }
    }
  }

  let dead = false;

  cleanup(() => {
    dead = true;
  });

  InstanceComponent._attributes = attributes;
  InstanceComponent._instancesToSlots = instancesToSlots;

  return InstanceComponent;
}, Component);
