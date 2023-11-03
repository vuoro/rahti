import { updateParent } from "./../rahti/rahti.js";

export const preRenderJobs = new Set();
export const renderJobs = new Set();
export const postRenderJobs = new Set();
let frameNumber = 0;
let totalSubscribers = 0;
let frame = null;

const subscribers = new Set();

export const subscribeToAnimationFrame = (callback) => {
  if (!subscribers.has(callback)) {
    subscribers.add(callback);
    totalSubscribers++;
    frame = frame || requestAnimationFrame(runAnimationFrame);
  }
};

export const unsubscribeFromAnimationFrame = (callback) => {
  if (subscribers.has(callback)) {
    subscribers.delete(callback);
    totalSubscribers--;
  }
};

const componentSubscribers = new Set();

const componentProps = { timestamp: performance.now(), sinceLastFrame: 1, frameNumber: 0 };
const runComponents = (timestamp, sinceLastFrame, frameNumber) => {
  componentProps.timestamp = timestamp;
  componentProps.sinceLastFrame = sinceLastFrame;
  componentProps.frameNumber = frameNumber;

  for (const instance of componentSubscribers) {
    updateParent(instance, true);
  }
};

export const AnimationFrame = function () {
  componentSubscribers.add(this);
  this.save(this);
  this.cleanup(cleanAnimationFrame);
  subscribeToAnimationFrame(runComponents);

  return componentProps;
};

function cleanAnimationFrame(instance) {
  componentSubscribers.delete(instance);
  if (componentSubscribers.size === 0) unsubscribeFromAnimationFrame(runComponents);
}

export const requestPreRenderJob = (job) => {
  preRenderJobs.add(job);
  frame = frame || requestAnimationFrame(runAnimationFrame);
};
export const requestRenderJob = (job) => {
  renderJobs.add(job);
  frame = frame || requestAnimationFrame(runAnimationFrame);
};
export const requestPostRenderJob = (job) => {
  postRenderJobs.add(job);
  frame = frame || requestAnimationFrame(runAnimationFrame);
};

export const cancelPreRenderJob = (job) => preRenderJobs.delete(job);
export const cancelRenderJob = (job) => renderJobs.delete(job);

export const cancelJobsAndStopFrame = () => {
  if (frame) {
    cancelAnimationFrame(frame);
    frame = null;
  }

  preRenderJobs.clear();
  renderJobs.clear();
  postRenderJobs.clear();
};

let lastTime = performance.now();

const runAnimationFrame = () => {
  // Using performance.now() here because in Safari the timestamp
  // passed by RAF is currently not a DOMHighResTimeStamp.
  // I don't know why.
  const timestamp = performance.now();
  const sinceLastFrame = Math.min(timestamp - lastTime, 100);
  lastTime = timestamp;

  for (const callback of subscribers) {
    callback(timestamp, sinceLastFrame, frameNumber);
  }

  for (const job of preRenderJobs) {
    preRenderJobs.delete(job);
    job();
  }

  for (const job of renderJobs) {
    renderJobs.delete(job);
    job(timestamp, sinceLastFrame, frameNumber);
  }

  for (const job of postRenderJobs) {
    postRenderJobs.delete(job);
    job();
  }

  frameNumber++;

  if (totalSubscribers !== 0) {
    frame = requestAnimationFrame(runAnimationFrame);
  } else {
    frame = null;
  }
};
