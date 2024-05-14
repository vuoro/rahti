import { Component } from "./rahti/component.js";

export const WorkerLogger = new Proxy(function () {
  console.log("Hello from worker component");
}, Component);
