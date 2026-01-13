/**
 * This package contains MiMC hashing utilities for use with Dark Forest.
 * The MiMC algorithm is used for both finding planet hashes and calculating
 * the perlin in-game. Among other things, these values are often needed for
 * generating Snarks.
 *
 * ## Installation
 *
 * You can install this package using [`npm`](https://www.npmjs.com) or
 * [`yarn`](https://classic.yarnpkg.com/lang/en/) by running:
 *
 * ```bash
 * npm install --save @darkforest_eth/hashing
 * ```
 * ```bash
 * yarn add @darkforest_eth/hashing
 * ```
 *
 * When using this in a plugin, you might want to load it with [skypack](https://www.skypack.dev)
 *
 * ```js
 * import * as hashing from 'http://cdn.skypack.dev/@darkforest_eth/hashing'
 * ```
 *
 * @packageDocumentation
 */
import aztecMimcHash, { aztecPerlinRandHash } from './aztec-mimc';
import { fakeHash, seededRandom } from './fakeHash';
import { Fraction } from './fractions/bigFraction.js';
import mimcHashOriginal, { modPBigInt, modPBigIntNative } from './mimc';
import { getRandomGradientAt, IntegerVector, MAX_PERLIN_VALUE, perlin, rand } from './perlin';

export {
  // Default MiMC (Aztec optimized: 91 rounds, exponent 7)
  aztecMimcHash as mimcHash,
  // Original Dark Forest MiMC (220 rounds, exponent 5)
  mimcHashOriginal,
  // Aztec optimized MiMC (91 rounds, exponent 7)
  aztecMimcHash,
  aztecPerlinRandHash,
  IntegerVector,
  perlin,
  rand,
  getRandomGradientAt,
  modPBigInt,
  modPBigIntNative,
  fakeHash,
  seededRandom,
  Fraction,
  MAX_PERLIN_VALUE,
};
