import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
    plugins: [react(), nodePolyfills({ protocolImports: true })],
    define: {
        global: "globalThis",
    },
    resolve: {
        alias: [
            {
                find: /^pino$/,
                replacement: path.resolve(__dirname, "src", "shims", "pino-browser.ts"),
            },
        ],
    },
    optimizeDeps: {
        include: [
            "sha3",
            "hash.js",
            "hash.js/lib/hash.js",
            "lodash.chunk",
        ],
        exclude: [
            "@aztec/noir-acvm_js",
            "@aztec/noir-noirc_abi",
            "@aztec/bb.js",
            "@aztec/bb-prover",
        ],
        needsInterop: ["sha3", "hash.js", "lodash.chunk"],
    },
    assetsInclude: ["**/*.wasm", "**/*.wasm.gz"],
    server: {
        fs: {
            allow: [path.resolve(__dirname, "..", "..")],
        },
    },
});
