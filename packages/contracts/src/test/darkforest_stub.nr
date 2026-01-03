use crate::test::utils;
use crate::{
    mimc::mimc_sponge_2_220,
    perlin::multi_scale_perlin,
    utils::pow2_frac_q32,
    DarkForest,
};
use dep::aztec::protocol_types::address::AztecAddress;
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::protocol_types::traits::ToField;
use dep::darkforest_nft::NFT;

pub global INIT_X: Field = 990;
pub global INIT_Y: Field = 0;
pub global INIT_RADIUS: u64 = 1000;
// Precomputed for PLANETHASH_KEY=42 with MiMC, valid under PLANET_RARITY=16384.
pub global REAL_INIT_X: Field = 1;
pub global REAL_INIT_Y: Field = 4863;
pub global REAL_INIT_RADIUS: u64 = 4864;

pub global REVEAL_X: Field = 123;
pub global REVEAL_Y: Field = 456;
pub global REVEAL_X_2: Field = 124;
pub global REVEAL_Y_2: Field = 456;
pub global HOME_PLANET_POPULATION: u64 = 50000;
pub global MOVE_X_2: Field = 990;
pub global MOVE_Y_2: Field = 10;
pub global MOVE_DIST_MAX: u64 = 10;
pub global MOVE_POP_MOVED: u64 = 10000;
pub global CAPTURE_X_2: Field = 990;
pub global CAPTURE_Y_2: Field = 1;
pub global CAPTURE_DIST_MAX: u64 = 1;
pub global PLANET_TYPE_PLANET: u8 = 0;
pub global PLANET_TYPE_RUINS: u8 = 2;
pub global PLANET_TYPE_TRADING_POST: u8 = 3;
pub global ARTIFACT_TYPE_UNKNOWN: u8 = 0;
pub global ARTIFACT_TYPE_MONOLITH: u8 = 1;
pub global ARTIFACT_TYPE_COLOSSUS: u8 = 2;
pub global ARTIFACT_TYPE_SPACESHIP: u8 = 3;
pub global ARTIFACT_TYPE_PYRAMID: u8 = 4;
pub global ARTIFACT_TYPE_WORMHOLE: u8 = 5;
pub global ARTIFACT_TYPE_PLANETARY_SHIELD: u8 = 6;
pub global ARTIFACT_TYPE_PHOTOID_CANNON: u8 = 7;
pub global ARTIFACT_TYPE_BLOOM_FILTER: u8 = 8;
pub global ARTIFACT_TYPE_BLACK_DOMAIN: u8 = 9;
pub global ARTIFACT_TYPE_SHIP_MOTHERSHIP: u8 = 10;
pub global ARTIFACT_TYPE_SHIP_CRESCENT: u8 = 11;
pub global ARTIFACT_TYPE_SHIP_WHALE: u8 = 12;
pub global ARTIFACT_TYPE_SHIP_GEAR: u8 = 13;
pub global ARTIFACT_TYPE_SHIP_TITAN: u8 = 14;
pub global ARTIFACT_RARITY_UNKNOWN: u8 = 0;
pub global ARTIFACT_RARITY_COMMON: u8 = 1;
pub global ARTIFACT_RARITY_RARE: u8 = 2;
pub global ARTIFACT_RARITY_EPIC: u8 = 3;
pub global ARTIFACT_RARITY_LEGENDARY: u8 = 4;
pub global ARTIFACT_RARITY_MYTHIC: u8 = 5;
pub global ARRIVAL_TYPE_NORMAL: u8 = 1;
pub global ARRIVAL_TYPE_PHOTOID: u8 = 2;
pub global ARRIVAL_TYPE_WORMHOLE: u8 = 3;
pub global PHOTOID_ACTIVATION_DELAY_BLOCKS: u32 = 4;
pub global WORMHOLE_SPEED_MODIFIERS: [u64; 6] = [1, 2, 4, 8, 16, 32];
pub global SHIP_ID_SALT: u64 = 1000;
pub global BIOME_UNKNOWN: u8 = 0;
pub global BIOME_OCEAN: u8 = 1;
pub global BIOME_FOREST: u8 = 2;
pub global BIOME_GRASSLAND: u8 = 3;
pub global BIOME_TUNDRA: u8 = 4;
pub global BIOME_SWAMP: u8 = 5;
pub global BIOME_DESERT: u8 = 6;
pub global BIOME_ICE: u8 = 7;
pub global BIOME_WASTELAND: u8 = 8;
pub global BIOME_LAVA: u8 = 9;
pub global BIOME_CORRUPTED: u8 = 10;
pub global SPACE_TYPE_NEBULA: u8 = 0;
pub global SPACE_TYPE_SPACE: u8 = 1;
pub global SPACE_TYPE_DEEP_SPACE: u8 = 2;
pub global SPACE_TYPE_DEAD_SPACE: u8 = 3;
pub global UPGRADE_BRANCH_DEFENSE: u8 = 0;
pub global MAX_ADVANCE_BLOCKS: u64 = 220;
pub global SEARCH_MAX_DIST: u64 = 30;
pub global SEARCH_MAX_DIST_RUINS: u64 = 200;
pub global POP_LARGE: u64 = 29999;
pub global U64_MASK: u128 = 0xFFFF_FFFF_FFFF_FFFF;

fn unpack_u64_low(packed: Field) -> u64 {
    let value: u128 = packed as u128;
    (value & U64_MASK) as u64
}

fn unpack_u64_high(packed: Field) -> u64 {
    let value: u128 = packed as u128;
    ((value >> 64) & U64_MASK) as u64
}

fn unpack_arrival_meta(packed: Field) -> (u32, u32, u8) {
    let value: u128 = packed as u128;
    let departure_block = (value & 0xFFFF_FFFF) as u32;
    let arrival_block = ((value >> 32) & 0xFFFF_FFFF) as u32;
    let arrival_type = ((value >> 64) & 0xFF) as u8;
    (departure_block, arrival_block, arrival_type)
}

fn expected_location_id(x: Field, y: Field) -> Field {
    mimc_sponge_2_220(x, y, utils::PLANETHASH_KEY)
}

fn expected_perlin(x: Field, y: Field) -> u64 {
    multi_scale_perlin(
        x,
        y,
        utils::SPACETYPE_KEY,
        utils::PERLIN_LENGTH_SCALE,
        utils::PERLIN_MIRROR_X,
        utils::PERLIN_MIRROR_Y,
    )
}

fn expected_space_type(perlin: u64) -> u8 {
    if perlin >= utils::PERLIN_THRESHOLD_3 {
        SPACE_TYPE_DEAD_SPACE
    } else if perlin >= utils::PERLIN_THRESHOLD_2 {
        SPACE_TYPE_DEEP_SPACE
    } else if perlin >= utils::PERLIN_THRESHOLD_1 {
        SPACE_TYPE_SPACE
    } else {
        SPACE_TYPE_NEBULA
    }
}

fn expected_planet_level(location_id: Field, space_type: u8) -> u8 {
    let loc_bytes: [u8; 32] = location_id.to_be_bytes();
    let mut level_uint: u64 = 0;
    level_uint += (loc_bytes[4] as u64) << 16;
    level_uint += (loc_bytes[5] as u64) << 8;
    level_uint += loc_bytes[6] as u64;

    let mut level: u8 = 0;
    let mut found = false;
    for i in 0..10 {
        let idx = 9 - i;
        let threshold = utils::PLANET_LEVEL_THRESHOLDS[idx];
        if (!found) & (level_uint < threshold) {
            level = idx as u8;
            found = true;
        }
    }

    if (space_type == SPACE_TYPE_NEBULA) & (level > 4u8) {
        level = 4;
    }
    if (space_type == SPACE_TYPE_SPACE) & (level > 5u8) {
        level = 5;
    }
    if level > utils::MAX_NATURAL_PLANET_LEVEL {
        level = utils::MAX_NATURAL_PLANET_LEVEL;
    }

    level
}

fn expected_planet_type(location_id: Field, space_type: u8, level: u8) -> u8 {
    let loc_bytes: [u8; 32] = location_id.to_be_bytes();
    let weights = utils::PLANET_TYPE_WEIGHTS[space_type as u32][level as u32];
    let mut weight_sum: u64 = 0;
    for i in 0..5 {
        weight_sum += weights[i];
    }
    assert(weight_sum > 0);

    let mut thresholds: [u64; 5] = [0; 5];
    let mut remaining = weight_sum;
    for i in 0..5 {
        remaining = remaining - weights[i];
        thresholds[i] = (remaining * 256) / weight_sum;
    }

    let type_byte = loc_bytes[8] as u64;
    let mut planet_type: u8 = 0;
    let mut found = false;
    for i in 0..5 {
        if (!found) & (type_byte >= thresholds[i]) {
            planet_type = i as u8;
            found = true;
        }
    }
    planet_type
}

fn expected_biomebase(x: Field, y: Field) -> u64 {
    multi_scale_perlin(
        x,
        y,
        utils::BIOMEBASE_KEY,
        utils::PERLIN_LENGTH_SCALE,
        utils::PERLIN_MIRROR_X,
        utils::PERLIN_MIRROR_Y,
    )
}

