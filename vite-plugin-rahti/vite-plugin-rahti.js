export const rahtiPlugin = () => {
  let config;

  return {
    name: "add-rahti-hmr-handlers",
    apply: "serve",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    transform(src, id) {
      const path = id.split("?")[0];
      if (
        config.command === "build" ||
        config.isProduction ||
        id.includes("?worker") ||
        id.includes("node_modules") ||
        !(path.endsWith(".jsx") || path.endsWith(".tsx"))
      )
        return;

      const fileName = path.split("/").at(-1);

      const code = src + getHmrCode(fileName);
      return { code };
    },
  };
};

const getHmrCode = (fileName) => {
  let hmrInjection = hmrCode.toString().split("\n");
  hmrInjection = hmrInjection.slice(1, hmrInjection.length - 1).join("\n");

  return `if (import.meta.hot) {
  // Rahti HMR handler
  const _rahtiFileName = "${fileName}";

  ${hmrInjection}
}`;
};

const hmrCode = () => {
  // Create HMR registries, if they haven't been already
  globalThis._rahtiHmrOriginalModules = new Map();
  globalThis._rahtiHmrComponentReplacements =
    globalThis._rahtiHmrComponentReplacements || new Map();
  globalThis._rahtiHmrComponentVersions = globalThis._rahtiHmrComponentVersions || new Map();
  globalThis._rahtiHmrInstances = globalThis._rahtiHmrInstances || new Map();

  const seemsLikeComponent = (name, feature) =>
    typeof feature === "function" &&
    name[0] === name[0].toUpperCase() &&
    feature.toString().indexOf("class") !== 0;

  import.meta.hot.accept(async (newModule) => {
    if (!newModule) {
      return import.meta.hot.invalidate("No new module (syntax error?)");
    }

    // Make sure the original module has been fetched
    let originalModule = await globalThis._rahtiHmrOriginalModules.get(_rahtiFileName);
    if (!originalModule) {
      originalModule = await import(/* @vite-ignore */ `./${_rahtiFileName}`);
      globalThis._rahtiHmrOriginalModules.set(_rahtiFileName, originalModule);
    }

    // Go through the new module
    let featuresChecked = 0;

    for (const name in newModule) {
      featuresChecked++;

      const originalFeature = originalModule[name];
      const previousFeature = globalThis._rahtiHmrComponentReplacements.get(originalFeature);
      const newFeature = newModule[name];

      if (!seemsLikeComponent(name, newFeature) || !seemsLikeComponent(name, originalFeature)) {
        return import.meta.hot.invalidate(
          `${name} does not seem to be a Component. HMR only works if the module exports nothing but Components.`,
        );
      }

      // console.log("HMR is updating", name);

      // Mark this as the replacement for the original version
      globalThis._rahtiHmrComponentReplacements.set(originalFeature, newFeature);
      // … and same for the previous version, if there is one
      if (previousFeature) {
        globalThis._rahtiHmrComponentReplacements.set(previousFeature, newFeature);
      }

      // Keep track of Component versions
      let versions = globalThis._rahtiHmrComponentVersions.get(originalFeature);
      if (!versions) {
        versions = new Set();
        globalThis._rahtiHmrComponentVersions.set(originalFeature, versions);
        versions.add(originalFeature);
      }

      for (const version of versions) {
        // Tell instances using any of the now outdated versions to update
        // let instancesUpdated = 0;

        if (globalThis._rahtiHmrInstances.has(version)) {
          for (const instance of globalThis._rahtiHmrInstances.get(version)) {
            // instancesUpdated++;
            if (globalThis._rahtiUpdate) globalThis._rahtiUpdate(instance);
          }
        }

        // console.log("HMR told", instancesUpdated, "instances to update");
      }

      versions.add(newFeature);
    }

    if (featuresChecked === 0) import.meta.hot.invalidate(`No exports`);
  });
};
