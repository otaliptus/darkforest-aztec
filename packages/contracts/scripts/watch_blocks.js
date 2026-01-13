#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Contract } from "@aztec/aztec.js/contracts";
import { loadContractArtifact } from "@aztec/aztec.js/abi";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { TestWallet } from "@aztec/test-wallet/server";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { Fr } from "@aztec/aztec.js/fields";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(CONTRACTS_DIR, "..", "..");
const CLIENT_ENV_PATH = path.join(ROOT_DIR, "apps", "client", ".env.local");
const DF_ARTIFACT_PATH = path.join(
  CONTRACTS_DIR,
  "target",
  "darkforest_contract-DarkForest.json"
);

const rawArgs = new Set(process.argv.slice(2));
const NODE_URL = process.env.AZTEC_NODE_URL || "http://localhost:8080";
const POLL_MS = Number(process.env.BLOCK_POLL_MS || "1000");
const TICK_TX =
  rawArgs.has("--tick") ||
  process.env.TICK_TX === "1" ||
  process.env.TICK_TX === "true";
const TICK_EVERY_MS = Number(process.env.TICK_EVERY_MS || "5000");
const TICK_TIMEOUT_MS = Number(process.env.TICK_TIMEOUT_MS || "20000");

if (!Number.isFinite(POLL_MS) || POLL_MS <= 0) {
  console.error("BLOCK_POLL_MS must be a positive number");
  process.exit(1);
}
if (!Number.isFinite(TICK_EVERY_MS) || TICK_EVERY_MS <= 0) {
  console.error("TICK_EVERY_MS must be a positive number");
  process.exit(1);
}
if (!Number.isFinite(TICK_TIMEOUT_MS) || TICK_TIMEOUT_MS <= 0) {
  console.error("TICK_TIMEOUT_MS must be a positive number");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
};

const envFile = parseEnvFile(CLIENT_ENV_PATH);
const getEnv = (key, fallback) => process.env[key] ?? envFile[key] ?? fallback;

const parseBigInt = (value) => {
  if (value === undefined || value === "") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
};

const getStorageSlots = (artifact, contractName) => {
  const storage = artifact?.outputs?.globals?.storage;
  if (!Array.isArray(storage)) {
    throw new Error("Contract artifact missing storage layout.");
  }
  const entry = storage.find((item) =>
    item.fields?.some(
      (field) =>
        field.name === "contract_name" &&
        field.value?.value === contractName
    )
  );
  if (!entry) {
    throw new Error(`Storage layout not found for ${contractName}.`);
  }
  const fields = entry.fields?.find((field) => field.name === "fields")?.value
    ?.fields;
  if (!Array.isArray(fields)) {
    throw new Error(`Storage layout missing fields for ${contractName}.`);
  }
  const slots = {};
  for (const field of fields) {
    const slotValue = field.value?.fields?.find((slot) => slot.name === "slot")
      ?.value?.value;
    if (!slotValue) continue;
    slots[field.name] = BigInt(`0x${slotValue}`);
  }
  return slots;
};

const readPublicField = async (node, contractAddress, slot) => {
  const value = await node.getPublicStorageAt(
    "latest",
    contractAddress,
    new Fr(slot)
  );
  return value.toBigInt();
};

const readPublicFields = async (node, contractAddress, baseSlot, count) => {
  const reads = Array.from({ length: count }, (_, index) =>
    readPublicField(node, contractAddress, baseSlot + BigInt(index))
  );
  return Promise.all(reads);
};

const readPublicMapFields = async (node, contractAddress, mapSlot, key, count) => {
  const slot = await deriveStorageSlotInMap(new Fr(mapSlot), key);
  return readPublicFields(node, contractAddress, slot.toBigInt(), count);
};

const decodePlayer = (fields) => ({
  isInitialized: (fields[0] ?? 0n) === 1n,
  homePlanet: fields[1] ?? 0n,
  lastRevealBlock: Number(fields[2] ?? 0n),
});

