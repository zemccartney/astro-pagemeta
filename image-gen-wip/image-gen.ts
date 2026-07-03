import type { Options } from "rehype-meta";

import * as devalue from "devalue";
import { fork } from "node:child_process";
import Path from "node:path";
import { fileURLToPath } from "node:url";

export default function generateOgImages(
    routesMeta: Map<
        string,
        { imagePath: string; meta: Options; ogImgProp: string }
    >
) {
    return new Promise((pResolve, pReject) => {
        console.log("Forking OG image generation process...");

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = Path.dirname(__filename);
        const workerPath = Path.resolve(__dirname, "image-gen-worker.js"); // .js because it will be compiled
        const child = fork(workerPath, [], {
            // Force a development environment for the child process
            env: { ...process.env, NODE_ENV: "development" }
        });

        child.on("message", (message) => {
            console.log("Message from worker:", message);
        });

        child.on("error", (err) => {
            console.error("Error in OG image worker:", err);
            pReject(err);
        });

        child.on("exit", (code) => {
            if (code === 0) {
                console.log(
                    "OG image generation process completed successfully."
                );
                pResolve(void 0);
            } else {
                const err = new Error(
                    `OG image worker exited with code ${code}`
                );
                console.error(err);
                pReject(err);
            }
        });

        // Send the data to the worker process
        child.send(devalue.stringify({ routesMeta }));
    });
}
