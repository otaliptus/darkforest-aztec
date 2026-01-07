import { EthAddress, LocationId } from './identifier';

/**
 * Represents a player; corresponds fairly closely with the analogous contract
 * struct
 */
export type Player = {
  address: EthAddress;
  twitter?: string;
  /**
   * block number
   */
  initTimestamp: number;
  homePlanetId: LocationId;
  /**
   * block number
   */
  lastRevealTimestamp: number;
  lastClaimTimestamp: number;
  score: number;

  spaceJunk: number;
  spaceJunkLimit: number;
  claimedShips: boolean;
};
