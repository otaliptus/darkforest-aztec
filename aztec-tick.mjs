import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createAztecNodeClient, waitForNode } from '@aztec/aztec.js/node';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { TestWallet } from '@aztec/test-wallet/server';
import { getInitialTestAccountsData } from '@aztec/accounts/testing';
import { Fr } from '@aztec/aztec.js/fields';
import { deriveStorageSlotInMap } from '@aztec/stdlib/hash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();

const envPath = path.join(ROOT, 'apps', 'client', '.env.local');
const envFile = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const envFromFile = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    })
);

const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || envFromFile.VITE_AZTEC_NODE_URL || 'http://localhost:8080';
const L1_RPC_URL = process.env.L1_RPC_URL || 'http://localhost:8545';
const DF_ADDRESS =
  process.env.DARKFOREST_ADDRESS ||
  process.env.VITE_DARKFOREST_ADDRESS ||
  envFromFile.VITE_DARKFOREST_ADDRESS;

const INTERVAL = Number(process.env.INTERVAL ?? '0.5'); // seconds
const BATCH = Number(process.env.BATCH ?? '1');
const FORCE_TX = (process.env.FORCE_TX ?? 'true') !== 'false';
const L2_STALL_LIMIT = Number(process.env.L2_STALL_LIMIT ?? '5');

if (!DF_ADDRESS) {
  console.error('Missing DARKFOREST_ADDRESS. Ensure apps/client/.env.local has VITE_DARKFOREST_ADDRESS.');
  process.exit(1);
}

const artifactPath = path.join(ROOT, 'packages', 'contracts', 'target', 'darkforest_contract-DarkForest.json');
if (!fs.existsSync(artifactPath)) {
  console.error('Missing contract artifact. Run: yarn contracts:compile');
  process.exit(1);
}

const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));

const getStorageSlots = (artifactJson, contractName) => {
  const storage = artifactJson?.outputs?.globals?.storage;
  if (!Array.isArray(storage)) {
    throw new Error('Contract artifact missing storage layout.');
  }
  const entry = storage.find((item) =>
    item.fields?.some(
      (field) => field.name === 'contract_name' && field.value?.value === contractName
    )
  );
  if (!entry) throw new Error(`Storage layout not found for ${contractName}.`);
  const fields = entry.fields?.find((field) => field.name === 'fields')?.value?.fields;
  if (!Array.isArray(fields)) {
    throw new Error(`Storage layout missing fields for ${contractName}.`);
  }
  const slots = {};
  for (const field of fields) {
    const slotValue = field.value?.fields?.find((slot) => slot.name === 'slot')?.value?.value;
    if (slotValue) slots[field.name] = BigInt(`0x${slotValue}`);
  }
  return slots;
};

const readPublicField = async (node, contractAddress, slot) => {
  const value = await node.getPublicStorageAt('latest', contractAddress, new Fr(slot));
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
  isInitialized: fields[0] === 1n,
  homePlanet: fields[1] ?? 0n,
  lastRevealBlock: Number(fields[2] ?? 0n),
});

const rpc = async (url, method, params = []) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'RPC error');
  return data.result;
};

const mineL1 = async () => {
  try {
    await rpc(L1_RPC_URL, 'anvil_mine', [BATCH]);
    return true;
  } catch {
    try {
      await rpc(L1_RPC_URL, 'hardhat_mine', [`0x${BATCH.toString(16)}`]);
      return true;
    } catch {
      try {
        await rpc(L1_RPC_URL, 'evm_mine', []);
        return true;
      } catch {
        return false;
      }
    }
  }
};

console.log(`Aztec node: ${AZTEC_NODE_URL}`);
console.log(`L1 RPC: ${L1_RPC_URL}`);
console.log(`DarkForest: ${DF_ADDRESS}`);

const node = createAztecNodeClient(AZTEC_NODE_URL);
await waitForNode(node);

const wallet = await TestWallet.create(node, { proverEnabled: false });
const accounts = await getInitialTestAccountsData();
const adminData = accounts[0];
if (!adminData) throw new Error('No initial test accounts available.');
const admin = await wallet.createSchnorrAccount(
  adminData.secret,
  adminData.salt,
  adminData.signingKey
);

const dfAddress = AztecAddress.fromString(DF_ADDRESS);
const onChain = await node.getContract(dfAddress);
if (!onChain) throw new Error('DarkForest contract not found on-chain.');
await wallet.registerContract(onChain, artifact);
const darkforest = await Contract.at(dfAddress, artifact, wallet);

// Read admin player state to get home planet id.
const slots = getStorageSlots(JSON.parse(fs.readFileSync(artifactPath, 'utf8')), 'DarkForest');
const playerFields = await readPublicMapFields(
  node,
  dfAddress,
  slots.players,
  admin.address,
  3
);
const adminState = decodePlayer(playerFields);
if (!adminState.isInitialized) {
  throw new Error('Admin account not initialized. Initialize player (account index 0) in client first.');
}

const homePlanet = adminState.homePlanet;
console.log(`Admin: ${admin.address.toString()}`);
console.log(`Home planet: 0x${homePlanet.toString(16)}`);

let lastL2 = await node.getBlockNumber();
let stall = 0;

while (true) {
  const mined = await mineL1();
  if (!mined) console.warn('L1 mine failed; is L1 RPC up?');

  const l2 = await node.getBlockNumber();
  if (l2 === lastL2) {
    stall += 1;
  } else {
    stall = 0;
    lastL2 = l2;
  }

  if (FORCE_TX && stall >= L2_STALL_LIMIT) {
    stall = 0;
    try {
      const sent = await darkforest.methods.admin_set_planet_owner(homePlanet, admin.address).send({
        from: admin.address,
      });
      await sent.wait();
      lastL2 = await node.getBlockNumber();
      console.log(`Tick tx mined. L2 block: ${lastL2}`);
    } catch (err) {
      console.warn('Tick tx failed:', err?.message ?? err);
    }
  }

  await new Promise((r) => setTimeout(r, INTERVAL * 1000));
}
