#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Contract, getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import { loadContractArtifact } from "@aztec/aztec.js/abi";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { TestWallet } from "@aztec/test-wallet/server";
import { generateSchnorrAccounts, getInitialTestAccountsData } from "@aztec/accounts/testing";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(CONTRACTS_DIR, "..", "..");
const CLIENT_ENV_PATH = path.join(ROOT_DIR, "apps", "client", ".env.local");

const SPONSORED_FPC_SALT = new Fr(0);
const ZERO_ADDRESS = AztecAddress.fromBigInt(0n);

const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const normalizeLogLevel = (value) => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized in LOG_LEVELS) return normalized;
  return "info";
};
const SCRIPT_LOG_LEVEL = normalizeLogLevel(
  process.env.DF_SCRIPT_LOG_LEVEL ??
    process.env.DF_LOG_LEVEL ??
    (process.env.DF_VERBOSE_LOGS === "true" ? "debug" : "info")
);
const shouldLog = (level) => LOG_LEVELS[level] >= LOG_LEVELS[SCRIPT_LOG_LEVEL];
const log = (level, message, data) => {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  if (data && Object.keys(data).length > 0) {
    console.log(`[${ts}] ${level.toUpperCase()} ${message}`, data);
  } else {
    console.log(`[${ts}] ${level.toUpperCase()} ${message}`);
  }
};

const formatTxHash = (hash) => {
  if (hash === undefined || hash === null) return undefined;
  if (typeof hash === "string") return hash;
  if (typeof hash === "bigint") return `0x${hash.toString(16)}`;
  const toString = hash?.toString;
  if (typeof toString === "function") {
    const value = toString.call(hash);
    if (value && value !== "[object Object]") return value;
  }
  return String(hash);
};

const deriveMaxLocationId = (planetRarity) => {
  const rarity = BigInt(planetRarity);
  if (rarity <= 0n) {
    throw new Error("planet_rarity must be greater than zero.");
  }
  const maxLocationId = FIELD_MODULUS / rarity;
  return maxLocationId === FIELD_MODULUS ? FIELD_MODULUS - 1n : maxLocationId;
};

const BASE_CONFIG = {
  planethash_key: 42n,
  spacetype_key: 43n,
  biomebase_key: 6271n,
  perlin_length_scale: 1024,
  perlin_mirror_x: false,
  perlin_mirror_y: false,
  init_perlin_min: 0,
  init_perlin_max: 33,
  world_radius: 9000,
  spawn_rim_area: 0,
  location_reveal_cooldown: 0,
  time_factor_hundredths: 1200000,
  planet_rarity: 2,
  max_location_id: deriveMaxLocationId(2),
};

const DEFAULT_INIT = { x: 990, y: 0, radius: 1000 };
const DEFAULT_REVEAL = { x: 123, y: 456 };

const readOptionalInt = (value) => {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
};

const readOptionalFloat = (value) => {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const readPositiveInt = (value, fallback) => {
  const parsed = readOptionalInt(value);
  if (parsed === undefined || parsed <= 0) return fallback;
  return parsed;
};

const toBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
};

const clampCoord = (value, worldRadius) => {
  if (worldRadius <= 0) return 0;
  return Math.max(Math.min(value, worldRadius), -worldRadius);
};

const clampRadius = (value, worldRadius) => {
  if (worldRadius <= 0) return 0;
  return Math.max(0, Math.min(value, worldRadius));
};

const deriveDefaults = (worldRadius) => ({
  init: {
    x: clampCoord(DEFAULT_INIT.x, worldRadius),
    y: clampCoord(DEFAULT_INIT.y, worldRadius),
    radius: clampRadius(DEFAULT_INIT.radius, worldRadius),
  },
  reveal: {
    x: clampCoord(DEFAULT_REVEAL.x, worldRadius),
    y: clampCoord(DEFAULT_REVEAL.y, worldRadius),
  },
});