fn expected_biome(space_type: u8, biomebase: u64) -> u8 {
    if space_type == SPACE_TYPE_DEAD_SPACE {
        BIOME_CORRUPTED
    } else {
        let mut biome: u16 = (space_type as u16) * 3u16;
        if biomebase < utils::BIOME_THRESHOLD_1 {
            biome += 1;
        } else if biomebase < utils::BIOME_THRESHOLD_2 {
            biome += 2;
        } else {
            biome += 3;
        }
        biome as u8
    }
}

fn mod_255_from_bits(bits: [u1; 254], skip: u32) -> u8 {
    let mut rem: u16 = 0;
    for i in 0..254 {
        let idx = 253 - i;
        if idx >= skip {
            let mut bit_val: u16 = 0;
            if bits[idx] == 1 {
                bit_val = 1;
            }
            rem = (rem * 2 + bit_val) % 255;
        }
    }
    rem as u8
}

fn seed_last_bytes(seed: Field) -> (u8, u8) {
    let bits: [u1; 254] = seed.to_le_bits();
    let last_byte = mod_255_from_bits(bits, 0);
    let mut seed_mod_256: u32 = 0;
    for i in 0..8 {
        if bits[i] == 1 {
            seed_mod_256 += 1u32 << i;
        }
    }
    let mut second_last = mod_255_from_bits(bits, 8);
    if seed_mod_256 < (last_byte as u32) {
        second_last = if second_last == 0 { 254 } else { second_last - 1 };
    }
    (last_byte, second_last)
}

fn expected_artifact_type_and_bonus(seed: Field, biome: u8) -> (u8, u8) {
    let (last_byte, second_last) = seed_last_bytes(seed);

    let mut artifact_type = ARTIFACT_TYPE_PYRAMID;
    if last_byte < 39u8 {
        artifact_type = ARTIFACT_TYPE_MONOLITH;
    } else if last_byte < 78u8 {
        artifact_type = ARTIFACT_TYPE_COLOSSUS;
    } else if last_byte < 156u8 {
        artifact_type = ARTIFACT_TYPE_PYRAMID;
    } else if last_byte < 171u8 {
        artifact_type = ARTIFACT_TYPE_WORMHOLE;
    } else if last_byte < 186u8 {
        artifact_type = ARTIFACT_TYPE_PLANETARY_SHIELD;
    } else if last_byte < 201u8 {
        artifact_type = ARTIFACT_TYPE_PHOTOID_CANNON;
    } else if last_byte < 216u8 {
        artifact_type = ARTIFACT_TYPE_BLOOM_FILTER;
    } else if last_byte < 231u8 {
        artifact_type = ARTIFACT_TYPE_BLACK_DOMAIN;
    } else {
        if biome == BIOME_ICE {
            artifact_type = ARTIFACT_TYPE_PLANETARY_SHIELD;
        } else if biome == BIOME_LAVA {
            artifact_type = ARTIFACT_TYPE_PHOTOID_CANNON;
        } else if biome == BIOME_WASTELAND {
            artifact_type = ARTIFACT_TYPE_BLOOM_FILTER;
        } else if biome == BIOME_CORRUPTED {
            artifact_type = ARTIFACT_TYPE_BLACK_DOMAIN;
        } else {
            artifact_type = ARTIFACT_TYPE_WORMHOLE;
        }
        artifact_type = ARTIFACT_TYPE_PHOTOID_CANNON;
    }

    let mut bonus: u8 = 0;
    if second_last < 4u8 {
        bonus = 2;
    } else if second_last < 16u8 {
        bonus = 1;
    }

    (artifact_type, bonus)
}

fn expected_artifact_rarity(level: u8) -> u8 {
    if level <= 1u8 {
        ARTIFACT_RARITY_COMMON
    } else if level <= 3u8 {
        ARTIFACT_RARITY_RARE
    } else if level <= 5u8 {
        ARTIFACT_RARITY_EPIC
    } else if level <= 7u8 {
        ARTIFACT_RARITY_LEGENDARY
    } else {
        ARTIFACT_RARITY_MYTHIC
    }
}

fn expected_block_hash(block_number: u32) -> Field {
    mimc_sponge_2_220(block_number as Field, 0, utils::PLANETHASH_KEY)
}

fn expected_artifact_seed(
    location_id: Field,
    contract_address_field: Field,
    prospected_block_number: u32,
) -> Field {
    let block_hash = expected_block_hash(prospected_block_number);
    let seed1 = mimc_sponge_2_220(location_id, contract_address_field, utils::PLANETHASH_KEY);
    mimc_sponge_2_220(seed1, block_hash, utils::PLANETHASH_KEY)
}

fn expected_ship_id(location_id: Field, ship_type: u8) -> Field {
    let salt = (SHIP_ID_SALT + (ship_type as u64)) as Field;
    mimc_sponge_2_220(location_id, salt, utils::PLANETHASH_KEY)
}

fn ceil_sqrt_u128(value: u128, max: u64) -> u64 {
    let mut result: u64 = 0;
    let mut found = false;
    for i in 0..(max + 1) {
        if (!found) & (((i as u128) * (i as u128)) >= value) {
            result = i;
            found = true;
        }
    }
    assert(found);
    result
}

fn decayed_population(pop_moved: u64, dist: u64, range: u64, pop_cap: u64) -> u64 {
    let mut result = 0u64;
    if range != 0 {
        let x_fp = ((dist as u128) << 32) / (range as u128);
        let int_part = (x_fp >> 32) as u32;
        let frac_part = (x_fp & 0xFFFF_FFFF) as u32;

        let pow_frac = pow2_frac_q32(frac_part);
        let pop_scaled = (pop_moved as u128) << 32;
        let pop_after_frac = pop_scaled / pow_frac;
        let pop_after_int = if int_part >= 128 {
            0
        } else {
            pop_after_frac >> (int_part as u128)
        };

        let big_planet_debuff = (pop_cap / 20) as u128;
        result = if pop_after_int > big_planet_debuff {
            (pop_after_int - big_planet_debuff) as u64
        } else {
            0
        };
    }
    result
}

#[test]
unconstrained fn test_initializer_sets_admin() {
    let (mut env, contract_address, admin) = utils::setup();

    env.public_context_at(contract_address, |context| {
        let current_admin = context.storage_read(DarkForest::storage_layout().admin.slot);
        assert_eq(current_admin, admin);
    });
}

#[test]
unconstrained fn test_init_player_sets_home_and_planet() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let location_id = expected_location_id(INIT_X, INIT_Y);
    let perlin = expected_perlin(INIT_X, INIT_Y);

    env.public_context_at(contract_address, |context| {
        let player_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().players.slot, player);
        let stored_initialized = context.storage_read(player_slot);
        let stored_home = context.storage_read(player_slot + 1);
        assert_eq(stored_initialized, 1);
        assert_eq(stored_home, location_id);

        let planet_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().planets.slot, location_id);
        let stored_planet_initialized = context.storage_read(planet_slot);
        let stored_owner = context.storage_read(planet_slot + 1);
        let stored_perlin = context.storage_read(planet_slot + 2);
        let stored_population = context.storage_read(planet_slot + 3);
        let stored_planet_level = context.storage_read(planet_slot + 13);
        let stored_planet_type = context.storage_read(planet_slot + 14);
        let stored_space_type = context.storage_read(planet_slot + 15);
        let stored_is_home = context.storage_read(planet_slot + 16);
        assert_eq(stored_planet_initialized, 1);
        assert_eq(stored_owner, player);
        assert_eq(stored_perlin, perlin);
        assert_eq(stored_population, HOME_PLANET_POPULATION);
        assert_eq(stored_planet_level, 0);
        assert_eq(stored_planet_type, PLANET_TYPE_PLANET);
        assert_eq(stored_space_type, expected_space_type(perlin));
        assert_eq(stored_is_home, 1);
    });
}

#[test]
unconstrained fn test_init_player_real_planet_rarity() {
    let (mut env, contract_address, _) = utils::setup_with_params(
        utils::DEFAULT_REVEAL_COOLDOWN,
        utils::REAL_PLANET_RARITY,
        utils::REAL_MAX_LOCATION_ID,
    );
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            REAL_INIT_X,
            REAL_INIT_Y,
            REAL_INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::REAL_MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let location_id = expected_location_id(REAL_INIT_X, REAL_INIT_Y);

    env.public_context_at(contract_address, |context| {
        let player_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().players.slot, player);
        let stored_initialized = context.storage_read(player_slot);
        let stored_home = context.storage_read(player_slot + 1);
        assert_eq(stored_initialized, 1);
        assert_eq(stored_home, location_id);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_init_player_bad_config_hash() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY + 1,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::REAL_MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_init_player_location_out_of_range() {
    let (mut env, contract_address, _) = utils::setup_with_params(
        utils::DEFAULT_REVEAL_COOLDOWN,
        utils::PLANET_RARITY,
        0,
    );
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_init_player_duplicate() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );
    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_init_player_home_constraints() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    let mut found = false;
    let mut bad_x: Field = 0;
    let mut bad_y: Field = 0;
    let mut bad_radius: u64 = 0;

    for offset in 0..800 {
        let candidate = 200 + offset;
        let x = candidate as Field;
        let y = 0 as Field;
        let perlin = expected_perlin(x, y);
        let perlin_ok = (perlin >= utils::INIT_PERLIN_MIN) & (perlin < utils::INIT_PERLIN_MAX);
        if perlin_ok {
            let location_id = expected_location_id(x, y);
            let space_type = expected_space_type(perlin);
            let level = expected_planet_level(location_id, space_type);
            let planet_type = expected_planet_type(location_id, space_type, level);
            let home_ok = (level == 0) & (planet_type == PLANET_TYPE_PLANET);
            if (!found) & !home_ok {
                found = true;
                bad_x = x;
                bad_y = y;
                bad_radius = (candidate as u64) + 1;
            }
        }
    }
    assert(found);

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            bad_x,
            bad_y,
            bad_radius,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_init_outside_ring() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            0,
            0,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );
}

