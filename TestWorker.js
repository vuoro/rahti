import { WorkerLogger } from "./WorkerLogger.js";
import { rahti } from "./rahti/component.js";

console.log("Hello from worker");

rahti.run(WorkerLogger);