const parseArgs = () => {
  const rawArgs = process.argv.slice(2);
  const args = new Set(rawArgs);
  const getArg = (flag) => {
    const idx = rawArgs.indexOf(flag);
    if (idx === -1 || idx + 1 >= rawArgs.length) return undefined;
    return rawArgs[idx + 1];
  };

  const worldRadius = readPositiveInt(
    getArg("--world-radius") ?? process.env.DF_WORLD_RADIUS,
    BASE_CONFIG.world_radius
  );
  const planetRarity = readPositiveInt(
    getArg("--planet-rarity") ?? process.env.DF_PLANET_RARITY,
    BASE_CONFIG.planet_rarity
  );
  const timeFactorHundredths = readPositiveInt(
    getArg("--time-factor") ?? process.env.DF_TIME_FACTOR_HUNDREDTHS,
    BASE_CONFIG.time_factor_hundredths
  );
  const blockTimeSec = readOptionalFloat(
    getArg("--block-time") ?? process.env.DF_BLOCK_TIME_SEC
  );
  const derived = deriveDefaults(worldRadius);
  const init = {
    x: readOptionalInt(getArg("--init-x") ?? process.env.DF_INIT_X) ?? derived.init.x,
    y: readOptionalInt(getArg("--init-y") ?? process.env.DF_INIT_Y) ?? derived.init.y,
    radius:
      readOptionalInt(getArg("--init-radius") ?? process.env.DF_INIT_RADIUS) ??
      derived.init.radius,
  };
  const reveal = {
    x: readOptionalInt(getArg("--reveal-x") ?? process.env.DF_REVEAL_X) ?? derived.reveal.x,
    y: readOptionalInt(getArg("--reveal-y") ?? process.env.DF_REVEAL_Y) ?? derived.reveal.y,
  };

  return {
    nodeUrl: getArg("--node-url") ?? process.env.AZTEC_NODE_URL ?? "http://localhost:8080",
    sponsoredFpcAddress: getArg("--sponsored-fpc") ?? process.env.SPONSORED_FPC_ADDRESS,
    writeEnv: args.has("--write-env") || args.has("-w"),
    overwriteEnv: args.has("--overwrite-env"),
    proverEnabled: toBool(process.env.PROVER_ENABLED, true),
    accountMode: getArg("--account-mode") ?? process.env.ACCOUNT_MODE ?? "test",
    accountIndex: readOptionalInt(getArg("--account-index") ?? process.env.ACCOUNT_INDEX) ?? 0,
    accountSecret: getArg("--account-secret") ?? process.env.ACCOUNT_SECRET,
    accountSalt: getArg("--account-salt") ?? process.env.ACCOUNT_SALT,
    accountSigningKey:
      getArg("--account-signing-key") ?? process.env.ACCOUNT_SIGNING_KEY,
    configOverrides: {
      world_radius: worldRadius,
      planet_rarity: planetRarity,
      time_factor_hundredths: timeFactorHundredths,
    },
    init: {
      x: clampCoord(init.x, worldRadius),
      y: clampCoord(init.y, worldRadius),
      radius: clampRadius(init.radius, worldRadius),
    },
    reveal: {
      x: clampCoord(reveal.x, worldRadius),
      y: clampCoord(reveal.y, worldRadius),
    },
    blockTimeSec,
  };
};

