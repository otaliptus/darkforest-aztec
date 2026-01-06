import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createAztecNodeClient, waitForNode } from '@aztec/aztec.js/node';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { TestWallet } from '@aztec/test-wallet/server';
import { getInitialTestAccountsData } from '@aztec/accounts/testing';

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
const DF_ADDRESS =
  process.env.DARKFOREST_ADDRESS ||
  process.env.VITE_DARKFOREST_ADDRESS ||
  envFromFile.VITE_DARKFOREST_ADDRESS;

const INTERVAL = Number(process.env.INTERVAL ?? '0.5'); // seconds
const TICK_LOCATION_ID = BigInt(process.env.TICK_LOCATION_ID ?? '1');

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

console.log(`Aztec node: ${AZTEC_NODE_URL}`);
console.log(`DarkForest: ${DF_ADDRESS}`);
console.log(`Tick location: 0x${TICK_LOCATION_ID.toString(16)}`);

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

console.log(`Admin: ${admin.address.toString()}`);

while (true) {
  try {
    const sent = await darkforest.methods.admin_set_planet_owner(TICK_LOCATION_ID, admin.address).send({
      from: admin.address,
    });
    await sent.wait();
    const l2 = await node.getBlockNumber();
    console.log(`Tick tx mined. L2 block: ${l2}`);
  } catch (err) {
    console.warn('Tick tx failed:', err?.message ?? err);
  }

  await new Promise((r) => setTimeout(r, INTERVAL * 1000));
}
