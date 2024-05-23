import TestWorker from "./TestWorker.js?worker";
import { App } from "./testApp.js";

new TestWorker();

App("hello");