const loadArtifact = (relativePath) => {
  const artifactPath = path.join(CONTRACTS_DIR, relativePath);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Missing artifact at ${artifactPath}. Run compile first.`);
  }
  const json = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return loadContractArtifact(json);
};

const isExistingNullifierError = (err) => {
  const message = err?.cause?.message ?? err?.message ?? "";
  return message.includes("Existing nullifier");
};

const sendTx = async (label, sendFn, timeoutMs, meta) => {
  const startedAt = Date.now();
  log("info", `tx.start ${label}`, meta);
  try {
    const sent = await sendFn();
    const rawHash = sent.getTxHash ? await sent.getTxHash() : sent.txHash;
    const txHash = formatTxHash(rawHash);
    const submittedAt = Date.now();
    log("info", `tx.submitted ${label}`, {
      txHash,
      submitMs: submittedAt - startedAt,
      ...(meta ?? {}),
    });
    const receipt = await sent.wait({ timeout: timeoutMs });
    const confirmedAt = Date.now();
    log("info", `tx.confirmed ${label}`, {
      txHash,
      confirmMs: confirmedAt - submittedAt,
      totalMs: confirmedAt - startedAt,
      status: receipt?.status,
      ...(meta ?? {}),
    });
    return { sent, receipt, txHash };
  } catch (err) {
    log("error", `tx.failed ${label}`, {
      elapsedMs: Date.now() - startedAt,
      error: err?.message ?? err,
      stack: err?.stack,
      ...(meta ?? {}),
    });
    throw err;
  }
};

const resolveSponsoredFpc = async (wallet, node, override) => {
  if (override) {
    const address = AztecAddress.fromString(override);
    const onChain = await node.getContract(address);
    if (!onChain) {
      console.warn("SponsoredFPC override not found; proceeding without sponsored fees.");
      return undefined;
    }
    await wallet.registerContract(onChain, SponsoredFPCContract.artifact);
    return address;
  }

  const instance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: SPONSORED_FPC_SALT }
  );
  const onChain = await node.getContract(instance.address);
  if (!onChain) {
    console.warn("SponsoredFPC not found at salt=0; proceeding without sponsored fees.");
    return undefined;
  }
  await wallet.registerContract(onChain, SponsoredFPCContract.artifact);
  return onChain.address;
};

const resolveAccountData = async (
  accountSecret,
  accountSalt,
  accountSigningKey,
  accountMode,
  accountIndex
) => {
  if (accountSecret && accountSalt && accountSigningKey) {
    return {
      secret: Fr.fromString(accountSecret),
      salt: Fr.fromString(accountSalt),
      signingKey: GrumpkinScalar.fromString(accountSigningKey),
      label: "provided",
    };
  }

  if (accountMode === "random") {
    const [generated] = await generateSchnorrAccounts(1);
    if (!generated) {
      throw new Error("Failed to generate random account data.");
    }
    return { ...generated, label: "random" };
  }

  const accounts = await getInitialTestAccountsData();
  const account = accounts[accountIndex];
  if (!account) {
    throw new Error(
      `Missing test account index ${accountIndex}. Provide ACCOUNT_SECRET/ACCOUNT_SALT/ACCOUNT_SIGNING_KEY or set ACCOUNT_MODE=random.`
    );
  }
  return { ...account, label: `test index ${accountIndex}` };
};

const ensureAccountDeployed = async (node, account, fee) => {
  const onChain = await node.getContract(account.address);
  if (onChain) return;
  try {
    const deployMethod = await account.getDeployMethod();
    const { txHash } = await sendTx(
      "deploy account",
      () => deployMethod.send(fee ? { from: ZERO_ADDRESS, fee } : { from: ZERO_ADDRESS }),
      120000,
      { address: account.address.toString() }
    );
    console.log(`Account deployed at ${account.address.toString()} (${txHash ?? "hash pending"})`);
  } catch (err) {
    if (isExistingNullifierError(err)) {
      console.warn("Account deploy already seen; continuing.");
      return;
    }
    throw err;
  }
};

const buildEnvBlock = (
  nodeUrl,
  darkforestAddress,
  nftAddress,
  sponsoredAddress,
  config,
  init,
  reveal,
  accountLabel,
  accountSecret,
  accountSalt,
  accountSigningKey,
  accountIndex,
  proverEnabled,
  blockTimeSec
) => {
  const lines = [
    `VITE_AZTEC_NODE_URL=${nodeUrl}`,
    `VITE_DARKFOREST_ADDRESS=${darkforestAddress}`,
    `VITE_NFT_ADDRESS=${nftAddress}`,
    `VITE_SPONSORED_FPC_ADDRESS=${sponsoredAddress ?? ""}`,
    `VITE_PROVER_ENABLED=${proverEnabled ? "true" : "false"}`,
    `VITE_PLANETHASH_KEY=${config.planethash_key}`,
    `VITE_SPACETYPE_KEY=${config.spacetype_key}`,
    `VITE_PERLIN_LENGTH_SCALE=${config.perlin_length_scale}`,
    `VITE_PERLIN_MIRROR_X=${config.perlin_mirror_x}`,
    `VITE_PERLIN_MIRROR_Y=${config.perlin_mirror_y}`,
    `VITE_INIT_X=${init.x}`,
    `VITE_INIT_Y=${init.y}`,
    `VITE_INIT_RADIUS=${init.radius}`,
    `VITE_REVEAL_X=${reveal.x}`,
    `VITE_REVEAL_Y=${reveal.y}`,
    `# account: ${accountLabel}`,
  ];

  if (accountSecret && accountSalt && accountSigningKey) {
    lines.push(`ACCOUNT_SECRET=${accountSecret}`);
    lines.push(`ACCOUNT_SALT=${accountSalt}`);
    lines.push(`ACCOUNT_SIGNING_KEY=${accountSigningKey}`);
  } else if (accountIndex !== undefined) {
    lines.push(`ACCOUNT_INDEX=${accountIndex}`);
  }

  if (blockTimeSec !== undefined) {
    lines.push(`VITE_BLOCK_TIME_SEC=${blockTimeSec}`);
  }

  return `${lines.join("\n")}\n`;
};

