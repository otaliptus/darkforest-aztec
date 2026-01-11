// These are loaded as URL paths by a webpack loader
import type { AztecConnection } from '../Aztec/AztecConnection';
import { AztecConnection as AztecConnectionImpl } from '../Aztec/AztecConnection';
import { CLIENT_CONFIG } from '../Aztec/config';
import { detailedLogger } from '../Utils/DetailedLogger';

/**
 * Loads the game contract, which is responsible for updating the state of the game.
 */
export async function loadDiamondContract() {
  throw new Error('Ethereum contracts are not supported in the Aztec client.');
}

let cachedConnection: AztecConnection | undefined;
let cachedConnectionPromise: Promise<AztecConnection> | undefined;

export function getEthConnection(): Promise<AztecConnection> {
  if (cachedConnection) return Promise.resolve(cachedConnection);
  if (cachedConnectionPromise) return cachedConnectionPromise;
  cachedConnectionPromise = AztecConnectionImpl.connect(
    CLIENT_CONFIG,
    detailedLogger.getAztecLogFn()
  )
    .then((connection) => {
      cachedConnection = connection;
      return connection;
    })
    .catch((error) => {
      cachedConnectionPromise = undefined;
      throw error;
    });
  return cachedConnectionPromise;
}

export async function stopEthConnection(): Promise<void> {
  if (!cachedConnection) return;
  await cachedConnection.stop();
  cachedConnection = undefined;
  cachedConnectionPromise = undefined;
}
