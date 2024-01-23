import { WorkerLogger } from "./WorkerLogger.jsx";
import { rahti } from "./rahti/component.js";

console.log("Hello from worker");

rahti.run(WorkerLogger);
