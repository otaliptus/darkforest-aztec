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
const TICKER_ADDRESS =
  process.env.TICKER_ADDRESS ||
  process.env.VITE_TICKER_ADDRESS ||
  envFromFile.VITE_TICKER_ADDRESS;

const INTERVAL = Number(process.env.INTERVAL ?? '0.5'); // seconds

if (!TICKER_ADDRESS) {
  console.error(
    'Missing TICKER_ADDRESS. Admin-based ticking is removed; set VITE_TICKER_ADDRESS in apps/client/.env.local.'
  );
  process.exit(1);
}

console.log(`Aztec node: ${AZTEC_NODE_URL}`);
if (TICKER_ADDRESS) {
  console.log(`Ticker: ${TICKER_ADDRESS}`);
}

const node = createAztecNodeClient(AZTEC_NODE_URL);
await waitForNode(node);

const wallet = await TestWallet.create(node, { proverEnabled: false });
const accounts = await getInitialTestAccountsData();
const tickAccountData = accounts[0];
if (!tickAccountData) throw new Error('No initial test accounts available.');
const tickAccount = await wallet.createSchnorrAccount(
  tickAccountData.secret,
  tickAccountData.salt,
  tickAccountData.signingKey
);

let ticker;
if (TICKER_ADDRESS) {
  const tickerArtifactPath = path.join(
    ROOT,
    'packages',
    'ticker',
    'target',
    'darkforest_ticker-Ticker.json'
  );
  if (!fs.existsSync(tickerArtifactPath)) {
    console.error('Missing Ticker artifact. Run: yarn contracts:compile');
    process.exit(1);
  }
  const tickerArtifact = loadContractArtifact(
    JSON.parse(fs.readFileSync(tickerArtifactPath, 'utf8'))
  );
  const tickerAddress = AztecAddress.fromString(TICKER_ADDRESS);
  const tickerOnChain = await node.getContract(tickerAddress);
  if (!tickerOnChain) throw new Error('Ticker contract not found on-chain.');
  await wallet.registerContract(tickerOnChain, tickerArtifact);
  ticker = await Contract.at(tickerAddress, tickerArtifact, wallet);
}

console.log(`Tick account: ${tickAccount.address.toString()}`);

while (true) {
  try {
    const sent = await ticker.methods.tick().send({ from: tickAccount.address });
    await sent.wait();
    const l2 = await node.getBlockNumber();
    console.log(`Tick tx mined. L2 block: ${l2}`);
  } catch (err) {
    console.warn('Tick tx failed:', err?.message ?? err);
  }

  await new Promise((r) => setTimeout(r, INTERVAL * 1000));
}