#[test]
unconstrained fn test_reveal_location_sets_coords() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            REVEAL_X,
            REVEAL_Y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let location_id = expected_location_id(REVEAL_X, REVEAL_Y);
    let perlin = expected_perlin(REVEAL_X, REVEAL_Y);

    env.public_context_at(contract_address, |context| {
        let reveal_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().revealed.slot, location_id);
        let stored_location = context.storage_read(reveal_slot);
        let stored_x = context.storage_read(reveal_slot + 1);
        let stored_y = context.storage_read(reveal_slot + 2);
        let stored_revealer = context.storage_read(reveal_slot + 3);
        assert_eq(stored_location, location_id);
        assert_eq(stored_x, REVEAL_X);
        assert_eq(stored_y, REVEAL_Y);
        assert_eq(stored_revealer, player);

        let planet_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().planets.slot, location_id);
        let stored_planet_initialized = context.storage_read(planet_slot);
        let stored_perlin = context.storage_read(planet_slot + 2);
        assert_eq(stored_planet_initialized, 1);
        assert_eq(stored_perlin, perlin);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_reveal_bad_config_hash() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            REVEAL_X,
            REVEAL_Y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY + 1,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
}

#[test]
unconstrained fn test_move_creates_arrival() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let from_location_id = expected_location_id(INIT_X, INIT_Y);
    let to_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);
    let mut pre_population: u64 = 0;
    let pre_population_ref = &mut pre_population;

    env.public_context_at(contract_address, |context| {
        let planet_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().planets.slot, from_location_id);
        *pre_population_ref = context.storage_read(planet_slot + 3);
    });

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    env.public_context_at(contract_address, |context| {
        let next_arrival_id =
            context.storage_read(DarkForest::storage_layout().next_arrival_id.slot);
        assert_eq(next_arrival_id, 2);

        let arrival_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().arrivals.slot,
            1,
        );
        let stored_player = context.storage_read(arrival_slot);
        let stored_from = context.storage_read(arrival_slot + 1);
        let stored_to = context.storage_read(arrival_slot + 2);
        let pop_silver = context.storage_read(arrival_slot + 3);
        let stored_pop_arriving = unpack_u64_high(pop_silver);
        assert_eq(stored_player, player);
        assert_eq(stored_from, from_location_id);
        assert_eq(stored_to, to_location_id);
        assert(stored_pop_arriving > 0);

        let planet_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().planets.slot, from_location_id);
        let stored_population = context.storage_read(planet_slot + 3);
        assert(stored_population < pre_population);
        assert(stored_population + MOVE_POP_MOVED >= pre_population);

        let arrival_list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_arrivals.slot,
            to_location_id,
        );
        let packed = context.storage_read(arrival_list_slot);
        let stored_arrival_id = unpack_u64_low(packed);
        assert_eq(stored_arrival_id, 1);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_move_radius_above_world() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS + 1,
            MOVE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_move_too_much_population() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            HOME_PLANET_POPULATION + 1000,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );
}

#[test]
unconstrained fn test_apply_arrival_captures_unowned_planet() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            CAPTURE_X_2,
            CAPTURE_Y_2,
            utils::WORLD_RADIUS,
            CAPTURE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).resolve_arrival(1)
    );

    let to_location_id = expected_location_id(CAPTURE_X_2, CAPTURE_Y_2);
    env.public_context_at(contract_address, |context| {
        let planet_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().planets.slot, to_location_id);
        let stored_owner = context.storage_read(planet_slot + 1);
        let stored_population = context.storage_read(planet_slot + 3);
        assert_eq(stored_owner, player);
        assert(stored_population > 0);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_arrival_too_early() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            INIT_X,
            INIT_Y + 2,
            utils::WORLD_RADIUS,
            2,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).resolve_arrival(1)
    );
}

#[test(should_fail)]
unconstrained fn test_fail_reveal_duplicate() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            REVEAL_X,
            REVEAL_Y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            REVEAL_X,
            REVEAL_Y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_reveal_cooldown() {
    let (mut env, contract_address, _) = utils::setup_with_cooldown(1000);
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            REVEAL_X,
            REVEAL_Y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            REVEAL_X_2,
            REVEAL_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
}

#[test]
unconstrained fn test_upgrade_planet_success() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let mut home_range: u64 = 0;
    let mut home_pop_cap: u64 = 0;
    let mut home_speed: u64 = 0;
    let home_range_ref = &mut home_range;
    let home_pop_cap_ref = &mut home_pop_cap;
    let home_speed_ref = &mut home_speed;

    env.public_context_at(contract_address, |context| {
        let planet_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().planets.slot, home_location_id);
        *home_pop_cap_ref = context.storage_read(planet_slot + 4);
        *home_range_ref = context.storage_read(planet_slot + 9);
        *home_speed_ref = context.storage_read(planet_slot + 10);
    });

    let mut planet_found = false;
    let mut planet_x: Field = 0;
    let mut planet_y: Field = 0;
    let mut planet_dist: u64 = 0;
    let mut planet_location_id: Field = 0;
    let mut planet_silver_cap: u64 = 0;
    let pop_moved: u64 = HOME_PLANET_POPULATION - 1;

    for dx in 0..(SEARCH_MAX_DIST + 1) {
        for dy in 0..(SEARCH_MAX_DIST + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!planet_found) & !is_home {
                let dist_sq = (dx as u128) * (dx as u128) + (dy as u128) * (dy as u128);
                let dist = ceil_sqrt_u128(dist_sq, SEARCH_MAX_DIST);
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if (level > 0) & (planet_type == PLANET_TYPE_PLANET) {
                    env.call_private(
                        player,
                        DarkForest::at(contract_address).reveal_location(
                            x,
                            y,
                            utils::PLANETHASH_KEY,
                            utils::SPACETYPE_KEY,
                            utils::PERLIN_LENGTH_SCALE,
                            utils::PERLIN_MIRROR_X,
                            utils::PERLIN_MIRROR_Y,
                            utils::spacetype_config_hash(),
                            utils::MAX_LOCATION_ID,
                        )
                    );

                    let mut stored_population: u64 = 0;
                    let mut stored_defense: u64 = 0;
                    let mut stored_silver_cap: u64 = 0;
                    let pop_ref = &mut stored_population;
                    let def_ref = &mut stored_defense;
                    let silver_cap_ref = &mut stored_silver_cap;

                    env.public_context_at(contract_address, |context| {
                        let planet_slot = derive_storage_slot_in_map(
                            DarkForest::storage_layout().planets.slot,
                            location_id,
                        );
                        *pop_ref = context.storage_read(planet_slot + 3);
                        *def_ref = context.storage_read(planet_slot + 11);
                        *silver_cap_ref = context.storage_read(planet_slot + 7);
                    });

                    let req_planet =
                        ((stored_population as u128) * (stored_defense as u128)) / 100u128;
                    let pop_arriving =
                        decayed_population(pop_moved, dist, home_range, home_pop_cap);
                    if (pop_arriving as u128) >= req_planet {
                        planet_found = true;
                        planet_x = x;
                        planet_y = y;
                        planet_dist = dist;
                        planet_location_id = location_id;
                        planet_silver_cap = stored_silver_cap;
                    }
                }
            }
        }
    }
    assert(planet_found);

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            planet_x,
            planet_y,
            utils::WORLD_RADIUS,
            planet_dist,
            pop_moved,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    let mut travel_time_planet = (planet_dist * 100) / home_speed;
    if travel_time_planet == 0 {
        travel_time_planet = 1;
    }
    let mut advance_planet = travel_time_planet - 1;
    assert(advance_planet <= MAX_ADVANCE_BLOCKS);
    for i in 0..MAX_ADVANCE_BLOCKS {
        if (i as u64) < advance_planet {
            env.call_private(
                player,
                DarkForest::at(contract_address).reveal_location(
                    (6000 + (i as u64)) as Field,
                    0,
                    utils::PLANETHASH_KEY,
                    utils::SPACETYPE_KEY,
                    utils::PERLIN_LENGTH_SCALE,
                    utils::PERLIN_MIRROR_X,
                    utils::PERLIN_MIRROR_Y,
                    utils::spacetype_config_hash(),
                    utils::MAX_LOCATION_ID,
                )
            );
        }
    }
    env.call_private(player, DarkForest::at(contract_address).resolve_arrival(1));

    let mut pre_pop_cap: u64 = 0;
    let mut pre_pop_growth: u64 = 0;
    let mut pre_range: u64 = 0;
    let mut pre_speed: u64 = 0;
    let mut pre_defense: u64 = 0;
    let mut pre_silver: u64 = 0;
    let mut pre_upgrade_state0: u8 = 0;
    let pre_pop_cap_ref = &mut pre_pop_cap;
    let pre_pop_growth_ref = &mut pre_pop_growth;
    let pre_range_ref = &mut pre_range;
    let pre_speed_ref = &mut pre_speed;
    let pre_defense_ref = &mut pre_defense;
    let pre_silver_ref = &mut pre_silver;
    let pre_upgrade_state0_ref = &mut pre_upgrade_state0;

    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            planet_location_id,
        );
        *pre_pop_cap_ref = context.storage_read(planet_slot + 4);
        *pre_pop_growth_ref = context.storage_read(planet_slot + 5);
        *pre_range_ref = context.storage_read(planet_slot + 9);
        *pre_speed_ref = context.storage_read(planet_slot + 10);
        *pre_defense_ref = context.storage_read(planet_slot + 11);
        *pre_silver_ref = context.storage_read(planet_slot + 6);
        *pre_upgrade_state0_ref = context.storage_read(planet_slot + 17);
    });

    let upgrade_cost = ((planet_silver_cap as u128) * 20u128) / 100u128;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_silver(
            planet_location_id,
            upgrade_cost as u64,
        )
    );
    pre_silver = upgrade_cost as u64;

    env.call_private(
        player,
        DarkForest::at(contract_address).upgrade_planet(
            planet_location_id,
            UPGRADE_BRANCH_DEFENSE,
        )
    );

    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            planet_location_id,
        );
        let stored_pop_cap = context.storage_read(planet_slot + 4);
        let stored_pop_growth = context.storage_read(planet_slot + 5);
        let stored_range = context.storage_read(planet_slot + 9);
        let stored_speed = context.storage_read(planet_slot + 10);
        let stored_defense = context.storage_read(planet_slot + 11);
        let stored_silver = context.storage_read(planet_slot + 6);
        let stored_upgrade_state0 = context.storage_read(planet_slot + 17);

        assert_eq(
            stored_pop_cap,
            ((pre_pop_cap as u128) * 120u128 / 100u128) as u64
        );
        assert_eq(
            stored_pop_growth,
            ((pre_pop_growth as u128) * 120u128 / 100u128) as u64
        );
        assert_eq(stored_range, pre_range);
        assert_eq(stored_speed, pre_speed);
        assert_eq(
            stored_defense,
            ((pre_defense as u128) * 120u128 / 100u128) as u64
        );
        assert_eq(
            stored_silver,
            (pre_silver as u128 - upgrade_cost) as u64
        );
        assert_eq(stored_upgrade_state0, (pre_upgrade_state0 + 1));
    });
}

