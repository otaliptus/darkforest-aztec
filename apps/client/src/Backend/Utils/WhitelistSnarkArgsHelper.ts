import type { WhitelistSnarkContractCallArgs } from '@darkforest_eth/snarks';
import type { EthAddress } from '@darkforest_eth/types';
import type { BigInteger } from 'big-integer';
import type { TerminalHandle } from '../../Frontend/Views/Terminal';

/**
 * Helper method for generating whitelist SNARKS.
 * This is separate from the existing {@link SnarkArgsHelper}
 * because whitelist txs require far less setup compared
 * to SNARKS that are sent in context of the game.
 */
export const getWhitelistArgs = async (
  key: BigInteger,
  recipient: EthAddress,
  terminal?: React.MutableRefObject<TerminalHandle | undefined>
): Promise<WhitelistSnarkContractCallArgs> => {
  throw new Error('Whitelist SNARKs are not supported in the Aztec client.');
};