const ensureTicker = async (node) => {
  if (!TICK_TX) return undefined;

  const darkforestAddress =
    getEnv("DARKFOREST_ADDRESS", undefined) ??
    getEnv("VITE_DARKFOREST_ADDRESS", undefined);
  if (!darkforestAddress) {
    throw new Error(
      "DARKFOREST_ADDRESS (or VITE_DARKFOREST_ADDRESS) is required for tx ticking."
    );
  }

  const accountIndex = Number(
    getEnv("ACCOUNT_INDEX", getEnv("VITE_ACCOUNT_INDEX", "0"))
  );
  const accounts = await getInitialTestAccountsData();
  const accountData = accounts[accountIndex];
  if (!accountData) {
    throw new Error(`No test account at index ${accountIndex}`);
  }

  const wallet = await TestWallet.create(node, { proverEnabled: false });
  const account = await wallet.createSchnorrAccount(
    accountData.secret,
    accountData.salt,
    accountData.signingKey
  );

  if (!fs.existsSync(DF_ARTIFACT_PATH)) {
    throw new Error(
      `Missing DarkForest artifact at ${DF_ARTIFACT_PATH}. Run contracts compile first.`
    );
  }
  const dfJson = JSON.parse(fs.readFileSync(DF_ARTIFACT_PATH, "utf8"));
  const dfArtifact = loadContractArtifact(dfJson);
  const dfAddr = AztecAddress.fromString(darkforestAddress);
  const onChain = await node.getContract(dfAddr);
  if (!onChain) {
    throw new Error(
      `No contract instance found on-chain at ${dfAddr.toString()}. Is DarkForest deployed?`
    );
  }
  await wallet.registerContract(onChain, dfArtifact);
  const darkforest = Contract.at(dfAddr, dfArtifact, wallet);

  const sponsoredFpcAddress =
    getEnv("SPONSORED_FPC_ADDRESS", undefined) ??
    getEnv("VITE_SPONSORED_FPC_ADDRESS", undefined);
  const fee = sponsoredFpcAddress
    ? {
        paymentMethod: new SponsoredFeePaymentMethod(
          AztecAddress.fromString(sponsoredFpcAddress)
        ),
      }
    : undefined;

  let locationId = parseBigInt(getEnv("TICK_LOCATION_ID", undefined));
  if (!locationId) {
    const slots = getStorageSlots(dfJson, "DarkForest");
    const fields = await readPublicMapFields(
      node,
      dfAddr,
      slots.players,
      account.address,
      3
    );
    const player = decodePlayer(fields);
    if (!player.isInitialized) {
      throw new Error(
        "Tick account is not initialized in DarkForest (player not found)."
      );
    }
    locationId = player.homePlanet;
  }

  return { account, darkforest, fee, locationId };
};

process.on("SIGINT", () => {
  console.log("\nexiting");
  process.exit(0);
});

const main = async () => {
  const node = createAztecNodeClient(NODE_URL);
  await waitForNode(node);

  const ticker = await ensureTicker(node);
  if (TICK_TX) {
    console.log("tx ticker enabled (use TICK_EVERY_MS to adjust cadence)");
  }
  console.log(`watching L2 tips from ${NODE_URL} every ${POLL_MS}ms`);

  let lastBlock = undefined;
  let lastTickAt = 0;
  let warnedTickDisabled = false;

  while (true) {
    try {
      const tips = await node.getL2Tips();
      const latest = tips.latest.number;
      const proven = tips.proven.number;
      const finalized = tips.finalized.number;
      const latestNum =
        typeof latest === "bigint" ? Number(latest) : Number(latest);
      const provenNum =
        typeof proven === "bigint" ? Number(proven) : Number(proven);
      const finalizedNum =
        typeof finalized === "bigint" ? Number(finalized) : Number(finalized);

      let latestTs = "?";
      const latestBlock = await node.getBlock(latestNum);
      if (latestBlock?.timestamp !== undefined) {
        const tsRaw = latestBlock.timestamp;
        let tsNum = NaN;
        if (typeof tsRaw === "bigint") {
          tsNum = Number(tsRaw);
        } else if (typeof tsRaw === "number") {
          tsNum = tsRaw;
        } else if (tsRaw && typeof tsRaw.toString === "function") {
          tsNum = Number(tsRaw.toString());
        }
        if (Number.isFinite(tsNum)) {
          latestTs = new Date(tsNum * 1000).toISOString();
        }
      }

      console.log(
        `[${nowIso()}] latest=${latestNum} proven=${provenNum} finalized=${finalizedNum} latestTs=${latestTs}`
      );

      if (ticker) {
        const now = Date.now();
        if (lastBlock !== undefined && latestNum === lastBlock) {
          if (now - lastTickAt >= TICK_EVERY_MS) {
            if (!warnedTickDisabled) {
              console.warn(
                "[watch_blocks] tick tx disabled (admin actions removed); use the Ticker contract directly if needed."
              );
              warnedTickDisabled = true;
            }
            lastTickAt = now;
          }
        } else {
          lastTickAt = now;
        }
      }

      lastBlock = latestNum;
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? err.message
          : String(err);
      console.error(`[${nowIso()}] error: ${msg}`);
    }

    await sleep(POLL_MS);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