#[test(should_fail)]
unconstrained fn test_fail_upgrade_invalid_branch() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let location_id = expected_location_id(INIT_X, INIT_Y);
    env.call_private(
        player,
        DarkForest::at(contract_address).upgrade_planet(
            location_id,
            3,
        )
    );
}

#[test]
unconstrained fn test_prospect_planet_success() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let mut ruins_found = false;
    let mut ruins_location_id: Field = 0;

    for dx in 0..(SEARCH_MAX_DIST_RUINS + 1) {
        for dy in 0..(SEARCH_MAX_DIST_RUINS + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!ruins_found) & !is_home {
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if planet_type == PLANET_TYPE_RUINS {
                    env.call_private(
                        player,
                        DarkForest::at(contract_address).reveal_location(
                            x,
                            y,
                            utils::PLANETHASH_KEY,
                            utils::SPACETYPE_KEY,
                            utils::PERLIN_LENGTH_SCALE,
                            utils::PERLIN_MIRROR_X,
                            utils::PERLIN_MIRROR_Y,
                            utils::spacetype_config_hash(),
                            utils::MAX_LOCATION_ID,
                        )
                    );

                    ruins_found = true;
                    ruins_location_id = location_id;
                }
            }
        }
    }
    assert(ruins_found);

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            ruins_location_id,
            player,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).prospect_planet(ruins_location_id)
    );

    let mut stored_tried: u8 = 0;
    let mut stored_prospected: u32 = 0;
    let tried_ref = &mut stored_tried;
    let prospected_ref = &mut stored_prospected;
    env.public_context_at(contract_address, |context| {
        let state_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifact_state.slot,
            ruins_location_id,
        );
        *tried_ref = context.storage_read(state_slot);
        *prospected_ref = context.storage_read(state_slot + 1);
    });

    assert_eq(stored_tried, 0);
    assert(stored_prospected > 0);
}

#[test(should_fail)]
unconstrained fn test_fail_prospect_non_ruins() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let location_id = expected_location_id(INIT_X, INIT_Y);
    env.call_private(
        player,
        DarkForest::at(contract_address).prospect_planet(location_id)
    );
}

#[test]
unconstrained fn test_find_artifact_success() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let mut ruins_found = false;
    let mut ruins_location_id: Field = 0;
    let mut ruins_x: Field = 0;
    let mut ruins_y: Field = 0;

    for dx in 0..(SEARCH_MAX_DIST_RUINS + 1) {
        for dy in 0..(SEARCH_MAX_DIST_RUINS + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!ruins_found) & !is_home {
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if planet_type == PLANET_TYPE_RUINS {
                    ruins_found = true;
                    ruins_location_id = location_id;
                    ruins_x = x;
                    ruins_y = y;
                }
            }
        }
    }
    assert(ruins_found);

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            ruins_x,
            ruins_y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            ruins_location_id,
            player,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).prospect_planet(ruins_location_id)
    );

    let biomebase = expected_biomebase(ruins_x, ruins_y);
    env.call_private(
        player,
        DarkForest::at(contract_address).find_artifact(
            ruins_x,
            ruins_y,
            biomebase,
            utils::PLANETHASH_KEY,
            utils::BIOMEBASE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::biome_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let mut stored_tried: u8 = 0;
    let mut stored_prospected: u32 = 0;
    let mut stored_artifact_id: Field = 0;
    let tried_ref = &mut stored_tried;
    let prospected_ref = &mut stored_prospected;
    let artifact_id_ref = &mut stored_artifact_id;
    env.public_context_at(contract_address, |context| {
        let state_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifact_state.slot,
            ruins_location_id,
        );
        *tried_ref = context.storage_read(state_slot);
        *prospected_ref = context.storage_read(state_slot + 1);

        let artifact_list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            ruins_location_id,
        );
        *artifact_id_ref = context.storage_read(artifact_list_slot);
    });

    assert_eq(stored_tried, 1);
    assert(stored_prospected > 0);
    assert(stored_artifact_id != 0);

    let expected_seed = expected_artifact_seed(
        ruins_location_id,
        contract_address.to_field(),
        stored_prospected,
    );
    assert_eq(stored_artifact_id, expected_seed);

    let mut stored_location: Field = 0;
    let mut nft_contract = AztecAddress::zero();
    let location_ref = &mut stored_location;
    let nft_contract_ref = &mut nft_contract;
    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            expected_seed,
        );
        *location_ref = context.storage_read(location_slot);
        *nft_contract_ref = context.storage_read(DarkForest::storage_layout().nft_contract.slot);
    });

    assert_eq(stored_location, ruins_location_id);

    let mut stored_owner = AztecAddress::zero();
    let owner_ref = &mut stored_owner;
    env.public_context_at(nft_contract, |context| {
        let owner_slot = derive_storage_slot_in_map(
            NFT::storage_layout().public_owners.slot,
            expected_seed,
        );
        *owner_ref = context.storage_read(owner_slot);
    });
    assert_eq(stored_owner, contract_address);

    let perlin = expected_perlin(ruins_x, ruins_y);
    let space_type = expected_space_type(perlin);
    let level = expected_planet_level(ruins_location_id, space_type);
    let biome = expected_biome(space_type, biomebase);
    let (expected_type, bonus) = expected_artifact_type_and_bonus(expected_seed, biome);
    let level_with_bonus = (level as u16 + bonus as u16) as u8;
    let expected_rarity = expected_artifact_rarity(level_with_bonus);

    let mut stored_initialized: u8 = 0;
    let mut stored_id: Field = 0;
    let mut stored_planet: Field = 0;
    let mut stored_rarity: u8 = 0;
    let mut stored_biome: u8 = 0;
    let mut stored_discoverer = player;
    let mut stored_type: u8 = 0;
    let init_ref = &mut stored_initialized;
    let id_ref = &mut stored_id;
    let planet_ref = &mut stored_planet;
    let rarity_ref = &mut stored_rarity;
    let biome_ref = &mut stored_biome;
    let discoverer_ref = &mut stored_discoverer;
    let type_ref = &mut stored_type;
    env.public_context_at(contract_address, |context| {
        let artifact_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifacts.slot,
            expected_seed,
        );
        *init_ref = context.storage_read(artifact_slot);
        *id_ref = context.storage_read(artifact_slot + 1);
        *planet_ref = context.storage_read(artifact_slot + 2);
        *rarity_ref = context.storage_read(artifact_slot + 3);
        *biome_ref = context.storage_read(artifact_slot + 4);
        *discoverer_ref = context.storage_read(artifact_slot + 5);
        *type_ref = context.storage_read(artifact_slot + 6);
    });

    assert_eq(stored_initialized, 1);
    assert_eq(stored_id, expected_seed);
    assert_eq(stored_planet, ruins_location_id);
    assert_eq(stored_rarity, expected_rarity);
    assert_eq(stored_biome, biome);
    assert_eq(stored_discoverer, player);
    assert_eq(stored_type, expected_type);
}

