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
        id.includes("node_modules") ||
        !(
          path.endsWith(".js") ||
          path.endsWith(".jsx") ||
          path.endsWith(".tx") ||
          path.endsWith(".tsx")
        ) ||
        !src.includes("Component") ||
        !src.includes("new Proxy(")
      ) {
        return;
      }

      const code = src + getHmrCode(id);
      return { code };
    },
  };
};

const getHmrCode = (fileId) => {
  let hmrInjection = hmrCode.toString().split("\n");
  hmrInjection = hmrInjection.slice(1, hmrInjection.length - 1).join("\n");

  return `import * as thisModule from /* @vite-ignore */"${fileId}";
if (import.meta.hot) {
  // Rahti HMR handler
  const _rahtiFileName = "${fileId}";
  ${hmrInjection}
}`;
};

const hmrCode = () => {
  // Create HMR registries, if they haven't been already
  globalThis._rahtiHmrOriginalModules = globalThis._rahtiHmrOriginalModules || new Map();
  globalThis._rahtiHmrComponentReplacements =
    globalThis._rahtiHmrComponentReplacements || new Map();
  globalThis._rahtiHmrComponentVersions = globalThis._rahtiHmrComponentVersions || new Map();
  globalThis._rahtiHmrInstances = globalThis._rahtiHmrInstances || new Map();

  // Save the original version of this module
  if (!globalThis._rahtiHmrOriginalModules.has(_rahtiFileName)) {
    // console.log("First glimpse of", _rahtiFileName, thisModule);
    globalThis._rahtiHmrOriginalModules.set(_rahtiFileName, thisModule);

    // Start registries for components in it

    for (const name in thisModule) {
      const code = thisModule[name]?._rahtiCode;
      if (code) {
        // console.log("Starting registries for", name);
        globalThis._rahtiHmrInstances.set(code, new Set());
        globalThis._rahtiHmrComponentVersions.set(code, new Set([code]));
      }
    }
  }

  import.meta.hot.accept((newModule) => {
    if (!newModule) {
      return import.meta.hot.invalidate("No new module (syntax error?)");
    }

    // Go through the new module
    const originalModule = globalThis._rahtiHmrOriginalModules.get(_rahtiFileName);
    let featuresChecked = 0;

    for (const name in newModule) {
      featuresChecked++;

      const originalCode = originalModule[name]?._rahtiCode;
      const previousCode = globalThis._rahtiHmrComponentReplacements.get(originalCode);
      const newCode = newModule[name]?._rahtiCode;

      if (!newCode || !originalCode) {
        // FIXME: I would import.meta.hot.invalidate here,
        // but the self-import seems to throw it into an infinite loop.
        return console.warn(
          `[vite-plugin-rahti] \`${name}\` does not seem to be a Component. HMR only works reliably if the module exports nothing but Components.`,
        );
      }

      // console.log("HMR is updating", name, globalThis._rahtiHmrInstances.get(originalCode));

      // Mark this as the replacement for the original version
      globalThis._rahtiHmrComponentReplacements.set(originalCode, newCode);
      // … and same for the previous version, if there is one
      if (previousCode) {
        globalThis._rahtiHmrComponentReplacements.set(previousCode, newCode);
      }

      // Keep track of Component versions
      const versions = globalThis._rahtiHmrComponentVersions.get(originalCode);
      let instancesUpdated = 0;

      // Tell instances using any of the now outdated versions to update
      for (const version of versions) {
        if (globalThis._rahtiHmrInstances.has(version)) {
          for (const instance of globalThis._rahtiHmrInstances.get(version)) {
            instancesUpdated++;
            if (globalThis._rahtiUpdate) globalThis._rahtiUpdate(instance);
          }
        }
      }

      versions.add(newCode);
      console.log(`[vite-plugin-rahti] hot updated: ${instancesUpdated} instances of ${name}`);
    }

    if (featuresChecked === 0) import.meta.hot.invalidate("No exports");
  });
};
