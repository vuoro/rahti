export const rahtiPlugin = () => {
  return {
    name: "add-rahti-hmr-handlers",
    apply: "serve",
    transform(src, id) {
      if (id.includes("node_modules") || !(id.endsWith(".jsx") || id.endsWith(".tsx"))) return;

      const code = src + "\n\n // Rahti HMR handler \n" + hmrInjection;
      return { code };
    },
  };
};

const hmrCode = () => {
  if (import.meta.hot) {
    const seemsLikeComponent = (name, feature) =>
      typeof feature === "function" &&
      name[0] === name[0].toUpperCase() &&
      feature.toString().indexOf("class") !== 0;

    import.meta.hot.accept((newModule) => {
      if (!newModule) {
        return import.meta.hot.invalidate("No new module (syntax error?)");
      }

      let featuresChecked = 0;

      for (const name in newModule) {
        featuresChecked++;
        const newFeature = newModule[name];

        // console.log("Handling HMR for", name);

        if (!seemsLikeComponent(name, newFeature)) {
          return import.meta.hot.invalidate(`${name} does not seem to be a Component`);
        }

        const seenComponentVersions = globalThis._rahtiHmrComponentVersionsRegistry;
        const componentRegistry = globalThis._rahtiHmrComponentRegistry;
        const instanceRegistry = globalThis._rahtiHmrInstanceRegistry;

        if (!seenComponentVersions.has(name)) {
          return import.meta.hot.invalidate(`No Component named ${name} has been seen before`);
        }

        const seenComponentVersionsWithThisName = seenComponentVersions.get(name);
        // console.log(
        //   `- Associating ${seenComponentVersionsWithThisName.size} previous versions in the Component registry`,
        // );

        for (const Component of seenComponentVersionsWithThisName) {
          componentRegistry.set(Component, newFeature);
        }

        seenComponentVersionsWithThisName.add(newFeature);

        const registry = instanceRegistry.get(name);
        let instancesUsingComponentWithThisName = 0;

        if (registry) {
          for (const instance of registry) {
            globalThis._rahtiUpdate(instance);
            instancesUsingComponentWithThisName++;
          }
        }

        // console.log("- Told", instancesUsingComponentWithThisName, "instances to update for HMR");
      }

      if (featuresChecked === 0) import.meta.hot.invalidate(`No exports`);
    });
  }
};

let hmrInjection = hmrCode.toString().split("\n");
hmrInjection = hmrInjection.slice(1, hmrInjection.length - 1).join("\n");
