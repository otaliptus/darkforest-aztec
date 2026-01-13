mod aztec_mimc;
mod feature_flags;
mod hash;
mod mimc;
mod perlin;
mod test;
mod types;
mod utils;

use dep::aztec::macros::aztec;

#[aztec]
pub contract DarkForest {
    use dep::aztec::{
        macros::{
            functions::{external, initializer, internal, only_self},
            storage::storage,
        },
        protocol_types::{
            address::AztecAddress,
            traits::ToField,
        },
        state_vars::{Map, PublicMutable},
    };
    use dep::darkforest_nft::NFT;
    use dep::std::field::bn254;
    use crate::{
        hash::hash_2,
        perlin::multi_scale_perlin,
        types::{
            Artifact,
            Arrival,
            GameConfig,
            Planet,
            PlanetArrivals,
            PlanetArtifacts,
            PlanetArtifactState,
            Player,
            RevealedCoords,
            Upgrade,
        },
        utils::{
            config_hash,
            exp_neg_q32,
            field_abs_u128,
            field_to_signed,
            pow2_frac_q32,
            signed_sub,
        },
    };

    global MAX_COORD_ABS: u128 = 2147483648;
    global MAX_ARRIVALS_PER_BUCKET: u8 = 6;
    global MAX_PLANET_ARTIFACTS: u8 = 5;
    global MOVE_KNOWN_FLAG: u64 = 0x8000000000000000;
    global ARRIVAL_TYPE_NORMAL: u8 = 1;
    global ARRIVAL_TYPE_PHOTOID: u8 = 2;
    global ARRIVAL_TYPE_WORMHOLE: u8 = 3;

    // Block-based cooldowns for artifact activation (v0.6 hours mapped to blocks).
    global ARTIFACT_COOLDOWN_BLOCKS: [u32; 10] = [24, 0, 0, 0, 0, 4, 4, 24, 24, 24];
    global PHOTOID_ACTIVATION_DELAY_BLOCKS: u32 = 4;
    global WORMHOLE_SPEED_MODIFIERS: [u64; 6] = [1, 2, 4, 8, 16, 32];

    global HOME_PLANET_POPULATION: u64 = 200000;
    global SPACE_JUNK_LIMIT: u64 = 1000;
    global PLANET_LEVEL_JUNK: [u64; 10] = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
    global ABANDON_SPEED_CHANGE_PERCENT: u64 = 150;
    global ABANDON_RANGE_CHANGE_PERCENT: u64 = 150;
    global SHIP_ID_SALT: u64 = 1000;

    global PLANET_TYPE_PLANET: u8 = 0;
    global PLANET_TYPE_SILVER_MINE: u8 = 1;
    global PLANET_TYPE_FOUNDRY: u8 = 2;
    global PLANET_TYPE_TRADING_POST: u8 = 3;
    global PLANET_TYPE_SILVER_BANK: u8 = 4;

    global ARTIFACT_TYPE_MONOLITH: u8 = 1;
    global ARTIFACT_TYPE_COLOSSUS: u8 = 2;
    global ARTIFACT_TYPE_SPACESHIP: u8 = 3;
    global ARTIFACT_TYPE_PYRAMID: u8 = 4;
    global ARTIFACT_TYPE_WORMHOLE: u8 = 5;
    global ARTIFACT_TYPE_PLANETARY_SHIELD: u8 = 6;
    global ARTIFACT_TYPE_PHOTOID_CANNON: u8 = 7;
    global ARTIFACT_TYPE_BLOOM_FILTER: u8 = 8;
    global ARTIFACT_TYPE_BLACK_DOMAIN: u8 = 9;
    global ARTIFACT_TYPE_SHIP_MOTHERSHIP: u8 = 10;
    global ARTIFACT_TYPE_SHIP_CRESCENT: u8 = 11;
    global ARTIFACT_TYPE_SHIP_WHALE: u8 = 12;
    global ARTIFACT_TYPE_SHIP_GEAR: u8 = 13;
    global ARTIFACT_TYPE_SHIP_TITAN: u8 = 14;

    global ARTIFACT_RARITY_UNKNOWN: u8 = 0;
    global ARTIFACT_RARITY_COMMON: u8 = 1;
    global ARTIFACT_RARITY_RARE: u8 = 2;
    global ARTIFACT_RARITY_EPIC: u8 = 3;
    global ARTIFACT_RARITY_LEGENDARY: u8 = 4;
    global ARTIFACT_RARITY_MYTHIC: u8 = 5;

    global BIOME_UNKNOWN: u8 = 0;
    global BIOME_OCEAN: u8 = 1;
    global BIOME_FOREST: u8 = 2;
    global BIOME_GRASSLAND: u8 = 3;
    global BIOME_TUNDRA: u8 = 4;
    global BIOME_SWAMP: u8 = 5;
    global BIOME_DESERT: u8 = 6;
    global BIOME_ICE: u8 = 7;
    global BIOME_WASTELAND: u8 = 8;
    global BIOME_LAVA: u8 = 9;
    global BIOME_CORRUPTED: u8 = 10;

    global UPGRADE_BRANCH_DEFENSE: u8 = 0;
    global UPGRADE_BRANCH_RANGE: u8 = 1;
    global UPGRADE_BRANCH_SPEED: u8 = 2;

    global UPGRADE_POP_CAP_MULTIPLIER: [u64; 3] = [120, 120, 120];
    global UPGRADE_POP_GROWTH_MULTIPLIER: [u64; 3] = [120, 120, 120];
    global UPGRADE_RANGE_MULTIPLIER: [u64; 3] = [100, 125, 100];
    global UPGRADE_SPEED_MULTIPLIER: [u64; 3] = [100, 100, 175];
    global UPGRADE_DEFENSE_MULTIPLIER: [u64; 3] = [120, 100, 100];

    global SPACE_TYPE_NEBULA: u8 = 0;
    global SPACE_TYPE_SPACE: u8 = 1;
    global SPACE_TYPE_DEEP_SPACE: u8 = 2;
    global SPACE_TYPE_DEAD_SPACE: u8 = 3;

    global PLANET_DEFAULT_POP_CAP: [u64; 10] = [
        100000,
        400000,
        1600000,
        6000000,
        25000000,
        100000000,
        300000000,
        500000000,
        700000000,
        800000000,
    ];
    global PLANET_DEFAULT_POP_GROWTH: [u64; 10] = [
        417,
        833,
        1250,
        1667,
        2083,
        2500,
        2917,
        3333,
        3750,
        4167,
    ];
    global PLANET_DEFAULT_RANGE: [u64; 10] = [
        99,
        177,
        315,
        591,
        1025,
        1734,
        2838,
        4414,
        6306,
        8829,
    ];
    global PLANET_DEFAULT_SPEED: [u64; 10] = [75, 75, 75, 75, 75, 75, 75, 75, 75, 75];
    global PLANET_DEFAULT_DEFENSE: [u64; 10] = [
        400,
        400,
        300,
        300,
        300,
        200,
        200,
        200,
        200,
        200,
    ];
    global PLANET_DEFAULT_SILVER_GROWTH: [u64; 10] = [
        0,
        56,
        167,
        417,
        833,
        1667,
        2778,
        2778,
        2778,
        2778,
    ];
    global PLANET_DEFAULT_SILVER_CAP: [u64; 10] = [
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
    global PLANET_DEFAULT_BARBARIAN_PERCENT: [u64; 10] = [
        0,
        1,
        2,
        3,
        4,
        5,
        7,
        10,
        20,
        25,
    ];
    global PERLIN_THRESHOLD_1: u64 = 14;
    global PERLIN_THRESHOLD_2: u64 = 15;
    global PERLIN_THRESHOLD_3: u64 = 19;
    global BIOME_THRESHOLD_1: u64 = 15;
    global BIOME_THRESHOLD_2: u64 = 17;
    global MAX_NATURAL_PLANET_LEVEL: u8 = 9;
    global PLANET_LEVEL_THRESHOLDS: [u64; 10] = [
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
    global PLANET_TYPE_WEIGHTS: [[[u64; 5]; 10]; 4] = [
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

    #[storage]
    struct Storage<Context> {
        nft_contract: PublicMutable<AztecAddress, Context>,
        config: PublicMutable<GameConfig, Context>,
        config_hash_spacetype: PublicMutable<Field, Context>,
        config_hash_biome: PublicMutable<Field, Context>,
        players: Map<AztecAddress, PublicMutable<Player, Context>, Context>,
        player_claimed_ships: Map<AztecAddress, PublicMutable<u8, Context>, Context>,
        player_space_junk: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
        player_space_junk_limit: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
        planets: Map<Field, PublicMutable<Planet, Context>, Context>,
        planet_destroyed: Map<Field, PublicMutable<u8, Context>, Context>,
        planet_space_junk: Map<Field, PublicMutable<u64, Context>, Context>,
        planet_energy_gro_doublers: Map<Field, PublicMutable<u8, Context>, Context>,
        planet_silver_gro_doublers: Map<Field, PublicMutable<u8, Context>, Context>,
        planet_pausers: Map<Field, PublicMutable<u8, Context>, Context>,
        planet_artifact_state: Map<Field, PublicMutable<PlanetArtifactState, Context>, Context>,
        artifacts: Map<Field, PublicMutable<Artifact, Context>, Context>,
        // Spaceships live in dedicated maps; artifact entries are materialized on demand.
        spaceships: Map<Field, PublicMutable<u8, Context>, Context>,
        spaceship_owners: Map<Field, PublicMutable<AztecAddress, Context>, Context>,
        planet_artifacts: Map<Field, PublicMutable<PlanetArtifacts, Context>, Context>,
        artifact_locations: Map<Field, PublicMutable<Field, Context>, Context>,
        arrivals: Map<Field, PublicMutable<Arrival, Context>, Context>,
        planet_arrivals: Map<Field, PublicMutable<PlanetArrivals, Context>, Context>,
        next_arrival_id: PublicMutable<u64, Context>,
        revealed: Map<Field, PublicMutable<RevealedCoords, Context>, Context>,
        touched_planet_ids_count: PublicMutable<u64, Context>,
        touched_planet_ids: Map<Field, PublicMutable<Field, Context>, Context>,
        touched_planet_seen: Map<Field, PublicMutable<u8, Context>, Context>,
        revealed_coords_count: PublicMutable<u64, Context>,
        revealed_coords: Map<Field, PublicMutable<RevealedCoords, Context>, Context>,
        revealed_seen: Map<Field, PublicMutable<u8, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(
        config: GameConfig,
        nft_contract: AztecAddress,
    ) {
        assert(!nft_contract.eq(AztecAddress::zero()));
        self.storage.nft_contract.write(nft_contract);
        self.storage.next_arrival_id.write(1);
        self.storage.touched_planet_ids_count.write(0);
        self.storage.revealed_coords_count.write(0);
        let spacetype_hash = config_hash(
            config.planethash_key,
            config.spacetype_key,
            config.perlin_length_scale,
            config.perlin_mirror_x,
            config.perlin_mirror_y,
        );
        let biome_hash = config_hash(
            config.planethash_key,
            config.biomebase_key,
            config.perlin_length_scale,
            config.perlin_mirror_x,
            config.perlin_mirror_y,
        );
        self.storage.config_hash_spacetype.write(spacetype_hash);
        self.storage.config_hash_biome.write(biome_hash);
        self.storage.config.write(config);
    }

    #[internal("public")]
    fn space_type_from_perlin(perlin: u64) -> u8 {
        if perlin >= PERLIN_THRESHOLD_3 {
            SPACE_TYPE_DEAD_SPACE
        } else if perlin >= PERLIN_THRESHOLD_2 {
            SPACE_TYPE_DEEP_SPACE
        } else if perlin >= PERLIN_THRESHOLD_1 {
            SPACE_TYPE_SPACE
        } else {
            SPACE_TYPE_NEBULA
        }
    }

    #[internal("public")]
    fn planet_level_from_location(
        loc_bytes: [u8; 32],
        space_type: u8,
    ) -> u8 {
        let mut level_uint: u64 = 0;
        level_uint += (loc_bytes[4] as u64) << 16;
        level_uint += (loc_bytes[5] as u64) << 8;
        level_uint += loc_bytes[6] as u64;

        let mut level: u8 = 0;
        let mut found = false;
        for i in 0..10 {
            let idx = 9 - i;
            let threshold = PLANET_LEVEL_THRESHOLDS[idx];
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
        if level > MAX_NATURAL_PLANET_LEVEL {
            level = MAX_NATURAL_PLANET_LEVEL;
        }

        level
    }

    #[internal("public")]
    fn planet_type_from_location(
        loc_bytes: [u8; 32],
        space_type: u8,
        level: u8,
    ) -> u8 {
        let weights = PLANET_TYPE_WEIGHTS[space_type as u32][level as u32];
        let mut weight_sum: u64 = 0;
        for i in 0..5 {
            weight_sum += weights[i];
        }

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

    #[internal("public")]
    fn biome_from_space_type(space_type: u8, biomebase: u64) -> u8 {
        if space_type == SPACE_TYPE_DEAD_SPACE {
            BIOME_CORRUPTED
        } else {
            let mut biome: u16 = (space_type as u16) * 3u16;
            if biomebase < BIOME_THRESHOLD_1 {
                biome += 1;
            } else if biomebase < BIOME_THRESHOLD_2 {
                biome += 2;
            } else {
                biome += 3;
            }
            biome as u8
        }
    }

    #[internal("public")]
    fn artifact_rarity_from_planet_level(level: u8) -> u8 {
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

    #[internal("public")]
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

    #[internal("public")]
    fn random_artifact_type_and_level_bonus(seed: Field, biome: u8) -> (u8, u8) {
        let bits: [u1; 254] = seed.to_le_bits();
        let last_byte = self.internal.mod_255_from_bits(bits, 0);
        let mut seed_mod_256: u32 = 0;
        for i in 0..8 {
            if bits[i] == 1 {
                seed_mod_256 += 1u32 << i;
            }
        }
        let mut second_last = self.internal.mod_255_from_bits(bits, 8);
        if seed_mod_256 < (last_byte as u32) {
            second_last = if second_last == 0 { 254 } else { second_last - 1 };
        }

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

    #[internal("public")]
    fn pseudo_blockhash(block_number: u32, planethash_key: Field) -> Field {
        hash_2(block_number as Field, 0, planethash_key)
    }

    #[internal("public")]
    fn artifact_seed(
        location_id: Field,
        contract_address: AztecAddress,
        block_hash: Field,
        planethash_key: Field,
    ) -> Field {
        let addr_field = contract_address.to_field();
        let seed1 = hash_2(location_id, addr_field, planethash_key);
        hash_2(seed1, block_hash, planethash_key)
    }

    #[internal("public")]
    fn is_spaceship(artifact_type: u8) -> bool {
        (artifact_type >= ARTIFACT_TYPE_SHIP_MOTHERSHIP)
            & (artifact_type <= ARTIFACT_TYPE_SHIP_TITAN)
    }

    #[internal("public")]
    fn load_artifact_or_ship(artifact_id: Field) -> pub Artifact {
        let artifact = self.storage.artifacts.at(artifact_id).read();
        if artifact.is_initialized {
            artifact
        } else {
            let ship_type = self.storage.spaceships.at(artifact_id).read();
            if ship_type != 0 {
                let ship_owner = self.storage.spaceship_owners.at(artifact_id).read();
                Artifact::new(
                    artifact_id,
                    0,
                    ARTIFACT_RARITY_UNKNOWN,
                    BIOME_UNKNOWN,
                    ship_owner,
                    ship_type,
                )
            } else {
                artifact
            }
        }
    }

    #[internal("public")]
    fn ship_artifact_id(
        location_id: Field,
        ship_type: u8,
        planethash_key: Field,
    ) -> pub Field {
        let salt = (SHIP_ID_SALT + (ship_type as u64)) as Field;
        let seed = hash_2(location_id, salt, planethash_key);
        assert(seed != 0);
        seed
    }

    #[internal("public")]
    fn is_planet_destroyed(location_id: Field) -> bool {
        self.storage.planet_destroyed.at(location_id).read() != 0
    }

    #[internal("public")]
    fn is_artifact_active(artifact: Artifact) -> bool {
        artifact.last_deactivated < artifact.last_activated
    }

    #[internal("public")]
    fn get_active_artifact(location_id: Field) -> pub Artifact {
        let artifacts = self.storage.planet_artifacts.at(location_id).read();
        let mut active = Artifact::empty();
        let mut found = false;
        for i in 0..(MAX_PLANET_ARTIFACTS as u32) {
            let artifact_id = artifacts.ids[i];
            if (!found) & (artifact_id != 0) {
                let artifact = self.storage.artifacts.at(artifact_id).read();
                if artifact.is_initialized & self.internal.is_artifact_active(artifact) {
                    active = artifact;
                    found = true;
                }
            }
        }
        active
    }

    #[internal("public")]
    fn default_upgrade() -> pub Upgrade {
        Upgrade::new(100, 100, 100, 100, 100)
    }

    #[internal("public")]
    fn time_delay_upgrade(artifact: Artifact) -> pub Upgrade {
        let mut upgrade = self.internal.default_upgrade();
        if artifact.artifact_type == ARTIFACT_TYPE_PHOTOID_CANNON {
            let range: [u64; 6] = [100, 200, 200, 200, 200, 200];
            let speed: [u64; 6] = [100, 500, 1000, 1500, 2000, 2500];
            let idx = artifact.rarity as u32;
            upgrade = Upgrade::new(100, 100, range[idx], speed[idx], 100);
        }
        upgrade
    }

    #[internal("public")]
    fn upgrade_for_artifact(artifact: Artifact) -> pub Upgrade {
        let mut upgrade = self.internal.default_upgrade();
        if artifact.artifact_type == ARTIFACT_TYPE_PLANETARY_SHIELD {
            let def: [u64; 6] = [100, 150, 200, 300, 450, 650];
            let idx = artifact.rarity as u32;
            upgrade = Upgrade::new(100, 100, 20, 20, def[idx]);
        } else if artifact.artifact_type == ARTIFACT_TYPE_PHOTOID_CANNON {
            let def: [u64; 6] = [100, 50, 40, 30, 20, 10];
            let idx = artifact.rarity as u32;
            upgrade = Upgrade::new(100, 100, 100, 100, def[idx]);
        } else if artifact.artifact_type >= ARTIFACT_TYPE_WORMHOLE {
            upgrade = self.internal.default_upgrade();
        } else {
            let mut pop_cap: u64 = 100;
            let mut pop_gro: u64 = 100;
            let mut range: u64 = 100;
            let mut speed: u64 = 100;
            let mut defense: u64 = 100;

            if artifact.artifact_type == ARTIFACT_TYPE_MONOLITH {
                pop_cap += 5;
                pop_gro += 5;
            } else if artifact.artifact_type == ARTIFACT_TYPE_COLOSSUS {
                speed += 5;
            } else if artifact.artifact_type == ARTIFACT_TYPE_SPACESHIP {
                range += 5;
            } else if artifact.artifact_type == ARTIFACT_TYPE_PYRAMID {
                defense += 5;
            }

            if artifact.planet_biome == BIOME_OCEAN {
                speed += 5;
                defense += 5;
            } else if artifact.planet_biome == BIOME_FOREST {
                defense += 5;
                pop_cap += 5;
                pop_gro += 5;
            } else if artifact.planet_biome == BIOME_GRASSLAND {
                pop_cap += 5;
                pop_gro += 5;
                range += 5;
            } else if artifact.planet_biome == BIOME_TUNDRA {
                defense += 5;
                range += 5;
            } else if artifact.planet_biome == BIOME_SWAMP {
                speed += 5;
                range += 5;
            } else if artifact.planet_biome == BIOME_DESERT {
                speed += 10;
            } else if artifact.planet_biome == BIOME_ICE {
                range += 10;
            } else if artifact.planet_biome == BIOME_WASTELAND {
                defense += 10;
            } else if artifact.planet_biome == BIOME_LAVA {
                pop_cap += 10;
                pop_gro += 10;
            } else if artifact.planet_biome == BIOME_CORRUPTED {
                range += 5;
                speed += 5;
                pop_cap += 5;
                pop_gro += 5;
            }

            let scale = 1u64 + ((artifact.rarity as u64) / 2u64);
            let scale_minus = scale - 1u64;
            let pop_cap_scaled =
                (scale as u128) * (pop_cap as u128) - (scale_minus as u128) * 100u128;
            let pop_gro_scaled =
                (scale as u128) * (pop_gro as u128) - (scale_minus as u128) * 100u128;
            let range_scaled =
                (scale as u128) * (range as u128) - (scale_minus as u128) * 100u128;
            let speed_scaled =
                (scale as u128) * (speed as u128) - (scale_minus as u128) * 100u128;
            let defense_scaled =
                (scale as u128) * (defense as u128) - (scale_minus as u128) * 100u128;

            upgrade = Upgrade::new(
                pop_cap_scaled as u64,
                pop_gro_scaled as u64,
                range_scaled as u64,
                speed_scaled as u64,
                defense_scaled as u64,
            );
        }
        upgrade
    }

    #[internal("public")]
    fn buff_planet(planet: Planet, upgrade: Upgrade) -> pub Planet {
        let mut updated = planet;
        updated.population_cap =
            ((updated.population_cap as u128) * (upgrade.pop_cap_multiplier as u128) / 100u128) as u64;
        updated.population_growth =
            ((updated.population_growth as u128) * (upgrade.pop_gro_multiplier as u128) / 100u128) as u64;
        updated.range =
            ((updated.range as u128) * (upgrade.range_multiplier as u128) / 100u128) as u64;
        updated.speed =
            ((updated.speed as u128) * (upgrade.speed_multiplier as u128) / 100u128) as u64;
        updated.defense =
            ((updated.defense as u128) * (upgrade.def_multiplier as u128) / 100u128) as u64;
        updated
    }

    #[internal("public")]
    fn debuff_planet(planet: Planet, upgrade: Upgrade) -> pub Planet {
        let mut updated = planet;
        updated.population_cap =
            ((updated.population_cap as u128) * 100u128 / (upgrade.pop_cap_multiplier as u128)) as u64;
        updated.population_growth =
            ((updated.population_growth as u128) * 100u128 / (upgrade.pop_gro_multiplier as u128)) as u64;
        updated.range =
            ((updated.range as u128) * 100u128 / (upgrade.range_multiplier as u128)) as u64;
        updated.speed =
            ((updated.speed as u128) * 100u128 / (upgrade.speed_multiplier as u128)) as u64;
        updated.defense =
            ((updated.defense as u128) * 100u128 / (upgrade.def_multiplier as u128)) as u64;
        updated
    }

    #[internal("public")]
    fn planet_artifacts_contains(
        artifacts: PlanetArtifacts,
        artifact_id: Field,
    ) -> bool {
        let mut found = false;
        for i in 0..(MAX_PLANET_ARTIFACTS as u32) {
            if (!found) & (artifacts.ids[i] == artifact_id) {
                found = true;
            }
        }
        found
    }

    #[internal("public")]
    fn planet_artifacts_has_space(artifacts: PlanetArtifacts) -> bool {
        let mut has_space = false;
        for i in 0..(MAX_PLANET_ARTIFACTS as u32) {
            if (!has_space) & (artifacts.ids[i] == 0) {
                has_space = true;
            }
        }
        has_space
    }

    #[internal("public")]
    fn planet_has_arrivals(location_id: Field) -> bool {
        let arrival_list = self.storage.planet_arrivals.at(location_id).read();
        let mut has = false;
        for i in 0..12 {
            if (!has) & (arrival_list.get(i) != 0) {
                has = true;
            }
        }
        has
    }

    #[internal("public")]
    fn planet_default_space_junk(planet: Planet) -> u64 {
        if planet.is_home_planet {
            0
        } else {
            PLANET_LEVEL_JUNK[planet.planet_level as u32]
        }
    }

    #[internal("public")]
    fn init_planet_extras(location_id: Field, planet: Planet) {
        let mut space_junk = self.internal.planet_default_space_junk(planet);
        if self.internal.is_half_space_junk(location_id) {
            space_junk /= 2;
        }
        self.storage.planet_space_junk.at(location_id).write(space_junk);
    }

    #[internal("public")]
    fn is_half_space_junk(location_id: Field) -> bool {
        let loc_bytes: [u8; 32] = location_id.to_be_bytes();
        loc_bytes[14] < 16
    }

    #[internal("public")]
    fn abandoning_upgrade() -> pub Upgrade {
        Upgrade::new(
            100,
            100,
            ABANDON_RANGE_CHANGE_PERCENT,
            ABANDON_SPEED_CHANGE_PERCENT,
            100,
        )
    }

    #[internal("public")]
    fn apply_spaceship_arrive(
        artifact: Artifact,
        location_id: Field,
        planet: Planet,
    ) -> pub Planet {
        let mut updated = planet;
        if !updated.is_home_planet {
            if artifact.artifact_type == ARTIFACT_TYPE_SHIP_MOTHERSHIP {
                let mut doublers =
                    self.storage.planet_energy_gro_doublers.at(location_id).read();
                if doublers == 0 {
                    updated.population_growth *= 2;
                }
                doublers += 1;
                self.storage.planet_energy_gro_doublers.at(location_id).write(doublers);
            } else if artifact.artifact_type == ARTIFACT_TYPE_SHIP_WHALE {
                let mut doublers =
                    self.storage.planet_silver_gro_doublers.at(location_id).read();
                if doublers == 0 {
                    updated.silver_growth *= 2;
                }
                doublers += 1;
                self.storage.planet_silver_gro_doublers.at(location_id).write(doublers);
            } else if artifact.artifact_type == ARTIFACT_TYPE_SHIP_TITAN {
                let mut pausers = self.storage.planet_pausers.at(location_id).read();
                pausers += 1;
                self.storage.planet_pausers.at(location_id).write(pausers);
            }
        }
        updated
    }

    #[internal("public")]
    fn apply_spaceship_depart(
        artifact: Artifact,
        location_id: Field,
        planet: Planet,
        current_block: u32,
    ) -> pub Planet {
        let mut updated = planet;
        if !updated.is_home_planet {
            if artifact.artifact_type == ARTIFACT_TYPE_SHIP_MOTHERSHIP {
                let mut doublers =
                    self.storage.planet_energy_gro_doublers.at(location_id).read();
                if doublers == 1 {
                    doublers -= 1;
                    updated.population_growth /= 2;
                } else if doublers > 1 {
                    doublers -= 1;
                }
                self.storage.planet_energy_gro_doublers.at(location_id).write(doublers);
            } else if artifact.artifact_type == ARTIFACT_TYPE_SHIP_WHALE {
                let mut doublers =
                    self.storage.planet_silver_gro_doublers.at(location_id).read();
                if doublers == 1 {
                    doublers -= 1;
                    updated.silver_growth /= 2;
                } else if doublers > 1 {
                    doublers -= 1;
                }
                self.storage.planet_silver_gro_doublers.at(location_id).write(doublers);
            } else if artifact.artifact_type == ARTIFACT_TYPE_SHIP_TITAN {
                updated.last_updated = current_block;
                let mut pausers = self.storage.planet_pausers.at(location_id).read();
                if pausers > 0 {
                    pausers -= 1;
                }
                self.storage.planet_pausers.at(location_id).write(pausers);
            }
        }
        updated
    }

    #[internal("public")]
    fn planet_artifacts_add(
        artifacts: PlanetArtifacts,
        artifact_id: Field,
    ) -> pub PlanetArtifacts {
        let mut artifacts = artifacts;
        let mut inserted = false;
        for i in 0..(MAX_PLANET_ARTIFACTS as u32) {
            if (!inserted) & (artifacts.ids[i] == 0) {
                artifacts.ids[i] = artifact_id;
                inserted = true;
            }
        }
        assert(inserted);
        artifacts
    }

    #[internal("public")]
    fn planet_artifacts_remove(
        artifacts: PlanetArtifacts,
        artifact_id: Field,
    ) -> pub PlanetArtifacts {
        let mut artifacts = artifacts;
        let mut removed = false;
        for i in 0..(MAX_PLANET_ARTIFACTS as u32) {
            if artifacts.ids[i] == artifact_id {
                artifacts.ids[i] = 0;
                removed = true;
            }
        }
        assert(removed);
        artifacts
    }

    #[internal("public")]
    fn nft_mint(to: AztecAddress, token_id: Field) {
        let nft_addr = self.storage.nft_contract.read();
        let _ = NFT::at(nft_addr).mint(to, token_id).call(self.context);
    }

    #[internal("public")]
    fn nft_transfer(from: AztecAddress, to: AztecAddress, token_id: Field) {
        let nft_addr = self.storage.nft_contract.read();
        let _ = NFT::at(nft_addr)
            .transfer_in_public(from, to, token_id, 0)
            .call(self.context);
    }


    #[internal("public")]
    fn default_planet(
        owner: AztecAddress,
        location_id: Field,
        perlin: u64,
        is_home: bool,
        current_block: u32,
    ) -> pub Planet {
        let loc_bytes: [u8; 32] = location_id.to_be_bytes();
        let space_type = self.internal.space_type_from_perlin(perlin);
        let level = self.internal.planet_level_from_location(loc_bytes, space_type);
        let planet_type =
            self.internal.planet_type_from_location(loc_bytes, space_type, level);

        if is_home {
            assert(level == 0);
            assert(planet_type == PLANET_TYPE_PLANET);
        }

        self.internal.default_planet_from_stats(
            owner,
            location_id,
            perlin,
            level,
            planet_type,
            space_type,
            is_home,
            current_block,
        )
    }

    #[internal("public")]
    fn default_planet_from_stats(
        owner: AztecAddress,
        location_id: Field,
        perlin: u64,
        level: u8,
        planet_type: u8,
        space_type: u8,
        is_home: bool,
        current_block: u32,
    ) -> pub Planet {
        let loc_bytes: [u8; 32] = location_id.to_be_bytes();
        let level_idx = level as u32;
        let mut population_cap = PLANET_DEFAULT_POP_CAP[level_idx];
        let mut population_growth = PLANET_DEFAULT_POP_GROWTH[level_idx];
        let mut range = PLANET_DEFAULT_RANGE[level_idx];
        let mut speed = PLANET_DEFAULT_SPEED[level_idx];
        let mut defense = PLANET_DEFAULT_DEFENSE[level_idx];
        let mut silver_cap = PLANET_DEFAULT_SILVER_CAP[level_idx];
        let mut silver_growth = if planet_type == PLANET_TYPE_SILVER_MINE {
            PLANET_DEFAULT_SILVER_GROWTH[level_idx]
        } else {
            0
        };

        let pop_cap_boost = loc_bytes[9] < 16;
        let pop_gro_boost = loc_bytes[10] < 16;
        let range_boost = loc_bytes[11] < 16;
        let speed_boost = loc_bytes[12] < 16;
        let def_boost = loc_bytes[13] < 16;

        if pop_cap_boost {
            population_cap *= 2;
        }
        if pop_gro_boost {
            population_growth *= 2;
        }
        if range_boost {
            range *= 2;
        }
        if speed_boost {
            speed *= 2;
        }
        if def_boost {
            defense *= 2;
        }

        if space_type == SPACE_TYPE_DEAD_SPACE {
            range *= 2;
            speed *= 2;
            population_cap *= 2;
            population_growth *= 2;
            silver_cap *= 2;
            silver_growth *= 2;
            defense = (defense * 3) / 20;
        } else if space_type == SPACE_TYPE_DEEP_SPACE {
            range = (range * 3) / 2;
            speed = (speed * 3) / 2;
            population_cap = (population_cap * 3) / 2;
            population_growth = (population_growth * 3) / 2;
            silver_cap = (silver_cap * 3) / 2;
            silver_growth = (silver_growth * 3) / 2;
            defense = defense / 4;
        } else if space_type == SPACE_TYPE_SPACE {
            range = (range * 5) / 4;
            speed = (speed * 5) / 4;
            population_cap = (population_cap * 5) / 4;
            population_growth = (population_growth * 5) / 4;
            silver_cap = (silver_cap * 5) / 4;
            silver_growth = (silver_growth * 5) / 4;
            defense = defense / 2;
        }

        if planet_type == PLANET_TYPE_SILVER_MINE {
            silver_cap *= 2;
            defense /= 2;
        } else if planet_type == PLANET_TYPE_SILVER_BANK {
            speed /= 2;
            silver_cap *= 10;
            population_growth = 0;
            population_cap *= 5;
        } else if planet_type == PLANET_TYPE_TRADING_POST {
            defense /= 2;
            silver_cap *= 2;
        }

        let mut population =
            (population_cap * PLANET_DEFAULT_BARBARIAN_PERCENT[level_idx]) / 100;

        if space_type == SPACE_TYPE_DEAD_SPACE {
            population *= 20;
        } else if space_type == SPACE_TYPE_DEEP_SPACE {
            population *= 10;
        } else if space_type == SPACE_TYPE_SPACE {
            population *= 4;
        }
        if planet_type == PLANET_TYPE_SILVER_BANK {
            population /= 2;
        }

        let mut silver = 0;
        if planet_type == PLANET_TYPE_SILVER_MINE {
            silver = silver_cap / 2;
        }

        // Scale time-dependent rates by the on-chain time factor (hundredths).
        let time_factor = self.storage.config.read().time_factor_hundredths;
        population_growth = (population_growth * time_factor) / 100;
        silver_growth = (silver_growth * time_factor) / 100;

        let mut planet_owner = AztecAddress::zero();
        let mut is_home_planet = false;
        if is_home {
            planet_owner = owner;
            population = HOME_PLANET_POPULATION;
            silver = 0;
            is_home_planet = true;
        }

        Planet::new(
            planet_owner,
            perlin,
            population,
            population_cap,
            population_growth,
            silver,
            silver_cap,
            silver_growth,
            range,
            speed,
            defense,
            current_block,
            level,
            planet_type,
            space_type,
            is_home_planet,
            0,
            0,
            0,
        )
    }

    #[internal("public")]
    fn decayed_population(
        pop_moved: u64,
        dist: u64,
        range: u64,
        pop_cap: u64,
    ) -> pub u64 {
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

    #[internal("public")]
    fn update_population(
        planet: Planet,
        time_elapsed: u128,
        pausers: u8,
    ) -> pub Planet {
        let mut updated = planet;
        if time_elapsed != 0 {
            let pop_cap = updated.population_cap as u128;
            let pop = updated.population as u128;
            let prev_pop = updated.population;
            if (pop != 0) & (pop_cap != 0) {
                let numerator =
                    (4u128 * (updated.population_growth as u128)) * time_elapsed;
                let x_q32 = (numerator << 32) / pop_cap;
                let exp_neg = exp_neg_q32(x_q32);

                if exp_neg == 0 {
                    updated.population = updated.population_cap;
                } else {
                    let ratio_q32 = (pop_cap << 32) / pop;
                    let mut ratio_minus_one_neg = false;
                    let mut ratio_minus_one_mag: u128 = 0;
                    if ratio_q32 >= (1u128 << 32) {
                        ratio_minus_one_mag = ratio_q32 - (1u128 << 32);
                    } else {
                        ratio_minus_one_mag = (1u128 << 32) - ratio_q32;
                        ratio_minus_one_neg = true;
                    }
                    let product_mag = (exp_neg * ratio_minus_one_mag) >> 32;
                    let denom_q32 = if ratio_minus_one_neg {
                        if product_mag >= (1u128 << 32) {
                            1u128
                        } else {
                            (1u128 << 32) - product_mag
                        }
                    } else {
                        (1u128 << 32) + product_mag
                    };
                    let new_pop = (pop_cap << 32) / denom_q32;
                    updated.population = new_pop as u64;
                }

                if (pausers > 0) & (updated.population > prev_pop) {
                    updated.population = prev_pop;
                }

                if (updated.planet_type == PLANET_TYPE_SILVER_BANK) | (pausers > 0)
                {
                    if updated.population > updated.population_cap {
                        updated.population = updated.population_cap;
                    }
                }
            }
        }
        updated
    }

    #[internal("public")]
    fn update_silver(planet: Planet, time_elapsed: u128) -> pub Planet {
        let mut updated = planet;
        if time_elapsed != 0 {
            let silver = updated.silver as u128;
            let silver_cap = updated.silver_cap as u128;
            if silver < silver_cap {
                let growth = updated.silver_growth as u128;
                let mined = growth * time_elapsed;
                let next_silver = silver + mined;
                updated.silver = if next_silver > silver_cap {
                    silver_cap as u64
                } else {
                    next_silver as u64
                };
            }
        }
        updated
    }

    #[internal("public")]
    fn process_pending_arrivals(location_id: Field, up_to_block: u32) {
        let mut done = false;
        for _ in 0..12 {
            if !done {
                let arrival_list = self.storage.planet_arrivals.at(location_id).read();
                let mut earliest_block: u32 = 0xFFFF_FFFF;
                let mut earliest_id: u64 = 0;
                for i in 0..12 {
                    let arrival_id = arrival_list.get(i);
                    if arrival_id != 0 {
                        let arrival = self.storage.arrivals.at(arrival_id as Field).read();
                        let arrival_block = arrival.arrival_block();
                        if (arrival_block != 0) & (arrival_block <= up_to_block) {
                            if arrival_block < earliest_block {
                                earliest_block = arrival_block;
                                earliest_id = arrival_id;
                            }
                        }
                    }
                }

                if earliest_id == 0 {
                    done = true;
                } else {
                    self.internal.execute_arrival(earliest_id);
                }
            }
        }
    }

    #[internal("public")]
    fn refresh_planet(location_id: Field, planet: Planet, update_block: u32) -> pub Planet {
        let mut updated = planet;
        if updated.is_initialized & (update_block > updated.last_updated) {
            let time_elapsed = (update_block - updated.last_updated) as u128;
            if !updated.owner.eq(AztecAddress::zero()) {
                let pausers = self.storage.planet_pausers.at(location_id).read();
                updated = self.internal.update_population(updated, time_elapsed, pausers);
                if updated.planet_type == PLANET_TYPE_SILVER_MINE {
                    updated = self.internal.update_silver(updated, time_elapsed);
                }
            }
            updated.last_updated = update_block;
        }
        updated
    }

    #[internal("public")]
    fn index_touched_planet(location_id: Field) {
        let seen = self.storage.touched_planet_seen.at(location_id).read();
        if seen == 0 {
            let idx = self.storage.touched_planet_ids_count.read();
            self.storage.touched_planet_ids.at(idx as Field).write(location_id);
            self.storage.touched_planet_ids_count.write(idx + 1);
            self.storage.touched_planet_seen.at(location_id).write(1);
        }
    }

    #[internal("public")]
    fn index_revealed_coords(
        location_id: Field,
        x: Field,
        y: Field,
        revealer: AztecAddress,
    ) {
        let seen = self.storage.revealed_seen.at(location_id).read();
        if seen == 0 {
            let idx = self.storage.revealed_coords_count.read();
            let coords = RevealedCoords::new(location_id, x, y, revealer);
            self.storage.revealed_coords.at(idx as Field).write(coords);
            self.storage.revealed_coords_count.write(idx + 1);
            self.storage.revealed_seen.at(location_id).write(1);
        }
    }


    #[external("private")]
    fn init_player(
        x: Field,
        y: Field,
        radius: u64,
        planethash_key: Field,
        spacetype_key: Field,
        perlin_length_scale: u64,
        perlin_mirror_x: bool,
        perlin_mirror_y: bool,
        max_location_id: Field,
        world_radius: u64,
        spawn_rim_area: u64,
        init_perlin_min: u64,
        init_perlin_max: u64,
    ) {
        let player = self.context.msg_sender().unwrap();

        let x_abs = field_abs_u128(x);
        let y_abs = field_abs_u128(y);
        assert(x_abs <= MAX_COORD_ABS);
        assert(y_abs <= MAX_COORD_ABS);

        let r_u = radius as u128;
        let dist_sq = x_abs * x_abs + y_abs * y_abs;
        let r_sq = r_u * r_u;
        assert(dist_sq < r_sq);

        let perlin_u64 = multi_scale_perlin(
            x,
            y,
            spacetype_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );
        let cfg_hash = config_hash(
            planethash_key,
            spacetype_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );

        let location_id = hash_2(x, y, planethash_key);
        assert(bn254::lt(location_id, max_location_id));
        assert(radius <= world_radius);
        if spawn_rim_area != 0 {
            assert(dist_sq * 100 > r_sq * 98);
            let radius_u = radius as u128;
            let world_u = world_radius as u128;
            let lhs = ((radius_u * radius_u * 314u128) / 100u128)
                + (spawn_rim_area as u128);
            let rhs = (world_u * world_u * 314u128) / 100u128;
            assert(lhs >= rhs);
        }
        assert(
            (perlin_u64 >= init_perlin_min)
            & (perlin_u64 < init_perlin_max)
        );

        // Private nullifier ensures init claims are one-time even if public state is stale within a block.
        self.context.push_nullifier(location_id);
        let player_nullifier = hash_2(player.to_field(), 1, planethash_key);
        self.context.push_nullifier(player_nullifier);

        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_init_player(
                player,
                location_id,
                perlin_u64,
                cfg_hash,
            )
        );
    }

    #[external("public")]
    #[only_self]
    fn apply_init_player(
        player: AztecAddress,
        location_id: Field,
        perlin: u64,
        config_hash: Field,
    ) {
        let stored_hash = self.storage.config_hash_spacetype.read();
        assert(config_hash == stored_hash);

        let current_block = self.context.block_number();
        let existing_planet = self.storage.planets.at(location_id).read();
        // v0.6: LibPlanet._initializePlanet reverts if the planet is already initialized.
        assert(!existing_planet.is_initialized);
        let planet = self.internal.default_planet(
            player,
            location_id,
            perlin,
            true,
            current_block
        );
        self.storage.planets.at(location_id).write(planet);
        self.internal.init_planet_extras(location_id, planet);
        self.storage
            .players
            .at(player)
            .write(Player::new(location_id, current_block));
        self.storage.player_claimed_ships.at(player).write(0);
        self.storage.player_space_junk.at(player).write(0);
        self.storage
            .player_space_junk_limit
            .at(player)
            .write(SPACE_JUNK_LIMIT);
        self.internal.index_touched_planet(location_id);
    }

    #[external("public")]
    #[only_self]
    fn apply_player_action(
        player: AztecAddress,
        location_id: Field,
        x: Field,
        y: Field,
        perlin: u64,
        radius: u64,
        config_hash: Field,
        action: u8,
    ) {
        let config = self.storage.config.read();
        let current_block = self.context.block_number();
        if action == 1 {
            let stored = self.storage.config_hash_spacetype.read();
            assert(config_hash == stored);

            let existing = self.storage.revealed.at(location_id).read();
            assert(existing.location_id == 0);

            if config.location_reveal_cooldown > 0 {
                let player_state = self.storage.players.at(player).read();
                assert(
                    current_block - player_state.last_reveal_block
                        > config.location_reveal_cooldown
                );
            }

            let existing_planet = self.storage.planets.at(location_id).read();
            if !existing_planet.is_initialized {
                let planet = self.internal.default_planet(
                    AztecAddress::zero(),
                    location_id,
                    perlin,
                    false,
                    current_block
                );
                // Mark the location as initialized so future inits fail deterministically.
                self.context.push_nullifier(location_id);
                self.storage.planets.at(location_id).write(planet);
                self.internal.init_planet_extras(location_id, planet);
            }

            self.storage
                .revealed
                .at(location_id)
                .write(RevealedCoords::new(location_id, x, y, player));
            self.internal.index_touched_planet(location_id);
            self.internal.index_revealed_coords(location_id, x, y, player);

            let mut player_state = self.storage.players.at(player).read();
            player_state.last_reveal_block = current_block;
            self.storage.players.at(player).write(player_state);
        } else if action == 2 {
            let player_state = self.storage.players.at(player).read();
            assert(player_state.is_initialized);
            let claimed = self.storage.player_claimed_ships.at(player).read();
            assert(claimed == 0);
            assert(player_state.home_planet == location_id);

            let planet = self.storage.planets.at(location_id).read();
            assert(planet.owner.eq(player));

            let mut planet_artifacts = self.storage.planet_artifacts.at(location_id).read();

            let ship_types: [u8; 5] = [
                ARTIFACT_TYPE_SHIP_MOTHERSHIP,
                ARTIFACT_TYPE_SHIP_CRESCENT,
                ARTIFACT_TYPE_SHIP_WHALE,
                ARTIFACT_TYPE_SHIP_GEAR,
                ARTIFACT_TYPE_SHIP_TITAN,
            ];
            for i in 0..5 {
                let ship_type = ship_types[i];
                let ship_id =
                    self.internal.ship_artifact_id(location_id, ship_type, config.planethash_key);
                self.storage.spaceships.at(ship_id).write(ship_type);
                self.storage.spaceship_owners.at(ship_id).write(player);
                self.storage.artifact_locations.at(ship_id).write(location_id);
                self.internal.nft_mint(player, ship_id);
                planet_artifacts = self.internal.planet_artifacts_add(
                    planet_artifacts,
                    ship_id
                );
            }

            self.storage.planet_artifacts.at(location_id).write(planet_artifacts);
            self.storage.player_claimed_ships.at(player).write(1);
        } else if action == 3 {
            // For action 3, radius carries the upgrade branch from the private call.
            let branch = radius as u8;
            self.internal.execute_upgrade_planet(player, location_id, branch);
        } else if action == 4 {
            let planet = self.storage.planets.at(location_id).read();
            assert(!self.internal.is_planet_destroyed(location_id));
            assert(planet.owner.eq(player));
            assert(planet.planet_type == PLANET_TYPE_FOUNDRY);

            let mut state = self.storage.planet_artifact_state.at(location_id).read();
            assert(state.prospected_block_number == 0);
            state.prospected_block_number = current_block;
            self.storage.planet_artifact_state.at(location_id).write(state);
        } else if action == 5 {
            let stored = self.storage.config_hash_biome.read();
            assert(config_hash == stored);

            let biomebase = perlin;
            let planet = self.storage.planets.at(location_id).read();
            assert(!self.internal.is_planet_destroyed(location_id));
            assert(planet.owner.eq(player));
            assert(planet.planet_type == PLANET_TYPE_FOUNDRY);

            let mut state = self.storage.planet_artifact_state.at(location_id).read();
            assert(!state.has_tried_finding_artifact);
            assert(state.prospected_block_number != 0);

            assert(current_block > state.prospected_block_number);
            let blocks_since = current_block - state.prospected_block_number;
            assert(blocks_since < 256);

            let biome = self.internal.biome_from_space_type(planet.space_type, biomebase);
            let block_hash = self.internal.pseudo_blockhash(
                state.prospected_block_number,
                config.planethash_key,
            );
            let artifact_seed = self.internal.artifact_seed(
                location_id,
                self.context.this_address(),
                block_hash,
                config.planethash_key,
            );
            assert(artifact_seed != 0);
            let (artifact_type, level_bonus) =
                self.internal.random_artifact_type_and_level_bonus(artifact_seed, biome);
            let level_with_bonus =
                (planet.planet_level as u16 + level_bonus as u16) as u8;
            let rarity = self.internal.artifact_rarity_from_planet_level(level_with_bonus);

            let existing_artifact = self.storage.artifacts.at(artifact_seed).read();
            assert(!existing_artifact.is_initialized);
            let mut planet_artifacts = self.storage.planet_artifacts.at(location_id).read();
            planet_artifacts =
                self.internal.planet_artifacts_add(planet_artifacts, artifact_seed);

            let artifact = Artifact::new(
                artifact_seed,
                location_id,
                rarity,
                biome,
                player,
                artifact_type,
            );
            self.storage.artifacts.at(artifact_seed).write(artifact);
            self.storage.planet_artifacts.at(location_id).write(planet_artifacts);
            self.storage.artifact_locations.at(artifact_seed).write(location_id);
            let contract_addr = self.context.this_address();
            self.internal.nft_mint(contract_addr, artifact_seed);

            state.has_tried_finding_artifact = true;
            self.storage.planet_artifact_state.at(location_id).write(state);
        } else if (action == 10) | (action == 11) {
            let withdrawing = action == 11;
            let artifact_id = x;

            let planet = self.storage.planets.at(location_id).read();
            assert(!self.internal.is_planet_destroyed(location_id));
            assert(planet.owner.eq(player));
            assert(planet.planet_type == PLANET_TYPE_TRADING_POST);

            let artifact = self.storage.artifacts.at(artifact_id).read();
            assert(artifact.is_initialized);
            assert(!artifact.burned);
            assert(!self.internal.is_spaceship(artifact.artifact_type));
            assert(planet.planet_level > artifact.rarity);

            let mut planet_artifacts = self.storage.planet_artifacts.at(location_id).read();
            if withdrawing {
                let current_location =
                    self.storage.artifact_locations.at(artifact_id).read();
                assert(current_location == location_id);
                assert(self.internal.planet_artifacts_contains(
                    planet_artifacts,
                    artifact_id
                ));
                planet_artifacts =
                    self.internal.planet_artifacts_remove(planet_artifacts, artifact_id);
                self.storage.planet_artifacts.at(location_id).write(planet_artifacts);
                self.storage.artifact_locations.at(artifact_id).write(0);

                let contract_addr = self.context.this_address();
                self.internal.nft_transfer(contract_addr, player, artifact_id);
            } else {
                let current_location =
                    self.storage.artifact_locations.at(artifact_id).read();
                assert(current_location == 0);

                assert(!self.internal.planet_artifacts_contains(planet_artifacts, artifact_id));
                planet_artifacts =
                    self.internal.planet_artifacts_add(planet_artifacts, artifact_id);
                self.storage.planet_artifacts.at(location_id).write(planet_artifacts);
                self.storage.artifact_locations.at(artifact_id).write(location_id);
                let contract_addr = self.context.this_address();
                self.internal.nft_transfer(player, contract_addr, artifact_id);
            }
        } else if action == 12 {
            let artifact_id = x;
            let wormhole_to = y;

            let mut planet = self.storage.planets.at(location_id).read();
            assert(!self.internal.is_planet_destroyed(location_id));

            let mut planet_artifacts = self.storage.planet_artifacts.at(location_id).read();
            assert(self.internal.planet_artifacts_contains(planet_artifacts, artifact_id));

            let mut artifact = self.internal.load_artifact_or_ship(artifact_id);
            assert(artifact.is_initialized);
            assert(!artifact.burned);
            let is_ship = self.internal.is_spaceship(artifact.artifact_type);

            let current_block = self.context.block_number();
            if is_ship {
                assert(artifact.artifact_type == ARTIFACT_TYPE_SHIP_CRESCENT);
                assert(wormhole_to == 0);
                assert(planet.owner.eq(AztecAddress::zero()));
                assert(planet.planet_type != PLANET_TYPE_SILVER_MINE);
                assert(planet.planet_level >= 1);
                assert(artifact.activations == 0);

                artifact.last_activated = current_block;
                artifact.last_deactivated = current_block;
                if planet.silver == 0 {
                    planet.silver = 1;
                    let default_planet = self.internal.default_planet_from_stats(
                        AztecAddress::zero(),
                        location_id,
                        planet.perlin,
                        planet.planet_level,
                        PLANET_TYPE_SILVER_MINE,
                        planet.space_type,
                        false,
                        current_block,
                    );
                    planet.silver_growth = default_planet.silver_growth;
                }
                planet.planet_type = PLANET_TYPE_SILVER_MINE;
                artifact.activations += 1;
                self.storage.artifacts.at(artifact_id).write(artifact);
                self.storage.planets.at(location_id).write(planet);
            } else {
                assert(planet.owner.eq(player));
                assert(artifact.artifact_type < 10u8);

                let active = self.internal.get_active_artifact(location_id);
                assert(!active.is_initialized);

                let cooldown = ARTIFACT_COOLDOWN_BLOCKS[artifact.artifact_type as u32];
                if artifact.last_deactivated != 0 {
                    assert(current_block > artifact.last_deactivated + cooldown);
                }

                if artifact.artifact_type == ARTIFACT_TYPE_WORMHOLE {
                    assert(wormhole_to != 0);
                    let target = self.storage.planets.at(wormhole_to).read();
                    assert(target.is_initialized);
                    assert(!self.internal.is_planet_destroyed(wormhole_to));
                    assert(target.owner.eq(player));
                    artifact.wormhole_to = wormhole_to;
                } else {
                    assert(wormhole_to == 0);
                }

                artifact.last_activated = current_block;
                artifact.activations += 1;

                let mut should_burn = false;
                if artifact.artifact_type == ARTIFACT_TYPE_BLOOM_FILTER {
                    assert(((artifact.rarity as u16) * 2u16) >= (planet.planet_level as u16));
                    planet.population = planet.population_cap;
                    planet.silver = planet.silver_cap;
                    should_burn = true;
                } else if artifact.artifact_type == ARTIFACT_TYPE_BLACK_DOMAIN {
                    assert(((artifact.rarity as u16) * 2u16) >= (planet.planet_level as u16));
                    self.storage.planet_destroyed.at(location_id).write(1);
                    should_burn = true;
                }

                let upgrade = self.internal.upgrade_for_artifact(artifact);
                planet = self.internal.buff_planet(planet, upgrade);

                if should_burn {
                    artifact.last_deactivated = current_block;
                    artifact.wormhole_to = 0;
                    artifact.burned = true;
                    planet_artifacts =
                        self.internal.planet_artifacts_remove(planet_artifacts, artifact_id);
                    self.storage.planet_artifacts.at(location_id).write(planet_artifacts);
                    self.storage
                        .artifact_locations
                        .at(artifact_id)
                        .write(config.max_location_id);
                    let contract_addr = self.context.this_address();
                    let burn_addr = contract_addr;
                    self.internal.nft_transfer(
                        contract_addr,
                        burn_addr,
                        artifact_id,
                    );
                }

                self.storage.artifacts.at(artifact_id).write(artifact);
                self.storage.planets.at(location_id).write(planet);
            }
        } else if action == 13 {
            let _ = self.internal.execute_deactivate_artifact(player, location_id);
        } else {
            assert(false);
        }
    }

    #[external("private")]
    fn reveal_location(
        x: Field,
        y: Field,
        planethash_key: Field,
        spacetype_key: Field,
        perlin_length_scale: u64,
        perlin_mirror_x: bool,
        perlin_mirror_y: bool,
        max_location_id: Field,
    ) {
        let player = self.context.msg_sender().unwrap();

        let x_abs = field_abs_u128(x);
        let y_abs = field_abs_u128(y);
        assert(x_abs <= MAX_COORD_ABS);
        assert(y_abs <= MAX_COORD_ABS);

        let perlin_u64 = multi_scale_perlin(
            x,
            y,
            spacetype_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );
        let cfg_hash = config_hash(
            planethash_key,
            spacetype_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );

        let location_id = hash_2(x, y, planethash_key);
        assert(bn254::lt(location_id, max_location_id));

        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                x,
                y,
                perlin_u64,
                0,
                cfg_hash,
                1,
            )
        );
    }

    #[external("private")]
    fn upgrade_planet(location_id: Field, branch: u8) {
        let player = self.context.msg_sender().unwrap();
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                0,
                0,
                0,
                branch as u64,
                0,
                3,
            )
        );
    }

    #[internal("public")]
    fn execute_upgrade_planet(
        player: AztecAddress,
        location_id: Field,
        branch: u8,
    ) {
        assert(branch < 3);

        let current_block = self.context.block_number();
        self.internal.process_pending_arrivals(location_id, current_block);
        let mut planet = self.storage.planets.at(location_id).read();
        planet = self.internal.refresh_planet(location_id, planet, current_block);

        assert(planet.owner.eq(player));
        assert(planet.planet_level > 0);
        assert(planet.planet_type == PLANET_TYPE_PLANET);

        let total_level: u8 =
            planet.upgrade_state0 + planet.upgrade_state1 + planet.upgrade_state2;
        let max_total: u8 = if planet.space_type == SPACE_TYPE_NEBULA {
            3
        } else if planet.space_type == SPACE_TYPE_SPACE {
            4
        } else {
            5
        };
        assert(total_level < max_total);

        let mut branch_level: u8 = 0;
        if branch == UPGRADE_BRANCH_DEFENSE {
            branch_level = planet.upgrade_state0;
        } else if branch == UPGRADE_BRANCH_RANGE {
            branch_level = planet.upgrade_state1;
        } else if branch == UPGRADE_BRANCH_SPEED {
            branch_level = planet.upgrade_state2;
        }
        assert(branch_level < 4);

        let total_level_u64 = total_level as u64;
        let upgrade_cost = ((planet.silver_cap as u128) * 20u128 * ((total_level_u64 + 1) as u128)) / 100u128;
        assert((planet.silver as u128) >= upgrade_cost);

        let idx = branch as u32;
        planet.population_cap =
            ((planet.population_cap as u128) * (UPGRADE_POP_CAP_MULTIPLIER[idx] as u128) / 100u128) as u64;
        planet.population_growth =
            ((planet.population_growth as u128) * (UPGRADE_POP_GROWTH_MULTIPLIER[idx] as u128) / 100u128) as u64;
        planet.range =
            ((planet.range as u128) * (UPGRADE_RANGE_MULTIPLIER[idx] as u128) / 100u128) as u64;
        planet.speed =
            ((planet.speed as u128) * (UPGRADE_SPEED_MULTIPLIER[idx] as u128) / 100u128) as u64;
        planet.defense =
            ((planet.defense as u128) * (UPGRADE_DEFENSE_MULTIPLIER[idx] as u128) / 100u128) as u64;

        planet.silver = ((planet.silver as u128) - upgrade_cost) as u64;
        if branch == UPGRADE_BRANCH_DEFENSE {
            planet.upgrade_state0 += 1;
        } else if branch == UPGRADE_BRANCH_RANGE {
            planet.upgrade_state1 += 1;
        } else if branch == UPGRADE_BRANCH_SPEED {
            planet.upgrade_state2 += 1;
        }

        self.storage.planets.at(location_id).write(planet);
    }

    #[external("private")]
    fn prospect_planet(location_id: Field) {
        let player = self.context.msg_sender().unwrap();
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                0,
                0,
                0,
                0,
                0,
                4,
            )
        );
    }

    #[external("private")]
    fn find_artifact(
        x: Field,
        y: Field,
        biomebase: u64,
        planethash_key: Field,
        biomebase_key: Field,
        perlin_length_scale: u64,
        perlin_mirror_x: bool,
        perlin_mirror_y: bool,
        max_location_id: Field,
    ) {
        let player = self.context.msg_sender().unwrap();
        let location_id = hash_2(x, y, planethash_key);

        let x_abs = field_abs_u128(x);
        let y_abs = field_abs_u128(y);
        assert(x_abs <= MAX_COORD_ABS);
        assert(y_abs <= MAX_COORD_ABS);
        let computed_biomebase = multi_scale_perlin(
            x,
            y,
            biomebase_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );
        assert(computed_biomebase == biomebase);
        let cfg_hash = config_hash(
            planethash_key,
            biomebase_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );
        assert(bn254::lt(location_id, max_location_id));

        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                0,
                0,
                biomebase,
                0,
                cfg_hash,
                5,
            )
        );
    }

    #[external("private")]
    fn trade_artifact(location_id: Field, artifact_id: Field, withdrawing: bool) {
        let player = self.context.msg_sender().unwrap();
        let action = if withdrawing { 11 } else { 10 };
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                artifact_id,
                0,
                0,
                0,
                0,
                action,
            )
        );
    }

    #[external("private")]
    fn give_space_ships(location_id: Field) {
        let player = self.context.msg_sender().unwrap();
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                0,
                0,
                0,
                0,
                0,
                2,
            )
        );
    }

    #[internal("public")]
    fn execute_deactivate_artifact(
        player: AztecAddress,
        location_id: Field,
    ) -> pub Planet {
        let mut planet = self.storage.planets.at(location_id).read();
        assert(!self.internal.is_planet_destroyed(location_id));
        assert(planet.owner.eq(player));

        let mut artifact = self.internal.get_active_artifact(location_id);
        assert(artifact.is_initialized);

        let current_block = self.context.block_number();
        artifact.last_deactivated = current_block;
        artifact.wormhole_to = 0;

        let upgrade = self.internal.upgrade_for_artifact(artifact);
        planet = self.internal.debuff_planet(planet, upgrade);

        let should_burn = (artifact.artifact_type == ARTIFACT_TYPE_PLANETARY_SHIELD)
            | (artifact.artifact_type == ARTIFACT_TYPE_PHOTOID_CANNON);
        if should_burn {
            let mut planet_artifacts = self.storage.planet_artifacts.at(location_id).read();
            assert(self.internal.planet_artifacts_contains(planet_artifacts, artifact.id));
            planet_artifacts = self.internal.planet_artifacts_remove(planet_artifacts, artifact.id);
            self.storage.planet_artifacts.at(location_id).write(planet_artifacts);
            let burn_location_id = self.storage.config.read().max_location_id;
            self.storage
                .artifact_locations
                .at(artifact.id)
                .write(burn_location_id);
            artifact.burned = true;
            let contract_addr = self.context.this_address();
            self.internal.nft_transfer(contract_addr, contract_addr, artifact.id);
        }

        self.storage.artifacts.at(artifact.id).write(artifact);
        self.storage.planets.at(location_id).write(planet);
        planet
    }

    #[external("private")]
    fn set_artifact_activation(
        location_id: Field,
        artifact_id: Field,
        wormhole_to: Field,
        activate: bool,
    ) {
        let player = self.context.msg_sender().unwrap();
        let action = if activate { 12 } else { 13 };
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                artifact_id,
                wormhole_to,
                0,
                0,
                0,
                action,
            )
        );
    }

    #[external("private")]
    fn move(
        x1: Field,
        y1: Field,
        x2: Field,
        y2: Field,
        radius: u64,
        dist_max: u64,
        pop_moved: u64,
        silver_moved: u64,
        moved_artifact_id: Field,
        abandoning: bool,
        planethash_key: Field,
        spacetype_key: Field,
        perlin_length_scale: u64,
        perlin_mirror_x: bool,
        perlin_mirror_y: bool,
        max_location_id: Field,
        world_radius: u64,
    ) {
        let player = self.context.msg_sender().unwrap();

        let x1_abs = field_abs_u128(x1);
        let y1_abs = field_abs_u128(y1);
        let x2_abs = field_abs_u128(x2);
        let y2_abs = field_abs_u128(y2);
        assert(x1_abs <= MAX_COORD_ABS);
        assert(y1_abs <= MAX_COORD_ABS);
        assert(x2_abs <= MAX_COORD_ABS);
        assert(y2_abs <= MAX_COORD_ABS);

        let r_u = radius as u128;
        let dist_from_origin_sq = x2_abs * x2_abs + y2_abs * y2_abs;
        let r_sq = r_u * r_u;
        assert(dist_from_origin_sq < r_sq);

        let diff_x = signed_sub(field_to_signed(x1), field_to_signed(x2));
        let diff_y = signed_sub(field_to_signed(y1), field_to_signed(y2));
        let dist_sq = diff_x.mag * diff_x.mag + diff_y.mag * diff_y.mag;
        let dist_max_u = dist_max as u128;
        assert(dist_sq <= dist_max_u * dist_max_u);

        let perlin_u64 = multi_scale_perlin(
            x2,
            y2,
            spacetype_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );
        let cfg_hash = config_hash(
            planethash_key,
            spacetype_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );

        let from_location_id = hash_2(x1, y1, planethash_key);
        let to_location_id = hash_2(x2, y2, planethash_key);
        assert(radius <= world_radius);
        assert(bn254::lt(to_location_id, max_location_id));

        let move_config: u128 =
            ((dist_max as u128) << 64) | (radius as u128);
        let move_resources: u128 =
            ((silver_moved as u128) << 64) | (pop_moved as u128);

        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_move(
                player,
                from_location_id,
                to_location_id,
                perlin_u64,
                move_config,
                move_resources,
                moved_artifact_id,
                cfg_hash,
                abandoning,
            )
        );
    }

    #[external("private")]
    fn move_known(
        x1: Field,
        y1: Field,
        x2: Field,
        y2: Field,
        radius: u64,
        dist_max: u64,
        pop_moved: u64,
        silver_moved: u64,
        moved_artifact_id: Field,
        abandoning: bool,
        planethash_key: Field,
        spacetype_key: Field,
        perlin_length_scale: u64,
        perlin_mirror_x: bool,
        perlin_mirror_y: bool,
        max_location_id: Field,
        world_radius: u64,
    ) {
        let player = self.context.msg_sender().unwrap();

        let x1_abs = field_abs_u128(x1);
        let y1_abs = field_abs_u128(y1);
        let x2_abs = field_abs_u128(x2);
        let y2_abs = field_abs_u128(y2);
        assert(x1_abs <= MAX_COORD_ABS);
        assert(y1_abs <= MAX_COORD_ABS);
        assert(x2_abs <= MAX_COORD_ABS);
        assert(y2_abs <= MAX_COORD_ABS);

        let r_u = radius as u128;
        let dist_from_origin_sq = x2_abs * x2_abs + y2_abs * y2_abs;
        let r_sq = r_u * r_u;
        assert(dist_from_origin_sq < r_sq);

        let diff_x = signed_sub(field_to_signed(x1), field_to_signed(x2));
        let diff_y = signed_sub(field_to_signed(y1), field_to_signed(y2));
        let dist_sq = diff_x.mag * diff_x.mag + diff_y.mag * diff_y.mag;
        assert(dist_max < MOVE_KNOWN_FLAG);
        let dist_max_u = dist_max as u128;
        assert(dist_sq <= dist_max_u * dist_max_u);

        let cfg_hash = config_hash(
            planethash_key,
            spacetype_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
        );

        let from_location_id = hash_2(x1, y1, planethash_key);
        let to_location_id = hash_2(x2, y2, planethash_key);
        assert(radius <= world_radius);
        assert(bn254::lt(to_location_id, max_location_id));

        let dist_max_flagged = dist_max + MOVE_KNOWN_FLAG;
        let move_config: u128 =
            ((dist_max_flagged as u128) << 64) | (radius as u128);
        let move_resources: u128 =
            ((silver_moved as u128) << 64) | (pop_moved as u128);

        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_move(
                player,
                from_location_id,
                to_location_id,
                0,
                move_config,
                move_resources,
                moved_artifact_id,
                cfg_hash,
                abandoning,
            )
        );
    }

    #[external("public")]
    #[only_self]
    fn apply_move(
        player: AztecAddress,
        from_location_id: Field,
        to_location_id: Field,
        perlin: u64,
        move_config: u128,
        move_resources: u128,
        moved_artifact_id: Field,
        config_hash: Field,
        abandoning: bool,
    ) {
        let is_arrival = config_hash == 0;
        if is_arrival {
            let arrival_id = move_config as u64;
            self.internal.execute_arrival(arrival_id);
        } else {
            let stored = self.storage.config_hash_spacetype.read();
            assert(config_hash == stored);
            let config = self.storage.config.read();
        let dist_max_raw = (move_config >> 64) as u64;
        let require_to_initialized = dist_max_raw >= MOVE_KNOWN_FLAG;
        let dist_max = if require_to_initialized {
            dist_max_raw - MOVE_KNOWN_FLAG
        } else {
            dist_max_raw
        };
        let mut pop_moved = move_resources as u64;
        let mut silver_moved = (move_resources >> 64) as u64;

        let current_block = self.context.block_number();
        self.internal.process_pending_arrivals(from_location_id, current_block);
        self.internal.process_pending_arrivals(to_location_id, current_block);

        let mut player_space_junk = self.storage.player_space_junk.at(player).read();
        let player_space_junk_limit = self.storage.player_space_junk_limit.at(player).read();

        let mut from_planet = self.storage.planets.at(from_location_id).read();
        assert(from_planet.is_initialized);
        from_planet = self.internal.refresh_planet(from_location_id, from_planet, current_block);

        let mut moved_artifact = Artifact::empty();
        let mut is_spaceship_move = false;
        if moved_artifact_id != 0 {
            moved_artifact = self.internal.load_artifact_or_ship(moved_artifact_id);
            assert(moved_artifact.is_initialized);
            let from_artifacts = self.storage.planet_artifacts.at(from_location_id).read();
            assert(self.internal.planet_artifacts_contains(from_artifacts, moved_artifact_id));
            assert(!self.internal.is_artifact_active(moved_artifact));
            is_spaceship_move = self.internal.is_spaceship(moved_artifact.artifact_type);
            if is_spaceship_move {
                assert(moved_artifact.discoverer.eq(player));
                assert(pop_moved == 0);
                assert(silver_moved == 0);
            }
        }

        if !is_spaceship_move {
            assert(!self.internal.is_planet_destroyed(from_location_id));
            assert(from_planet.owner.eq(player));
            if !abandoning {
                assert(pop_moved < from_planet.population);
                assert(silver_moved <= from_planet.silver);
            }
        }

        let mut to_planet = self.storage.planets.at(to_location_id).read();
        if !to_planet.is_initialized {
            assert(!require_to_initialized);
            to_planet = self.internal.default_planet(
                AztecAddress::zero(),
                to_location_id,
                perlin,
                false,
                current_block
            );
            // Planet initialization should be one-time across all actions.
            self.context.push_nullifier(to_location_id);
            self.storage.planets.at(to_location_id).write(to_planet);
            self.internal.init_planet_extras(to_location_id, to_planet);
            self.internal.index_touched_planet(to_location_id);
        } else {
            to_planet = self.internal.refresh_planet(to_location_id, to_planet, current_block);
        }
        if !is_spaceship_move {
            assert(!self.internal.is_planet_destroyed(to_location_id));
        }

        if moved_artifact_id != 0 {
            let to_artifacts = self.storage.planet_artifacts.at(to_location_id).read();
            assert(self.internal.planet_artifacts_has_space(to_artifacts));
        }

        let mut arrival_list = self.storage.planet_arrivals.at(to_location_id).read();
        let mut arrivals_from_owner: u8 = 0;
        let mut arrivals_from_others: u8 = 0;
        for i in 0..12 {
            let arrival_id = arrival_list.get(i);
            if arrival_id != 0 {
                let arrival = self.storage.arrivals.at(arrival_id as Field).read();
                if arrival.arrival_block() != 0 {
                    if arrival.player.eq(to_planet.owner) {
                        arrivals_from_owner += 1;
                    } else {
                        arrivals_from_others += 1;
                    }
                }
            }
        }

        if player.eq(to_planet.owner) {
            assert(arrivals_from_owner < MAX_ARRIVALS_PER_BUCKET);
        } else {
            assert(arrivals_from_others < MAX_ARRIVALS_PER_BUCKET);
        }

        let mut arrival_type = ARRIVAL_TYPE_NORMAL;
        let mut effective_dist_times_hundred = dist_max * 100;
        let mut effective_dist = dist_max;
        let mut temp_upgrade = self.internal.default_upgrade();
        let mut arrival_player = player;
        let mut remaining_origin_population = if from_planet.population > pop_moved {
            from_planet.population - pop_moved
        } else {
            0
        };

        if is_spaceship_move {
            arrival_player = AztecAddress::zero();
            from_planet =
                self.internal.apply_spaceship_depart(
                    moved_artifact,
                    from_location_id,
                    from_planet,
                    current_block
                );
        }

        let active_from = self.internal.get_active_artifact(from_location_id);
        let active_to = self.internal.get_active_artifact(to_location_id);
        let mut wormhole = Artifact::empty();
        if active_from.is_initialized
            & (active_from.artifact_type == ARTIFACT_TYPE_WORMHOLE)
            & (active_from.wormhole_to == to_location_id)
        {
            wormhole = active_from;
        } else if active_to.is_initialized
            & (active_to.artifact_type == ARTIFACT_TYPE_WORMHOLE)
            & (active_to.wormhole_to == from_location_id)
        {
            wormhole = active_to;
        }

        if wormhole.is_initialized {
            arrival_type = ARRIVAL_TYPE_WORMHOLE;
            let modifier = WORMHOLE_SPEED_MODIFIERS[wormhole.rarity as u32];
            effective_dist_times_hundred = effective_dist_times_hundred / modifier;
            effective_dist = effective_dist / modifier;
        }

        if !is_spaceship_move {
            if active_from.is_initialized
                & (active_from.artifact_type == ARTIFACT_TYPE_PHOTOID_CANNON)
            {
                if current_block >= active_from.last_activated {
                    let elapsed = current_block - active_from.last_activated;
                    if elapsed >= PHOTOID_ACTIVATION_DELAY_BLOCKS {
                        arrival_type = ARRIVAL_TYPE_PHOTOID;
                        temp_upgrade = self.internal.time_delay_upgrade(active_from);
                        from_planet =
                            self.internal.execute_deactivate_artifact(player, from_location_id);
                    }
                }
            }
        }

        let mut player_dirty = false;
        if (!is_spaceship_move) & abandoning {
            assert(!self.internal.planet_has_arrivals(from_location_id));
            assert(!from_planet.is_home_planet);

            pop_moved = from_planet.population;
            silver_moved = from_planet.silver;
            let default_planet = self.internal.default_planet_from_stats(
                AztecAddress::zero(),
                from_location_id,
                from_planet.perlin,
                from_planet.planet_level,
                from_planet.planet_type,
                from_planet.space_type,
                false,
                current_block,
            );
            remaining_origin_population = default_planet.population * 2;
            temp_upgrade = self.internal.abandoning_upgrade();

            let mut planet_space_junk = self.internal.planet_default_space_junk(from_planet);
            if self.internal.is_half_space_junk(from_location_id) {
                planet_space_junk /= 2;
            }
            if planet_space_junk >= player_space_junk {
                player_space_junk = 0;
            } else {
                player_space_junk -= planet_space_junk;
            }
            self.storage
                .planet_space_junk
                .at(from_location_id)
                .write(planet_space_junk);
            from_planet.owner = AztecAddress::zero();
            player_dirty = true;
        }

        if !is_spaceship_move {
            let to_space_junk = self.storage.planet_space_junk.at(to_location_id).read();
            if to_space_junk != 0 {
                assert(
                    (player_space_junk + to_space_junk)
                        <= player_space_junk_limit
                );
                player_space_junk += to_space_junk;
                self.storage.planet_space_junk.at(to_location_id).write(0);
                player_dirty = true;
            }
        }

        let move_planet = self.internal.buff_planet(from_planet, temp_upgrade);
        let pop_arriving = self.internal.decayed_population(
            pop_moved,
            effective_dist,
            move_planet.range,
            move_planet.population_cap,
        );
        if !is_spaceship_move {
            assert(pop_arriving > 0);
        }

        let time_factor = config.time_factor_hundredths;
        let time_factor_u = if time_factor == 0 { 1 } else { time_factor } as u128;
        let mut travel_time =
            (effective_dist_times_hundred as u128)
                * 100u128
                / ((move_planet.speed as u128) * time_factor_u);
        if travel_time == 0 {
            travel_time = 1;
        }

        let departure_block = current_block;
        let arrival_block_u64 = (departure_block as u64) + (travel_time as u64);
        let arrival_block = arrival_block_u64 as u32;
        let arrival_id = self.storage.next_arrival_id.read();
        let arrival_key = arrival_id as Field;

        let mut inserted = false;
        for i in 0..12 {
            if !inserted {
                if arrival_list.get(i) == 0 {
                    arrival_list = arrival_list.set(i, arrival_id);
                    inserted = true;
                }
            }
        }
        assert(inserted);
        self.storage.planet_arrivals.at(to_location_id).write(arrival_list);

        let arrival = Arrival::new(
            arrival_player,
            from_location_id,
            to_location_id,
            pop_arriving,
            silver_moved,
            departure_block,
            arrival_block,
            arrival_type,
            dist_max,
            moved_artifact_id,
        );
        self.storage.arrivals.at(arrival_key).write(arrival);
        self.storage.next_arrival_id.write(arrival_id + 1);

        if moved_artifact_id != 0 {
            let mut planet_artifacts = self.storage.planet_artifacts.at(from_location_id).read();
            assert(self.internal.planet_artifacts_contains(
                planet_artifacts,
                moved_artifact_id
            ));
            planet_artifacts =
                self.internal.planet_artifacts_remove(planet_artifacts, moved_artifact_id);
            self.storage.planet_artifacts.at(from_location_id).write(planet_artifacts);
            self.storage.artifact_locations.at(moved_artifact_id).write(0);
        }

        from_planet.population = remaining_origin_population;
        from_planet.silver = from_planet.silver - silver_moved;
        from_planet.last_updated = departure_block;
        self.storage.planets.at(from_location_id).write(from_planet);

        if player_dirty {
            self.storage.player_space_junk.at(player).write(player_space_junk);
        }
    }
    }

    #[external("private")]
    fn resolve_arrival(arrival_id: u64) {
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_move(
                AztecAddress::zero(),
                0,
                0,
                0,
                arrival_id as u128,
                0,
                0,
                0,
                false,
            )
        );
    }

    #[external("private")]
    fn resolve_planet_arrivals(location_id: Field) {
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_resolve_planet(location_id)
        );
    }

    #[external("public")]
    #[only_self]
    fn apply_resolve_planet(location_id: Field) {
        let current_block = self.context.block_number();
        self.internal.process_pending_arrivals(location_id, current_block);
    }

    #[internal("public")]
    fn execute_arrival(arrival_id: u64) {
        let arrival_key = arrival_id as Field;
        let arrival = self.storage.arrivals.at(arrival_key).read();
        assert(arrival.arrival_block() != 0);

        let current_block = self.context.block_number();
        assert(current_block >= arrival.arrival_block());

        let mut planet = self.storage.planets.at(arrival.to_planet).read();
        assert(planet.last_updated <= arrival.arrival_block());
        planet = self.internal.refresh_planet(
            arrival.to_planet,
            planet,
            arrival.arrival_block(),
        );
        assert(!self.internal.is_planet_destroyed(arrival.to_planet));
        let pausers = self.storage.planet_pausers.at(arrival.to_planet).read();

        let arrival_type = arrival.arrival_type();
        let wormhole_arrival = arrival_type == ARRIVAL_TYPE_WORMHOLE;
        if arrival.player.eq(planet.owner) {
            planet.population = planet.population + arrival.pop_arriving();
        } else if wormhole_arrival {
            // v0.6 parity: LibLazyUpdate.applyArrival skips energy transfer on wormhole arrivals
            // to planets not owned by the initiator (reference/darkforest-v0.6/eth/contracts/libraries/LibLazyUpdate.sol).
        } else {
            let damage = (arrival.pop_arriving() * 100) / planet.defense;
            if planet.population > damage {
                planet.population = planet.population - damage;
            } else {
                if !arrival.player.eq(AztecAddress::zero()) {
                    planet.owner = arrival.player;
                }
                let mut new_pop =
                    arrival.pop_arriving() - ((planet.population * planet.defense) / 100);
                if new_pop == 0 {
                    new_pop = 1;
                }
                planet.population = new_pop;
            }
        }

        if (planet.planet_type == PLANET_TYPE_SILVER_BANK) | (pausers > 0) {
            if planet.population > planet.population_cap {
                planet.population = planet.population_cap;
            }
        }

        let next_silver = planet.silver + arrival.silver_moved();
        if next_silver > planet.silver_cap {
            planet.silver = planet.silver_cap;
        } else {
            planet.silver = next_silver;
        }

        if arrival.carried_artifact_id != 0 {
            let mut planet_artifacts =
                self.storage.planet_artifacts.at(arrival.to_planet).read();
            assert(self.internal.planet_artifacts_has_space(planet_artifacts));
            planet_artifacts = self.internal.planet_artifacts_add(
                planet_artifacts,
                arrival.carried_artifact_id
            );
            self.storage.planet_artifacts.at(arrival.to_planet).write(planet_artifacts);

            let carried = self.internal.load_artifact_or_ship(arrival.carried_artifact_id);
            if carried.is_initialized & self.internal.is_spaceship(carried.artifact_type) {
                planet = self.internal.apply_spaceship_arrive(
                    carried,
                    arrival.to_planet,
                    planet
                );
            }
            self.storage
                .artifact_locations
                .at(arrival.carried_artifact_id)
                .write(arrival.to_planet);
        }

        planet.last_updated = arrival.arrival_block();
        self.storage.planets.at(arrival.to_planet).write(planet);

        let mut arrival_list = self.storage.planet_arrivals.at(arrival.to_planet).read();
        let mut removed = false;
        for i in 0..12 {
            if !removed {
                if arrival_list.get(i) == arrival_id {
                    arrival_list = arrival_list.set(i, 0);
                    removed = true;
                }
            }
        }
        self.storage.planet_arrivals.at(arrival.to_planet).write(arrival_list);
        self.storage.arrivals.at(arrival_key).write(Arrival::empty());
    }
}