async function main() {
  const {
    nodeUrl,
    sponsoredFpcAddress,
    writeEnv,
    overwriteEnv,
    proverEnabled,
    accountMode,
    accountIndex,
    accountSecret,
    accountSalt,
    accountSigningKey,
    configOverrides,
    init,
    reveal,
    blockTimeSec,
  } = parseArgs();

  const config = { ...BASE_CONFIG, ...configOverrides };
  config.max_location_id = deriveMaxLocationId(config.planet_rarity);

  log("info", "deploy.config", {
    nodeUrl,
    accountMode,
    accountIndex,
    proverEnabled,
    blockTimeSec,
    worldRadius: config.world_radius,
    planetRarity: config.planet_rarity,
    timeFactorHundredths: config.time_factor_hundredths,
    init,
    reveal,
  });

  console.log(`Connecting to Aztec node at ${nodeUrl}...`);
  const node = createAztecNodeClient(nodeUrl);
  await waitForNode(node);
  console.log("Node ready.");

  const wallet = await TestWallet.create(node, { proverEnabled });
  const accountData = await resolveAccountData(
    accountSecret,
    accountSalt,
    accountSigningKey,
    accountMode,
    accountIndex
  );
  const account = await wallet.createSchnorrAccount(
    accountData.secret,
    accountData.salt,
    accountData.signingKey
  );
  console.log(`Using ${accountData.label} account ${account.address.toString()}`);

  const sponsoredAddress = await resolveSponsoredFpc(wallet, node, sponsoredFpcAddress);
  const fee = sponsoredAddress
    ? { paymentMethod: new SponsoredFeePaymentMethod(sponsoredAddress) }
    : undefined;

  await ensureAccountDeployed(node, account, fee);

  const darkforestArtifact = loadArtifact("target/darkforest_contract-DarkForest.json");
  const nftArtifact = loadArtifact("../nft/target/darkforest_nft-NFT.json");

  console.log("Deploying NFT...");
  const nftDeploy = Contract.deploy(wallet, nftArtifact, [account.address]);
  const { sent: nftSent, txHash: nftTxHash } = await sendTx(
    "deploy NFT",
    () => nftDeploy.send({ from: account.address, fee }),
    120000,
    { from: account.address.toString() }
  );
  const nft = await nftSent.deployed();
  console.log(`NFT deployed at ${nft.address.toString()} (${nftTxHash ?? "hash pending"})`);

  console.log("Deploying DarkForest...");
  const dfDeploy = Contract.deploy(wallet, darkforestArtifact, [
    config,
    nft.address,
  ]);
  const { sent: dfSent, txHash: dfTxHash } = await sendTx(
    "deploy DarkForest",
    () => dfDeploy.send({ from: account.address, fee }),
    120000,
    { from: account.address.toString() }
  );
  const darkforest = await dfSent.deployed();
  console.log(`DarkForest deployed at ${darkforest.address.toString()} (${dfTxHash ?? "hash pending"})`);

  console.log("Setting NFT minter...");
  await sendTx(
    "set NFT minter",
    () => nft.methods.set_minter(darkforest.address).send({ from: account.address, fee }),
    120000,
    { from: account.address.toString(), darkforest: darkforest.address.toString() }
  );
  console.log("NFT minter updated.");

  const envBlock = buildEnvBlock(
    nodeUrl,
    darkforest.address.toString(),
    nft.address.toString(),
    sponsoredAddress?.toString(),
    config,
    init,
    reveal,
    accountData.label,
    accountSecret,
    accountSalt,
    accountSigningKey,
    accountIndex,
    proverEnabled,
    blockTimeSec
  );

  console.log("\n.env.local block:\n");
  console.log(envBlock);

  const shouldWrite = writeEnv || !fs.existsSync(CLIENT_ENV_PATH);
  if (shouldWrite) {
    if (fs.existsSync(CLIENT_ENV_PATH) && !overwriteEnv) {
      console.warn(`Skipping write: ${CLIENT_ENV_PATH} already exists (use --overwrite-env).`);
    } else {
      fs.writeFileSync(CLIENT_ENV_PATH, envBlock, "utf8");
      console.log(`Wrote ${CLIENT_ENV_PATH}`);
    }
  } else {
    console.log(`Skipped writing ${CLIENT_ENV_PATH} (use --write-env to write).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
