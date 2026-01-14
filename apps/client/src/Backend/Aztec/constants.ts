export const PLANET_DEFAULT_POP_CAP = [
  90000,
  360000,
  1440000,
  5400000,
  22500000,
  90000000,
  270000000,
  450000000,
  630000000,
  720000000,
];

export const PLANET_DEFAULT_POP_GROWTH = [
  375,
  750,
  1125,
  1500,
  1875,
  2250,
  2625,
  3000,
  3375,
  3750,
];

export const PLANET_DEFAULT_RANGE = [99, 177, 315, 591, 1025, 1734, 2838, 4414, 6306, 8829];

export const PLANET_DEFAULT_SPEED = [75, 75, 75, 75, 75, 75, 75, 75, 75, 75];

export const PLANET_DEFAULT_DEFENSE = [400, 400, 300, 300, 300, 200, 200, 200, 200, 200];

export const PLANET_DEFAULT_SILVER_GROWTH = [0, 56, 167, 417, 833, 1667, 2778, 2778, 2778, 2778];

export const PLANET_DEFAULT_SILVER_CAP = [
  0,
  100000,
  500000,
  2500000,
  12000000,
  50000000,
  100000000,
  200000000,
  300000000,
  400000000,
];

export const PLANET_DEFAULT_BARBARIAN_PERCENT = [0, 1, 2, 3, 4, 5, 7, 10, 20, 25];

export const PLANET_LEVEL_THRESHOLDS = [
  16777216,
  4194292,
  1048561,
  262128,
  65520,
  16368,
  4080,
  1008,
  240,
  48,
];

export const PLANET_TYPE_WEIGHTS = [
  [
    [1, 0, 0, 0, 0],
    [13, 2, 0, 1, 0],
    [13, 2, 0, 1, 0],
    [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1],
  ],
  [
    [1, 0, 0, 0, 0],
    [13, 2, 1, 0, 0],
    [12, 2, 1, 1, 0],
    [11, 2, 1, 1, 1],
    [12, 2, 1, 0, 1],
    [12, 2, 1, 0, 1],
    [12, 2, 1, 0, 1],
    [12, 2, 1, 0, 1],
    [12, 2, 1, 0, 1],
    [12, 2, 1, 0, 1],
  ],
  [
    [1, 0, 0, 0, 0],
    [10, 4, 2, 0, 0],
    [10, 4, 1, 1, 0],
    [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1],
  ],
  [
    [1, 0, 0, 0, 0],
    [11, 4, 1, 0, 0],
    [11, 4, 1, 0, 0],
    [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1],
  ],
] as const;

export const PLANET_LEVEL_JUNK = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65];

export const ARTIFACT_POINT_VALUES = [0, 2000, 10000, 200000, 3000000, 20000000];

export const ROUND_END_REWARDS_BY_RANK = new Array(10).fill(0) as [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
