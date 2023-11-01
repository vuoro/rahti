import { Component, returnPromiseLater } from "./index.js";
import { requestIdleCallbackPonyfilled } from "./requestIdleCallback.js";

let currentResolve = null;
const promiseResolveCatcher = (resolve) => (currentResolve = resolve);
let currentIdlePromise = null;

const idleCallback = (deadline) => {
  currentIdlePromise = null;
  currentResolve(deadline);
};

const getIdlePromise = () => {
  if (!currentIdlePromise) {
    currentIdlePromise = new Promise(promiseResolveCatcher);
    requestIdleCallbackPonyfilled(idleCallback);
  }
  return currentIdlePromise;
};

export const Idle = new Proxy(function Idle() {
  return returnPromiseLater(getIdlePromise());
}, Component);