#[test(should_fail)]
unconstrained fn test_fail_find_artifact_not_prospected() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let mut ruins_found = false;
    let mut ruins_location_id: Field = 0;
    let mut ruins_x: Field = 0;
    let mut ruins_y: Field = 0;

    for dx in 0..(SEARCH_MAX_DIST_RUINS + 1) {
        for dy in 0..(SEARCH_MAX_DIST_RUINS + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!ruins_found) & !is_home {
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if planet_type == PLANET_TYPE_RUINS {
                    ruins_found = true;
                    ruins_location_id = location_id;
                    ruins_x = x;
                    ruins_y = y;
                }
            }
        }
    }
    assert(ruins_found);

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            ruins_x,
            ruins_y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            ruins_location_id,
            player,
        )
    );

    let biomebase = expected_biomebase(ruins_x, ruins_y);
    env.call_private(
        player,
        DarkForest::at(contract_address).find_artifact(
            ruins_x,
            ruins_y,
            biomebase,
            utils::PLANETHASH_KEY,
            utils::BIOMEBASE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::biome_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_find_artifact_already_tried() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let mut ruins_found = false;
    let mut ruins_location_id: Field = 0;
    let mut ruins_x: Field = 0;
    let mut ruins_y: Field = 0;

    for dx in 0..(SEARCH_MAX_DIST_RUINS + 1) {
        for dy in 0..(SEARCH_MAX_DIST_RUINS + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!ruins_found) & !is_home {
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if planet_type == PLANET_TYPE_RUINS {
                    ruins_found = true;
                    ruins_location_id = location_id;
                    ruins_x = x;
                    ruins_y = y;
                }
            }
        }
    }
    assert(ruins_found);

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            ruins_x,
            ruins_y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            ruins_location_id,
            player,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).prospect_planet(ruins_location_id)
    );

    let biomebase = expected_biomebase(ruins_x, ruins_y);
    env.call_private(
        player,
        DarkForest::at(contract_address).find_artifact(
            ruins_x,
            ruins_y,
            biomebase,
            utils::PLANETHASH_KEY,
            utils::BIOMEBASE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::biome_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).find_artifact(
            ruins_x,
            ruins_y,
            biomebase,
            utils::PLANETHASH_KEY,
            utils::BIOMEBASE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::biome_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_find_artifact_non_ruins() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let biomebase = expected_biomebase(INIT_X, INIT_Y);
    env.call_private(
        player,
        DarkForest::at(contract_address).find_artifact(
            INIT_X,
            INIT_Y,
            biomebase,
            utils::PLANETHASH_KEY,
            utils::BIOMEBASE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::biome_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );
}

#[test]
unconstrained fn test_spacetime_rip_withdraw_deposit_roundtrip() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let mut ruins_found = false;
    let mut ruins_location_id: Field = 0;
    let mut ruins_x: Field = 0;
    let mut ruins_y: Field = 0;

    for dx in 0..(SEARCH_MAX_DIST_RUINS + 1) {
        for dy in 0..(SEARCH_MAX_DIST_RUINS + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!ruins_found) & !is_home {
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if planet_type == PLANET_TYPE_RUINS {
                    ruins_found = true;
                    ruins_location_id = location_id;
                    ruins_x = x;
                    ruins_y = y;
                }
            }
        }
    }
    assert(ruins_found);

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            ruins_x,
            ruins_y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            ruins_location_id,
            player,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).prospect_planet(ruins_location_id)
    );

    let biomebase = expected_biomebase(ruins_x, ruins_y);
    env.call_private(
        player,
        DarkForest::at(contract_address).find_artifact(
            ruins_x,
            ruins_y,
            biomebase,
            utils::PLANETHASH_KEY,
            utils::BIOMEBASE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::biome_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let mut artifact_id: Field = 0;
    let artifact_id_ref = &mut artifact_id;
    env.public_context_at(contract_address, |context| {
        let artifact_list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            ruins_location_id,
        );
        *artifact_id_ref = context.storage_read(artifact_list_slot);
    });
    assert(artifact_id != 0);

    let mut nft_contract = AztecAddress::zero();
    let nft_contract_ref = &mut nft_contract;
    env.public_context_at(contract_address, |context| {
        let nft_slot = DarkForest::storage_layout().nft_contract.slot;
        *nft_contract_ref = context.storage_read(nft_slot);
    });

    let mut nft_owner_after_find = AztecAddress::zero();
    let nft_owner_after_find_ref = &mut nft_owner_after_find;
    env.public_context_at(nft_contract, |context| {
        let owner_slot = derive_storage_slot_in_map(
            NFT::storage_layout().public_owners.slot,
            artifact_id,
        );
        *nft_owner_after_find_ref = context.storage_read(owner_slot);
    });
    assert_eq(nft_owner_after_find, contract_address);

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_type_and_level(
            ruins_location_id,
            PLANET_TYPE_TRADING_POST,
            9,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).trade_artifact(
            ruins_location_id,
            artifact_id,
            true,
        )
    );

    let mut stored_location: Field = 0;
    let mut stored_slot0: Field = 0;
    let location_ref = &mut stored_location;
    let slot0_ref = &mut stored_slot0;
    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            artifact_id,
        );
        *location_ref = context.storage_read(location_slot);
        let list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            ruins_location_id,
        );
        *slot0_ref = context.storage_read(list_slot);
    });

    assert_eq(stored_location, 0);
    assert_eq(stored_slot0, 0);

    let mut nft_owner_after_withdraw = AztecAddress::zero();
    let nft_owner_after_withdraw_ref = &mut nft_owner_after_withdraw;
    env.public_context_at(nft_contract, |context| {
        let owner_slot = derive_storage_slot_in_map(
            NFT::storage_layout().public_owners.slot,
            artifact_id,
        );
        *nft_owner_after_withdraw_ref = context.storage_read(owner_slot);
    });
    assert_eq(nft_owner_after_withdraw, player);

    env.call_private(
        player,
        DarkForest::at(contract_address).trade_artifact(
            ruins_location_id,
            artifact_id,
            false,
        )
    );

    let mut stored_location_after_deposit: Field = 0;
    let mut stored_slot0_after_deposit: Field = 0;
    let location_dep_ref = &mut stored_location_after_deposit;
    let slot0_dep_ref = &mut stored_slot0_after_deposit;
    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            artifact_id,
        );
        *location_dep_ref = context.storage_read(location_slot);
        let list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            ruins_location_id,
        );
        *slot0_dep_ref = context.storage_read(list_slot);
    });

    assert_eq(stored_location_after_deposit, ruins_location_id);
    assert_eq(stored_slot0_after_deposit, artifact_id);

    let mut nft_owner_after_deposit = AztecAddress::zero();
    let nft_owner_after_deposit_ref = &mut nft_owner_after_deposit;
    env.public_context_at(nft_contract, |context| {
        let owner_slot = derive_storage_slot_in_map(
            NFT::storage_layout().public_owners.slot,
            artifact_id,
        );
        *nft_owner_after_deposit_ref = context.storage_read(owner_slot);
    });
    assert_eq(nft_owner_after_deposit, contract_address);

    env.call_private(
        player,
        DarkForest::at(contract_address).trade_artifact(
            ruins_location_id,
            artifact_id,
            true,
        )
    );

    let mut stored_location_final: Field = 0;
    let mut stored_slot0_final: Field = 0;
    let location_final_ref = &mut stored_location_final;
    let slot0_final_ref = &mut stored_slot0_final;
    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            artifact_id,
        );
        *location_final_ref = context.storage_read(location_slot);
        let list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            ruins_location_id,
        );
        *slot0_final_ref = context.storage_read(list_slot);
    });

    assert_eq(stored_location_final, 0);
    assert_eq(stored_slot0_final, 0);

    let mut nft_owner_final = AztecAddress::zero();
    let nft_owner_final_ref = &mut nft_owner_final;
    env.public_context_at(nft_contract, |context| {
        let owner_slot = derive_storage_slot_in_map(
            NFT::storage_layout().public_owners.slot,
            artifact_id,
        );
        *nft_owner_final_ref = context.storage_read(owner_slot);
    });
    assert_eq(nft_owner_final, player);

    let mut nft_owner_final = AztecAddress::zero();
    let nft_owner_final_ref = &mut nft_owner_final;
    env.public_context_at(nft_contract, |context| {
        let owner_slot = derive_storage_slot_in_map(
            NFT::storage_layout().public_owners.slot,
            artifact_id,
        );
        *nft_owner_final_ref = context.storage_read(owner_slot);
    });
    assert_eq(nft_owner_final, player);
}

