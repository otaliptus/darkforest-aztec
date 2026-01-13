import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { loadContractArtifact, FunctionType } from "@aztec/stdlib/abi";
import { Fr } from "@aztec/foundation/curves/bn254";
import { MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS } from "@aztec/constants";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ARTIFACT = path.join(
    __dirname,
    "..",
    "target",
    "darkforest_contract-DarkForest.json"
);

const artifactPath = process.env.DF_CONTRACT_ARTIFACT ?? DEFAULT_ARTIFACT;
if (!fs.existsSync(artifactPath)) {
    console.error(`Missing artifact at ${artifactPath}. Run compile first.`);
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const artifact = loadContractArtifact(raw);
const publicFn = artifact.functions.find((fn) => fn.functionType === FunctionType.PUBLIC);
const bytecode = publicFn?.bytecode ?? Buffer.alloc(0);

const fieldsUsed = 1 + Math.ceil(bytecode.length / (Fr.SIZE_IN_BYTES - 1));
const maxFields = MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS;
const remaining = maxFields - fieldsUsed;

console.log(`[public-bytecode] artifact: ${artifactPath}`);
console.log(`[public-bytecode] bytes: ${bytecode.length}`);
console.log(`[public-bytecode] fields: ${fieldsUsed} / ${maxFields}`);
if (remaining >= 0) {
    console.log(`[public-bytecode] remaining fields: ${remaining}`);
} else {
    console.log(`[public-bytecode] over limit by: ${-remaining} fields`);
    process.exitCode = 2;
}
