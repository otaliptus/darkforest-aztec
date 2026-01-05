// These are loaded as URL paths by a webpack loader
import type { AztecConnection } from '../Aztec/AztecConnection';
import { AztecConnection as AztecConnectionImpl } from '../Aztec/AztecConnection';
import { CLIENT_CONFIG } from '../Aztec/config';

/**
 * Loads the game contract, which is responsible for updating the state of the game.
 */
export async function loadDiamondContract() {
  throw new Error('Ethereum contracts are not supported in the Aztec client.');
}

export function getEthConnection(): Promise<AztecConnection> {
  return AztecConnectionImpl.connect(CLIENT_CONFIG);
}