#[test(should_fail)]
unconstrained fn test_fail_withdraw_not_planet_owner() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();
    let other = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let location_id = expected_location_id(INIT_X, INIT_Y);
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_type_and_level(
            location_id,
            PLANET_TYPE_TRADING_POST,
            9,
        )
    );

    let artifact_id: Field = 9100;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            location_id,
            artifact_id,
            ARTIFACT_TYPE_MONOLITH,
            ARTIFACT_RARITY_COMMON,
            BIOME_OCEAN,
            contract_address,
        )
    );

    env.call_private(
        other,
        DarkForest::at(contract_address).trade_artifact(
            location_id,
            artifact_id,
            true,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_deposit_not_artifact_owner() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();
    let other = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let location_id = expected_location_id(INIT_X, INIT_Y);
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_type_and_level(
            location_id,
            PLANET_TYPE_TRADING_POST,
            9,
        )
    );

    let artifact_id: Field = 9101;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            location_id,
            artifact_id,
            ARTIFACT_TYPE_MONOLITH,
            ARTIFACT_RARITY_COMMON,
            BIOME_OCEAN,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).trade_artifact(
            location_id,
            artifact_id,
            true,
        )
    );

    env.call_private(
        other,
        DarkForest::at(contract_address).trade_artifact(
            location_id,
            artifact_id,
            false,
        )
    );
}

#[test(should_fail)]
unconstrained fn test_fail_withdraw_not_trading_post() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let mut ruins_found = false;
    let mut ruins_location_id: Field = 0;
    let mut ruins_x: Field = 0;
    let mut ruins_y: Field = 0;

    for dx in 0..(SEARCH_MAX_DIST_RUINS + 1) {
        for dy in 0..(SEARCH_MAX_DIST_RUINS + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!ruins_found) & !is_home {
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if planet_type == PLANET_TYPE_RUINS {
                    ruins_found = true;
                    ruins_location_id = location_id;
                    ruins_x = x;
                    ruins_y = y;
                }
            }
        }
    }
    assert(ruins_found);

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            ruins_x,
            ruins_y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            ruins_location_id,
            player,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).prospect_planet(ruins_location_id)
    );

    let biomebase = expected_biomebase(ruins_x, ruins_y);
    env.call_private(
        player,
        DarkForest::at(contract_address).find_artifact(
            ruins_x,
            ruins_y,
            biomebase,
            utils::PLANETHASH_KEY,
            utils::BIOMEBASE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::biome_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let mut artifact_id: Field = 0;
    let artifact_id_ref = &mut artifact_id;
    env.public_context_at(contract_address, |context| {
        let artifact_list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            ruins_location_id,
        );
        *artifact_id_ref = context.storage_read(artifact_list_slot);
    });
    assert(artifact_id != 0);

    env.call_private(
        player,
        DarkForest::at(contract_address).trade_artifact(
            ruins_location_id,
            artifact_id,
            true,
        )
    );
}

#[test]
unconstrained fn test_activate_wormhole_and_move_speedup() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            target_location_id,
            player,
        )
    );

    let artifact_id: Field = 9001;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            artifact_id,
            ARTIFACT_TYPE_WORMHOLE,
            ARTIFACT_RARITY_RARE,
            BIOME_OCEAN,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            artifact_id,
            target_location_id,
            true,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    let mut arrival_type: u8 = 0;
    let mut departure_block: u32 = 0;
    let mut arrival_block: u32 = 0;
    let mut speed: u64 = 0;
    let arrival_type_ref = &mut arrival_type;
    let departure_block_ref = &mut departure_block;
    let arrival_block_ref = &mut arrival_block;
    let speed_ref = &mut speed;
    env.public_context_at(contract_address, |context| {
        let arrival_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().arrivals.slot, 1);
        let meta = context.storage_read(arrival_slot + 4);
        let (depart, arrive, arrival_type) = unpack_arrival_meta(meta);
        *arrival_type_ref = arrival_type;
        *departure_block_ref = depart;
        *arrival_block_ref = arrive;

        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            home_location_id,
        );
        *speed_ref = context.storage_read(planet_slot + 10);
    });

    let modifier = WORMHOLE_SPEED_MODIFIERS[ARTIFACT_RARITY_RARE as u32];
    let mut expected_travel = (MOVE_DIST_MAX * 100) / modifier;
    expected_travel = expected_travel / speed;
    if expected_travel == 0 {
        expected_travel = 1;
    }

    assert_eq(arrival_type, ARRIVAL_TYPE_WORMHOLE);
    assert_eq((arrival_block - departure_block) as u64, expected_travel);
}

#[test]
unconstrained fn test_wormhole_arrival_applies_combat() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();
    let defender = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            CAPTURE_X_2,
            CAPTURE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(CAPTURE_X_2, CAPTURE_Y_2);

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            target_location_id,
            player,
        )
    );

    let artifact_id: Field = 9002;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            artifact_id,
            ARTIFACT_TYPE_WORMHOLE,
            ARTIFACT_RARITY_RARE,
            BIOME_OCEAN,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            artifact_id,
            target_location_id,
            true,
        )
    );

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            target_location_id,
            defender,
        )
    );

    let mut initial_owner = AztecAddress::zero();
    let mut initial_population: u64 = 0;
    let initial_owner_ref = &mut initial_owner;
    let initial_population_ref = &mut initial_population;
    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            target_location_id,
        );
        *initial_owner_ref = context.storage_read(planet_slot + 1);
        *initial_population_ref = context.storage_read(planet_slot + 3);
    });
    assert_eq(initial_owner, defender);

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            CAPTURE_X_2,
            CAPTURE_Y_2,
            utils::WORLD_RADIUS,
            CAPTURE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    let mut arrival_type: u8 = 0;
    let arrival_type_ref = &mut arrival_type;
    env.public_context_at(contract_address, |context| {
        let arrival_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().arrivals.slot, 1);
        let meta = context.storage_read(arrival_slot + 4);
        let (_, _, stored_arrival_type) = unpack_arrival_meta(meta);
        *arrival_type_ref = stored_arrival_type;
    });
    assert_eq(arrival_type, ARRIVAL_TYPE_WORMHOLE);

    env.call_private(
        player,
        DarkForest::at(contract_address).resolve_arrival(1)
    );

    let mut final_owner = AztecAddress::zero();
    let mut final_population: u64 = 0;
    let final_owner_ref = &mut final_owner;
    let final_population_ref = &mut final_population;
    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            target_location_id,
        );
        *final_owner_ref = context.storage_read(planet_slot + 1);
        *final_population_ref = context.storage_read(planet_slot + 3);
    });

    if final_owner == defender {
        assert(final_population < initial_population);
    }
}

#[test]
unconstrained fn test_photoid_auto_deactivate_and_upgrade() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            target_location_id,
            player,
        )
    );

    let artifact_id: Field = 9002;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            artifact_id,
            ARTIFACT_TYPE_PHOTOID_CANNON,
            ARTIFACT_RARITY_COMMON,
            BIOME_DESERT,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            artifact_id,
            0,
            true,
        )
    );

    for i in 0..(PHOTOID_ACTIVATION_DELAY_BLOCKS as u64 + 1) {
        env.call_private(
            player,
            DarkForest::at(contract_address).reveal_location(
                (6000 + i) as Field,
                1,
                utils::PLANETHASH_KEY,
                utils::SPACETYPE_KEY,
                utils::PERLIN_LENGTH_SCALE,
                utils::PERLIN_MIRROR_X,
                utils::PERLIN_MIRROR_Y,
                utils::spacetype_config_hash(),
                utils::MAX_LOCATION_ID,
            )
        );
    }

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    let mut arrival_type: u8 = 0;
    let mut departure_block: u32 = 0;
    let mut arrival_block: u32 = 0;
    let mut speed: u64 = 0;
    let mut stored_location: Field = 1;
    let mut stored_last_activated: u32 = 0;
    let mut stored_last_deactivated: u32 = 0;
    let arrival_type_ref = &mut arrival_type;
    let departure_block_ref = &mut departure_block;
    let arrival_block_ref = &mut arrival_block;
    let speed_ref = &mut speed;
    let stored_location_ref = &mut stored_location;
    let stored_last_activated_ref = &mut stored_last_activated;
    let stored_last_deactivated_ref = &mut stored_last_deactivated;
    env.public_context_at(contract_address, |context| {
        let arrival_slot =
            derive_storage_slot_in_map(DarkForest::storage_layout().arrivals.slot, 1);
        let meta = context.storage_read(arrival_slot + 4);
        let (depart, arrive, arrival_type) = unpack_arrival_meta(meta);
        *arrival_type_ref = arrival_type;
        *departure_block_ref = depart;
        *arrival_block_ref = arrive;

        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            home_location_id,
        );
        *speed_ref = context.storage_read(planet_slot + 10);

        let artifact_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifacts.slot,
            artifact_id,
        );
        *stored_last_activated_ref = context.storage_read(artifact_slot + 8);
        *stored_last_deactivated_ref = context.storage_read(artifact_slot + 9);

        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            artifact_id,
        );
        *stored_location_ref = context.storage_read(location_slot);
    });

    let speed_multiplier: u64 = 500; // common rarity in v0.6 timeDelayUpgrade
    let speed_upgraded = (speed * speed_multiplier) / 100;
    let mut expected_travel = (MOVE_DIST_MAX * 100) / speed_upgraded;
    if expected_travel == 0 {
        expected_travel = 1;
    }

    assert_eq(arrival_type, ARRIVAL_TYPE_PHOTOID);
    assert_eq((arrival_block - departure_block) as u64, expected_travel);
    assert(stored_last_deactivated >= stored_last_activated);
    assert_eq(stored_location, 0);
}

