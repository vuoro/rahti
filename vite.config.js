import { rahtiPlugin } from "./vite-plugin-rahti/vite-plugin-rahti.js";

export default {
  plugins: [rahtiPlugin()],
  esbuild: {
    jsxFactory: "this.run",
    jsxFragment: "'rahti:fragment'",
    jsxSideEffects: true,
  },
};
