use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use crate::{types::GameConfig, utils::config_hash, DarkForest};
use dep::darkforest_nft::NFT;

pub global PLANETHASH_KEY: Field = 42;
pub global SPACETYPE_KEY: Field = 43;
pub global BIOMEBASE_KEY: Field = 6271;
pub global PERLIN_LENGTH_SCALE: u64 = 1024;
pub global PERLIN_MIRROR_X: bool = false;
pub global PERLIN_MIRROR_Y: bool = false;
pub global INIT_PERLIN_MIN: u64 = 0;
pub global INIT_PERLIN_MAX: u64 = 33;
pub global WORLD_RADIUS: u64 = 10000;
pub global SPAWN_RIM_AREA: u64 = 0;
pub global DEFAULT_REVEAL_COOLDOWN: u32 = 0;
pub global PLANET_RARITY: u64 = 1;
pub global MAX_LOCATION_ID: Field = 0 - 1;
pub global REAL_PLANET_RARITY: u64 = 16384;
pub global REAL_MAX_LOCATION_ID: Field =
    1335952323720658888076562850662675481478782006861330221172986095372058624;
pub global PERLIN_THRESHOLD_1: u64 = 14;
pub global PERLIN_THRESHOLD_2: u64 = 15;
pub global PERLIN_THRESHOLD_3: u64 = 19;
pub global BIOME_THRESHOLD_1: u64 = 15;
pub global BIOME_THRESHOLD_2: u64 = 17;
pub global MAX_NATURAL_PLANET_LEVEL: u8 = 9;
pub global TIME_FACTOR_HUNDREDTHS: u64 = 100;
pub global PLANET_LEVEL_THRESHOLDS: [u64; 10] = [
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
pub global PLANET_TYPE_WEIGHTS: [[[u64; 5]; 10]; 4] = [
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
];

pub fn spacetype_config_hash() -> Field {
    config_hash(
        PLANETHASH_KEY,
        SPACETYPE_KEY,
        PERLIN_LENGTH_SCALE,
        PERLIN_MIRROR_X,
        PERLIN_MIRROR_Y,
    )
}

pub fn biome_config_hash() -> Field {
    config_hash(
        PLANETHASH_KEY,
        BIOMEBASE_KEY,
        PERLIN_LENGTH_SCALE,
        PERLIN_MIRROR_X,
        PERLIN_MIRROR_Y,
    )
}

pub unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress) {
    setup_with_params(DEFAULT_REVEAL_COOLDOWN, PLANET_RARITY, MAX_LOCATION_ID)
}

pub unconstrained fn setup_with_cooldown(
    location_reveal_cooldown: u32
) -> (TestEnvironment, AztecAddress, AztecAddress) {
    setup_with_params(location_reveal_cooldown, PLANET_RARITY, MAX_LOCATION_ID)
}

pub unconstrained fn setup_with_params(
    location_reveal_cooldown: u32,
    planet_rarity: u64,
    max_location_id: Field
) -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();
    let admin = env.create_light_account();

    let config = GameConfig::new(
        PLANETHASH_KEY,
        SPACETYPE_KEY,
        BIOMEBASE_KEY,
        PERLIN_LENGTH_SCALE,
        PERLIN_MIRROR_X,
        PERLIN_MIRROR_Y,
        INIT_PERLIN_MIN,
        INIT_PERLIN_MAX,
        WORLD_RADIUS,
        SPAWN_RIM_AREA,
        location_reveal_cooldown,
        planet_rarity,
        max_location_id,
    );
    let nft_initializer_call_interface =
        NFT::interface().constructor(admin);
    let nft_contract_address =
        env.deploy("../nft/NFT").with_public_initializer(
            admin,
            nft_initializer_call_interface,
        );

    let initializer_call_interface =
        DarkForest::interface().constructor(admin, config, nft_contract_address);
    let contract_address =
        env.deploy("DarkForest").with_public_initializer(admin, initializer_call_interface);

    env.call_public(
        admin,
        NFT::at(nft_contract_address).set_minter(contract_address),
    );

    (env, contract_address, admin)
}