#[test]
unconstrained fn test_bloom_filter_burns_and_caps() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let artifact_id: Field = 9003;

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            artifact_id,
            ARTIFACT_TYPE_BLOOM_FILTER,
            ARTIFACT_RARITY_COMMON,
            BIOME_FOREST,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            artifact_id,
            0,
            true,
        )
    );

    let mut pop: u64 = 0;
    let mut pop_cap: u64 = 0;
    let mut silver: u64 = 0;
    let mut silver_cap: u64 = 0;
    let mut stored_location: Field = 1;
    let pop_ref = &mut pop;
    let pop_cap_ref = &mut pop_cap;
    let silver_ref = &mut silver;
    let silver_cap_ref = &mut silver_cap;
    let stored_location_ref = &mut stored_location;
    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            home_location_id,
        );
        *pop_ref = context.storage_read(planet_slot + 3);
        *pop_cap_ref = context.storage_read(planet_slot + 4);
        *silver_ref = context.storage_read(planet_slot + 6);
        *silver_cap_ref = context.storage_read(planet_slot + 7);

        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            artifact_id,
        );
        *stored_location_ref = context.storage_read(location_slot);
    });

    assert_eq(pop, pop_cap);
    assert_eq(silver, silver_cap);
    assert_eq(stored_location, 0);
}

#[test]
unconstrained fn test_black_domain_destroys_planet() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let artifact_id: Field = 9004;

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            artifact_id,
            ARTIFACT_TYPE_BLACK_DOMAIN,
            ARTIFACT_RARITY_COMMON,
            BIOME_CORRUPTED,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            artifact_id,
            0,
            true,
        )
    );

    let mut destroyed: u8 = 0;
    let mut stored_location: Field = 1;
    let destroyed_ref = &mut destroyed;
    let stored_location_ref = &mut stored_location;
    env.public_context_at(contract_address, |context| {
        let destroyed_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_destroyed.slot,
            home_location_id,
        );
        *destroyed_ref = context.storage_read(destroyed_slot);
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            artifact_id,
        );
        *stored_location_ref = context.storage_read(location_slot);
    });

    assert_eq(destroyed, 1);
    assert_eq(stored_location, 0);
}

#[test(should_fail)]
unconstrained fn test_fail_activate_artifact_cooldown() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            target_location_id,
            player,
        )
    );

    let artifact_id: Field = 9005;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            artifact_id,
            ARTIFACT_TYPE_WORMHOLE,
            ARTIFACT_RARITY_COMMON,
            BIOME_OCEAN,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            artifact_id,
            target_location_id,
            true,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            0,
            0,
            false,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).set_artifact_activation(
            home_location_id,
            artifact_id,
            target_location_id,
            true,
        )
    );
}

#[test]
unconstrained fn test_give_space_ships_once() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    env.call_private(
        player,
        DarkForest::at(contract_address).give_space_ships(home_location_id)
    );

    let ship_mothership = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_MOTHERSHIP);
    let ship_crescent = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_CRESCENT);
    let ship_whale = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_WHALE);
    let ship_gear = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_GEAR);
    let ship_titan = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_TITAN);

    env.public_context_at(contract_address, |context| {
        let list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            home_location_id,
        );
        let slot0 = context.storage_read(list_slot);
        let slot1 = context.storage_read(list_slot + 1);
        let slot2 = context.storage_read(list_slot + 2);
        let slot3 = context.storage_read(list_slot + 3);
        let slot4 = context.storage_read(list_slot + 4);
        assert_eq(slot0, ship_mothership);
        assert_eq(slot1, ship_crescent);
        assert_eq(slot2, ship_whale);
        assert_eq(slot3, ship_gear);
        assert_eq(slot4, ship_titan);

        let claimed_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().player_claimed_ships.slot,
            player,
        );
        let claimed = context.storage_read(claimed_slot);
        assert_eq(claimed, 1);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_give_space_ships_twice() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    env.call_private(
        player,
        DarkForest::at(contract_address).give_space_ships(home_location_id)
    );
    env.call_private(
        player,
        DarkForest::at(contract_address).give_space_ships(home_location_id)
    );
}

#[test]
unconstrained fn test_spaceship_move_depart_and_arrive_effects() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            CAPTURE_X_2,
            CAPTURE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);
    let second_location_id = expected_location_id(CAPTURE_X_2, CAPTURE_Y_2);

    env.call_private(
        player,
        DarkForest::at(contract_address).give_space_ships(home_location_id)
    );

    let ship_id = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_MOTHERSHIP);

    let mut base_target_pop_growth: u64 = 0;
    let mut base_second_pop_growth: u64 = 0;
    let mut home_speed: u64 = 0;
    let mut target_speed: u64 = 0;
    let base_target_pop_growth_ref = &mut base_target_pop_growth;
    let base_second_pop_growth_ref = &mut base_second_pop_growth;
    let home_speed_ref = &mut home_speed;
    let target_speed_ref = &mut target_speed;
    env.public_context_at(contract_address, |context| {
        let home_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            home_location_id,
        );
        *home_speed_ref = context.storage_read(home_slot + 10);

        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            target_location_id,
        );
        *base_target_pop_growth_ref = context.storage_read(planet_slot + 5);
        *target_speed_ref = context.storage_read(planet_slot + 10);
        let second_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            second_location_id,
        );
        *base_second_pop_growth_ref = context.storage_read(second_slot + 5);
    });
    assert(base_target_pop_growth > 0);
    assert(base_second_pop_growth > 0);

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            0,
            0,
            ship_id,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            ship_id,
        );
        let stored_location = context.storage_read(location_slot);
        assert_eq(stored_location, 0);
    });

    let mut travel_time = (MOVE_DIST_MAX * 100) / home_speed;
    if travel_time == 0 {
        travel_time = 1;
    }
    let mut advance_blocks = travel_time - 1;
    assert(advance_blocks <= MAX_ADVANCE_BLOCKS);
    for i in 0..MAX_ADVANCE_BLOCKS {
        if (i as u64) < advance_blocks {
            env.call_private(
                player,
                DarkForest::at(contract_address).reveal_location(
                    (6000 + (i as u64)) as Field,
                    0,
                    utils::PLANETHASH_KEY,
                    utils::SPACETYPE_KEY,
                    utils::PERLIN_LENGTH_SCALE,
                    utils::PERLIN_MIRROR_X,
                    utils::PERLIN_MIRROR_Y,
                    utils::spacetype_config_hash(),
                    utils::MAX_LOCATION_ID,
                )
            );
        }
    }

    env.call_private(
        player,
        DarkForest::at(contract_address).resolve_arrival(1)
    );

    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            ship_id,
        );
        let stored_location = context.storage_read(location_slot);
        assert_eq(stored_location, target_location_id);
    });

    let mut target_pop_growth: u64 = 0;
    let mut target_doublers: u64 = 0;
    let target_pop_growth_ref = &mut target_pop_growth;
    let target_doublers_ref = &mut target_doublers;
    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            target_location_id,
        );
        *target_pop_growth_ref = context.storage_read(planet_slot + 5);
        let doublers_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_energy_gro_doublers.slot,
            target_location_id,
        );
        *target_doublers_ref = context.storage_read(doublers_slot);
    });
    assert_eq(target_pop_growth, base_target_pop_growth * 2);
    assert_eq(target_doublers, 1);

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            MOVE_X_2,
            MOVE_Y_2,
            CAPTURE_X_2,
            CAPTURE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            0,
            0,
            ship_id,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    let mut travel_time_second = (MOVE_DIST_MAX * 100) / target_speed;
    if travel_time_second == 0 {
        travel_time_second = 1;
    }
    let mut advance_blocks_second = travel_time_second - 1;
    assert(advance_blocks_second <= MAX_ADVANCE_BLOCKS);
    for i in 0..MAX_ADVANCE_BLOCKS {
        if (i as u64) < advance_blocks_second {
            env.call_private(
                player,
                DarkForest::at(contract_address).reveal_location(
                    (8000 + (i as u64)) as Field,
                    0,
                    utils::PLANETHASH_KEY,
                    utils::SPACETYPE_KEY,
                    utils::PERLIN_LENGTH_SCALE,
                    utils::PERLIN_MIRROR_X,
                    utils::PERLIN_MIRROR_Y,
                    utils::spacetype_config_hash(),
                    utils::MAX_LOCATION_ID,
                )
            );
        }
    }

    env.call_private(
        player,
        DarkForest::at(contract_address).resolve_arrival(2)
    );

    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            ship_id,
        );
        let stored_location = context.storage_read(location_slot);
        assert_eq(stored_location, second_location_id);
    });

    let mut origin_pop_growth: u64 = 0;
    let mut origin_doublers: u64 = 0;
    let mut second_pop_growth: u64 = 0;
    let mut second_doublers: u64 = 0;
    let origin_pop_growth_ref = &mut origin_pop_growth;
    let origin_doublers_ref = &mut origin_doublers;
    let second_pop_growth_ref = &mut second_pop_growth;
    let second_doublers_ref = &mut second_doublers;
    env.public_context_at(contract_address, |context| {
        let origin_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            target_location_id,
        );
        *origin_pop_growth_ref = context.storage_read(origin_slot + 5);
        let origin_doublers_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_energy_gro_doublers.slot,
            target_location_id,
        );
        *origin_doublers_ref = context.storage_read(origin_doublers_slot);

        let second_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            second_location_id,
        );
        *second_pop_growth_ref = context.storage_read(second_slot + 5);
        let second_doublers_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_energy_gro_doublers.slot,
            second_location_id,
        );
        *second_doublers_ref = context.storage_read(second_doublers_slot);
    });

    assert_eq(origin_pop_growth, base_target_pop_growth);
    assert_eq(origin_doublers, 0);
    assert_eq(second_pop_growth, base_second_pop_growth * 2);
    assert_eq(second_doublers, 1);
}

#[test]
unconstrained fn test_spaceship_location_mapping_updates() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);

    env.call_private(
        player,
        DarkForest::at(contract_address).give_space_ships(home_location_id)
    );

    let ship_id = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_MOTHERSHIP);

    let mut home_speed: u64 = 0;
    let home_speed_ref = &mut home_speed;
    env.public_context_at(contract_address, |context| {
        let home_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            home_location_id,
        );
        *home_speed_ref = context.storage_read(home_slot + 10);
    });

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            0,
            0,
            ship_id,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            ship_id,
        );
        let stored_location = context.storage_read(location_slot);
        assert_eq(stored_location, 0);
    });

    let mut travel_time = (MOVE_DIST_MAX * 100) / home_speed;
    if travel_time == 0 {
        travel_time = 1;
    }
    let mut advance_blocks = travel_time - 1;
    assert(advance_blocks <= MAX_ADVANCE_BLOCKS);
    for i in 0..MAX_ADVANCE_BLOCKS {
        if (i as u64) < advance_blocks {
            env.call_private(
                player,
                DarkForest::at(contract_address).reveal_location(
                    (9000 + (i as u64)) as Field,
                    0,
                    utils::PLANETHASH_KEY,
                    utils::SPACETYPE_KEY,
                    utils::PERLIN_LENGTH_SCALE,
                    utils::PERLIN_MIRROR_X,
                    utils::PERLIN_MIRROR_Y,
                    utils::spacetype_config_hash(),
                    utils::MAX_LOCATION_ID,
                )
            );
        }
    }

    env.call_private(
        player,
        DarkForest::at(contract_address).resolve_arrival(1)
    );

    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            ship_id,
        );
        let stored_location = context.storage_read(location_slot);
        assert_eq(stored_location, target_location_id);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_spaceship_move_nonzero_pop() {
    let (mut env, contract_address, _) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    env.call_private(
        player,
        DarkForest::at(contract_address).give_space_ships(home_location_id)
    );

    let ship_id = expected_ship_id(home_location_id, ARTIFACT_TYPE_SHIP_MOTHERSHIP);
    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            1,
            0,
            ship_id,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );
}

#[test]
unconstrained fn test_artifact_voyage_moves_artifact() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);

    let artifact_id: Field = 9101;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            artifact_id,
            ARTIFACT_TYPE_MONOLITH,
            ARTIFACT_RARITY_COMMON,
            BIOME_OCEAN,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            artifact_id,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    let mut home_speed: u64 = 0;
    let home_speed_ref = &mut home_speed;
    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            home_location_id,
        );
        *home_speed_ref = context.storage_read(planet_slot + 10);
    });

    let mut travel_time = (MOVE_DIST_MAX * 100) / home_speed;
    if travel_time == 0 {
        travel_time = 1;
    }
    let mut advance_blocks = travel_time - 1;
    assert(advance_blocks <= MAX_ADVANCE_BLOCKS);
    for i in 0..MAX_ADVANCE_BLOCKS {
        if (i as u64) < advance_blocks {
            env.call_private(
                player,
                DarkForest::at(contract_address).reveal_location(
                    (6000 + (i as u64)) as Field,
                    0,
                    utils::PLANETHASH_KEY,
                    utils::SPACETYPE_KEY,
                    utils::PERLIN_LENGTH_SCALE,
                    utils::PERLIN_MIRROR_X,
                    utils::PERLIN_MIRROR_Y,
                    utils::spacetype_config_hash(),
                    utils::MAX_LOCATION_ID,
                )
            );
        }
    }

    env.call_private(
        player,
        DarkForest::at(contract_address).resolve_arrival(1)
    );

    env.public_context_at(contract_address, |context| {
        let location_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().artifact_locations.slot,
            artifact_id,
        );
        let stored_location = context.storage_read(location_slot);
        assert_eq(stored_location, target_location_id);

        let target_list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            target_location_id,
        );
        let target_slot0 = context.storage_read(target_list_slot);
        assert_eq(target_slot0, artifact_id);

        let home_list_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_artifacts.slot,
            home_location_id,
        );
        let home_slot0 = context.storage_read(home_list_slot);
        assert(home_slot0 != artifact_id);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_artifact_voyage_destination_full() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let home_location_id = expected_location_id(INIT_X, INIT_Y);
    let target_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);

    for i in 0..5 {
        let artifact_id: Field = (9200u64 + (i as u64)) as Field;
        env.call_private(
            admin,
            DarkForest::at(contract_address).admin_create_artifact_on_planet(
                target_location_id,
                artifact_id,
                ARTIFACT_TYPE_MONOLITH,
                ARTIFACT_RARITY_COMMON,
                BIOME_OCEAN,
                contract_address,
            )
        );
    }

    let moving_artifact_id: Field = 9301;
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_create_artifact_on_planet(
            home_location_id,
            moving_artifact_id,
            ARTIFACT_TYPE_MONOLITH,
            ARTIFACT_RARITY_COMMON,
            BIOME_OCEAN,
            contract_address,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            moving_artifact_id,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );
}

#[test]
unconstrained fn test_abandon_planet_success() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    let mut abandon_x: Field = 0;
    let mut abandon_y: Field = 0;
    let mut dest_x: Field = 0;
    let mut dest_y: Field = 0;
    let mut found = false;

    for dx in 0..(SEARCH_MAX_DIST_RUINS + 1) {
        for dy in 0..(SEARCH_MAX_DIST_RUINS + 1) {
            let is_home = (dx == 0) & (dy == 0);
            if (!found) & !is_home {
                let x = INIT_X + (dx as Field);
                let y = dy as Field;
                let perlin = expected_perlin(x, y);
                let location_id = expected_location_id(x, y);
                let space_type = expected_space_type(perlin);
                let level = expected_planet_level(location_id, space_type);
                let planet_type = expected_planet_type(location_id, space_type, level);
                if (level >= 6) & (planet_type == PLANET_TYPE_PLANET) {
                    abandon_x = x;
                    abandon_y = y;
                    dest_x = x + 1;
                    dest_y = y;
                    found = true;
                }
            }
        }
    }
    assert(found);

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            abandon_x,
            abandon_y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            dest_x,
            dest_y,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let abandon_location_id = expected_location_id(abandon_x, abandon_y);

    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            abandon_location_id,
            player,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            abandon_x,
            abandon_y,
            dest_x,
            dest_y,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            0,
            0,
            0,
            true,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    env.public_context_at(contract_address, |context| {
        let planet_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planets.slot,
            abandon_location_id,
        );
        let stored_owner = context.storage_read(planet_slot + 1);
        let space_junk_slot = derive_storage_slot_in_map(
            DarkForest::storage_layout().planet_space_junk.slot,
            abandon_location_id,
        );
        let stored_space_junk = context.storage_read(space_junk_slot);
        assert_eq(stored_owner, AztecAddress::zero());
        assert(stored_space_junk > 0);
    });
}

#[test(should_fail)]
unconstrained fn test_fail_abandon_with_incoming_arrival() {
    let (mut env, contract_address, admin) = utils::setup();
    let player = env.create_light_account();

    env.call_private(
        player,
        DarkForest::at(contract_address).init_player(
            INIT_X,
            INIT_Y,
            INIT_RADIUS,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
            utils::SPAWN_RIM_AREA,
            utils::INIT_PERLIN_MIN,
            utils::INIT_PERLIN_MAX,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            MOVE_X_2,
            MOVE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).reveal_location(
            CAPTURE_X_2,
            CAPTURE_Y_2,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
        )
    );

    let abandon_location_id = expected_location_id(MOVE_X_2, MOVE_Y_2);
    env.call_private(
        admin,
        DarkForest::at(contract_address).admin_set_planet_owner(
            abandon_location_id,
            player,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            INIT_X,
            INIT_Y,
            MOVE_X_2,
            MOVE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            MOVE_POP_MOVED,
            0,
            0,
            false,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );

    env.call_private(
        player,
        DarkForest::at(contract_address).move(
            MOVE_X_2,
            MOVE_Y_2,
            CAPTURE_X_2,
            CAPTURE_Y_2,
            utils::WORLD_RADIUS,
            MOVE_DIST_MAX,
            0,
            0,
            0,
            true,
            utils::PLANETHASH_KEY,
            utils::SPACETYPE_KEY,
            utils::PERLIN_LENGTH_SCALE,
            utils::PERLIN_MIRROR_X,
            utils::PERLIN_MIRROR_Y,
            utils::spacetype_config_hash(),
            utils::MAX_LOCATION_ID,
            utils::WORLD_RADIUS,
        )
    );
}
