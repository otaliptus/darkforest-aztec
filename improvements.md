Skip to content

You said:
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
            traits::{Deserialize, ToField},
        },
        state_vars::{Map, PublicMutable},
    };
    use dep::darkforest_nft::NFT;
    use dep::std::field::bn254;
    use crate::{
        mimc::mimc_sponge_2_220,
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
    global MAX_PLANET_ARRIVALS: u8 = 12;
    global MAX_ARRIVALS_PER_BUCKET: u8 = 6;
    global MAX_PLANET_ARTIFACTS: u8 = 5;
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
    // Legacy alias kept for parity with earlier naming.
    global PLANET_TYPE_RUINS: u8 = 2;
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
        admin: PublicMutable<AztecAddress, Context>,
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
        admin: AztecAddress,
        config: GameConfig,
        nft_contract: AztecAddress,
    ) {
        self.storage.admin.write(admin);
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
        mimc_sponge_2_220(block_number as Field, 0, planethash_key)
    }

    #[internal("public")]
    fn artifact_seed(
        location_id: Field,
        contract_address: AztecAddress,
        block_hash: Field,
        planethash_key: Field,
    ) -> Field {
        let addr_field = contract_address.to_field();
        let seed1 = mimc_sponge_2_220(location_id, addr_field, planethash_key);
        mimc_sponge_2_220(seed1, block_hash, planethash_key)
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
        let seed = mimc_sponge_2_220(location_id, salt, planethash_key);
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
            if artifacts.ids[i] == 0 {
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
            if arrival_list.get(i) != 0 {
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
        expected_config_hash: Field,
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

        let location_id = mimc_sponge_2_220(x, y, planethash_key);
        assert(cfg_hash == expected_config_hash);
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
        let player_nullifier = mimc_sponge_2_220(player.to_field(), 1, planethash_key);
        self.context.push_nullifier(player_nullifier);

        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                player,
                location_id,
                x,
                y,
                perlin_u64,
                radius,
                cfg_hash,
                0,
            )
        );
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
        if (action >= 6) & (action <= 9) {
            let stored_admin = self.storage.admin.read();
            assert(player.eq(stored_admin));
        }
        if action == 0 {
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
        } else if action == 1 {
            let existing = self.storage.revealed.at(location_id).read();
            assert(existing.location_id == 0);

            let admin = self.storage.admin.read();
            if !player.eq(admin) {
                if config.location_reveal_cooldown > 0 {
                    let player_state = self.storage.players.at(player).read();
                    assert(
                        current_block - player_state.last_reveal_block
                            > config.location_reveal_cooldown
                    );
                }
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
        } else if action == 6 {
            let mut planet = self.storage.planets.at(location_id).read();
            planet.silver =
                if perlin > planet.silver_cap { planet.silver_cap } else { perlin };
            self.storage.planets.at(location_id).write(planet);
        } else if action == 7 {
            let owner = AztecAddress::deserialize([y]);
            let mut planet = self.storage.planets.at(location_id).read();
            planet.owner = owner;
            self.storage.planets.at(location_id).write(planet);
        } else if action == 8 {
            let mut planet = self.storage.planets.at(location_id).read();
            planet.planet_type = perlin as u8;
            planet.planet_level = radius as u8;
            self.storage.planets.at(location_id).write(planet);
        } else if action == 9 {
            let artifact_id = x;
            let owner = AztecAddress::deserialize([y]);
            let value0 = perlin;
            let value1 = radius;
            let value2 = config_hash as u64;

            let mut planet_artifacts = self.storage.planet_artifacts.at(location_id).read();
            planet_artifacts = self.internal.planet_artifacts_add(planet_artifacts, artifact_id);

            let artifact = Artifact::new(
                artifact_id,
                location_id,
                value1 as u8,
                value2 as u8,
                owner,
                value0 as u8,
            );

            self.storage.artifacts.at(artifact_id).write(artifact);
            self.storage.planet_artifacts.at(location_id).write(planet_artifacts);
            self.storage.artifact_locations.at(artifact_id).write(location_id);
            self.internal.nft_mint(owner, artifact_id);
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
        expected_config_hash: Field,
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

        let location_id = mimc_sponge_2_220(x, y, planethash_key);
        assert(cfg_hash == expected_config_hash);
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
    fn admin_set_planet_silver(location_id: Field, silver: u64) {
        let admin = self.context.msg_sender().unwrap();
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                admin,
                location_id,
                0,
                0,
                silver,
                0,
                0,
                6,
            )
        );
    }

    #[external("private")]
    fn admin_set_planet_owner(location_id: Field, owner: AztecAddress) {
        let admin = self.context.msg_sender().unwrap();
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                admin,
                location_id,
                0,
                owner.to_field(),
                0,
                0,
                0,
                7,
            )
        );
    }

    #[external("private")]
    fn admin_set_planet_type_and_level(
        location_id: Field,
        planet_type: u8,
        planet_level: u8,
    ) {
        let admin = self.context.msg_sender().unwrap();
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                admin,
                location_id,
                0,
                0,
                planet_type as u64,
                planet_level as u64,
                0,
                8,
            )
        );
    }

    #[external("private")]
    fn admin_create_artifact_on_planet(
        location_id: Field,
        artifact_id: Field,
        artifact_type: u8,
        rarity: u8,
        biome: u8,
        owner: AztecAddress,
    ) {
        let admin = self.context.msg_sender().unwrap();
        self.enqueue(
            DarkForest::at(self.context.this_address()).apply_player_action(
                admin,
                location_id,
                artifact_id,
                owner.to_field(),
                artifact_type as u64,
                rarity as u64,
                biome as Field,
                9,
            )
        );
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
        expected_config_hash: Field,
        max_location_id: Field,
    ) {
        let player = self.context.msg_sender().unwrap();
        let location_id = mimc_sponge_2_220(x, y, planethash_key);

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
        assert(cfg_hash == expected_config_hash);
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
        expected_config_hash: Field,
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

        let from_location_id = mimc_sponge_2_220(x1, y1, planethash_key);
        let to_location_id = mimc_sponge_2_220(x2, y2, planethash_key);
        assert(cfg_hash == expected_config_hash);
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
        let config = self.storage.config.read();
        let dist_max = (move_config >> 64) as u64;
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

Suggest optimizations to shorten zk proof generation times (noir) (darkforest)
ChatGPT said:

Thought for 25m 28s
Below are the optimizations I’d prioritize to reduce client-side proving time for your private Noir entrypoints (init_player, reveal_location, find_artifact, move) in this DarkForest Aztec port, plus a few changes that reduce overall circuit/rollup load. The two biggest levers are:
Stop recomputing Perlin in the common case (especially in move)
Stop doing “bit/byte-work” in constrained code when a cheaper “check” exists (use unconstrained hints correctly)
1) Biggest win: split move into “known target” vs “new target” to avoid Perlin most of the time
In your current move(...) (private), you always do:
bounds checks on (x2,y2)
perlin_u64 = multi_scale_perlin(x2,y2,...)
to_location_id = mimc_sponge_2_220(x2,y2,...)
Even though in apply_move (public) you only need perlin when to_planet is not initialized. Change the API to have two move paths:
A. move_known(to_location_id, ...) (private, fast)
Inputs: from_location_id, to_location_id, dist, resources, etc.
No x2,y2, no Perlin
Public apply_move is modified so:
If planets[to_location_id] is already initialized → ignore perlin
If it is not initialized → assert(perlin_provided == true) (or revert)
This means:
Most mid/late-game moves (between already-touched planets) generate much smaller proofs.
If a user tries move_known to an uninitialized target, the tx just reverts publicly. (That’s acceptable; you’re optimizing the “hot path”.)
This aligns with how ACIR works: private code compiles to a circuit with no control flow, loops unrolled, etc., so removing a whole Perlin computation is an immediate constraint and witness-gen reduction. 
2) Cache “procedural” planet facts once per location (pay Perlin once, reuse forever)
You already store planet.perlin when a planet is created via reveal_location/init_player (public side writes the planet struct). Do the same for any other procedural value you repeatedly re-prove.
Practical target: find_artifact’s biomebase Perlin
find_artifact privately recomputes:
computed_biomebase = multi_scale_perlin(x, y, biomebase_key, ...)
assert(computed_biomebase == biomebase);
If artifact discovery is frequent, that’s expensive. Optimization: compute and store biomebase at reveal-time (or first planet init) in a dedicated map:
planet_biomebase: Map<Field, PublicMutable<u64>>
reveal_location computes it once (yes, reveal proofs get heavier, but reveal is usually rarer than artifact attempts / repeated interactions)
find_artifact becomes: read stored biomebase and use it (or even skip passing it around)
Net effect: fewer Perlin evaluations across the lifecycle of a planet.
3) Use unconstrained functions as hints for “hard to compute, easy to verify” subproblems
Noir’s unconstrained functions let you compute values outside the circuit (Brillig), then add cheap constraints to ensure correctness. This can reduce backend gate counts even if ACIR opcode count rises. 
Where this helps in your codebase
Anything that currently does:
Field -> bits (to_le_bits, to_be_bytes)
manual modulus from bits (mod_255_from_bits)
truncations/casts that trigger range constraints repeatedly
“extract a byte / nibble from a Field” patterns
Example: replace mod_255_from_bits(bits, skip) with divmod constraints
Instead of looping 254 bits to compute seed % 255, do:
unconstrained fn divmod_255(seed: Field) -> (Field /*q*/, u8 /*r*/)
Then constrain:
assert(seed == q * 255 + r as Field);
And range-check r (u8 already implies 0..255; add assert(r != 255) if you require <255). This avoids a huge amount of bit-level constraint work, because you’re verifying a simple arithmetic identity rather than reconstructing the remainder bit-by-bit.
ACIR treats Brillig (unconstrained) as opcodes that don’t add constraints, while your constraints only enforce the relation you care about. 
Good candidates in your snippet:
random_artifact_type_and_level_bonus: the seed.to_le_bits() + 254-iteration modulus code (even if this runs publicly today, it still affects proving cost if it’s ever pulled into constrained contexts / kernels; and it’s just generally heavy).
Any “extract byte from location_id.to_be_bytes()” patterns where you only need a few bytes.
Consider: an unconstrained “byte decomposition” + recomposition constraint can be cheaper than built-in bit-decomp in some cases, depending on compiler/backend.
Safety rule: unconstrained work is only safe if you constrain the result in a way that prevents cheating.
4) Prefer Field for internal arithmetic in private circuits; use integers only at boundaries
Noir’s proving backends are field-native; using Field can reduce gates, while integer types (u64, u128, etc.) incur extra range constraints. 
Concrete changes that usually help
In private functions, keep intermediate values in Field where you don’t need bitwise semantics.
Minimize repeated u64/u128 casts and arithmetic in constrained code.
Avoid u128 unless you truly need 128-bit range guarantees.
In your init_player and reveal_location
You do:
field_abs_u128(x) / field_abs_u128(y)
squares in u128
But your coordinate bounds are ~2³¹, so:
x_abs^2 fits in <2⁶²
x_abs^2 + y_abs^2 fits in <2⁶³
So you can often do the whole circle check in u64 (or even u63-style bounds), and avoid 128-bit range baggage. If you must keep the inclusive bound (<= 2^31) and allow worst-case deltas (2^32), you may still need 128-bit for some move distance checks — but you can still reduce the number of 128-bit ops.
5) Be ruthless about Perlin cost: reduce octaves / precision, or change the world-gen PRF
multi_scale_perlin(...) is almost certainly your dominant private-circuit cost (and it’s called in multiple private entrypoints). Because ACIR unrolls loops and flattens control flow, Perlin complexity scales almost linearly with:
number of octaves
interpolation math
hashing / gradient selection inside the noise 
Options (from least to most invasive)
Reduce octaves (e.g., 5 → 3) and retune thresholds.
Reduce fixed-point precision (fewer fractional bits) if your gameplay tolerates it.
Use a cheaper noise function (hash-based value noise + smoothing) instead of true Perlin.
Make world-gen a committed PRF:
if you can redesign: derive “space type / level / type / biome” directly from a ZK-friendly hash of (x,y,key) without Perlin at all.
This often produces a much smaller circuit.
This is a game design tradeoff, but if your goal is proof-time, “hash-only terrain” is typically far cheaper than gradient noise.
6) Don’t assume a different hash is faster: benchmark your exact sponge vs Poseidon2
Noir supports multiple hash libraries (MiMC, Poseidon, etc.). 

ACIR also supports BlackBoxFuncCall opcodes for “efficient operations like hashing” when the backend has support. 
 However, in practice:
MiMC can be quite efficient in some proving systems (Aztec has discussed custom gates helping MiMC). 
The Noir zk_bench repo shows example circuits where MiMC has fewer constraints than Poseidon in Noir (for those benchmarks). 
So the right move is:
Benchmark these two for your codebase
mimc_sponge_2_220(x,y,key) (your exact function)
Poseidon2 compression/hash for 2-field input (if available in your stack)
Poseidon2 is implemented in Noir tooling/backends (there is a bn254 Poseidon2 solver implementation in the Noir repo), suggesting it can be treated as a supported primitive. 
 If Poseidon2 is a true backend blackbox in your environment, it may reduce constraints/witness time. If not, MiMC might stay best.
7) Precompute static tables to remove divisions & loops (mostly helps “public load”)
Even if this doesn’t affect client proving much, it helps total system performance and reduces any constrained-public costs. Examples in your snippet:
planet_type_from_location: thresholds are computed from constant weights every time (sum + divisions + loop).
Precompute the thresholds for each (space_type, level) offline and store as constants. Then selection is only comparisons.
Artifact type selection has dead/contradictory logic near the end:
... else {
    if biome == BIOME_ICE { ... } else if ... { ... }
    artifact_type = ARTIFACT_TYPE_PHOTOID_CANNON;
}
That final assignment overrides the biome-based selection and likely isn’t intended. Besides correctness, dead logic increases circuit/VM work.
Because ACIR unrolls loops and flattens predicates, even “small-looking” loops and boolean gating can accumulate. 
8) Optimize around “step cliffs”: shaving a bit can yield a lot
Barretenberg/Noir backends often increase proving work in power-of-two steps once circuit size crosses thresholds. The noir-benchmarks repo highlights this behavior and why staying under the next step boundary can drastically reduce time/memory. So: if your move circuit is near a boundary, cutting even a few thousand constraints can be disproportionately valuable.
9) Measure the right thing: constraints and witness-gen time
You want:
constraint count / backend circuit size (dominates proving)
execution/witness generation time (dominates “before proving” latency)
Useful tooling:
nargo info to inspect circuit size / ACIR opcodes 
nargo execute --profile-execution to profile execution hot spots (witness-gen) 
If you’re running this through Aztec, remember the PXE generates proofs client-side for private functions. 
A suggested “attack plan” for your repo
Run nargo info per private entrypoint and record backend sizes. 
Profile move witness-gen (nargo execute --profile-execution) and confirm Perlin dominates. 
Implement move_known (no Perlin) + public revert if target uninitialized.
Cache biomebase (or whatever else is Perlin-derived) on reveal/init if it’s reused.
Replace any heavy bit-decomposition modulus/byte extraction with unconstrained divmod/decompose + recomposition constraints. 
Re-run nargo info and check whether you crossed below a “step cliff”.
If you want, I can propose a concrete refactor sketch (function signatures + how to thread the “perlin required” flag through apply_move) tailored to your exact contract constraints—but the highest-impact changes are the “move-known fast path” and “cache procedural outputs once per location.”
You said:
llm_bundle.txt
Document
This is the repo :) 
ChatGPT said:

Thought for 28m 37s
Below are the highest‑leverage ways to cut client-side proving time for your DarkForest Aztec/Noir contract, based on what’s in the repo (notably multi_scale_perlin + MiMC + a lot of Field bit/compare work in private entrypoints). Your own perf notes show the pain clearly: init_player and move are both ~37s in one run, and the “first proof is insanely slow” case is attributed to CRS warm-up (1,033,415 ms) with later proofs ~16–26s.
1) First: make sure you’re not benchmarking avoidable overhead
Preload CRS (fixes the “first proof takes forever” trap)
Your docs already recommend preloading CRS: aztec preload-crs.
And your perf note explicitly calls out the first proof being dominated by CRS warm-up. This won’t change steady-state, but it dramatically changes “first interaction feels broken”.
2) Biggest circuit win in your repo: stop doing Field::to_le_bits() inside Perlin
Why this is huge
In perlin.nr, random_u4 does:
out = mimc_sponge_3_4(...)
bits: [u1; 254] = out.to_le_bits()
uses only bits[0..4) to build a 4-bit value
That means you pay for a 254-bit decomposition every time you want 4 bits. And Perlin calls this a lot (multiple corners × multiple octaves). Noir’s own docs emphasize that proving time scales with circuit/gate count
, and to_le_bits() is exactly the kind of thing that bloats gates
.
Replace it with a “low-bits decomposition” constraint (4 bits only)
Instead of decomposing all 254 bits, constrain:
out = 16*q + r, with r < 16
This gives you the low 4 bits with tiny constraints:
range-check r (u8 + < 16)
one linear relation
You can compute (q, r) in an unconstrained helper (witness-gen) and only constrain the relationship. Impact: This is usually one of the highest ROI optimizations in ZK circuits when you only need a few low bits from a field element.
3) Next biggest: reduce 254-bit comparisons for coordinates (field_to_signed / field_abs_u128)
Where the cost is coming from
Your field_to_signed decides negativity by comparing x against FIELD_MODULUS_HALF using bn254::gt. That implies a big-int style comparison (and typically bit decomposition). Then your private entrypoints call this repeatedly:
init_player: field_abs_u128(x), field_abs_u128(y)
llm_bundle

move: field_abs_u128(x1/y1/x2/y2) and field_to_signed again for distance (signed_sub(field_to_signed(x1), field_to_signed(x2)))
Optimization options (pick one)
Option A (best): accept coordinates as small signed ints in private entrypoints
You already enforce |x|,|y| <= 2^31 (MAX_COORD_ABS)
llm_bundle

, i.e. coordinates are tiny. So: change private ABI to accept i32 (or (sign_bit, u32)), and:
do abs / distance math in 32/64-bit land (much cheaper range constraints than 254-bit field comparisons)
only cast to Field when hashing (mimc_sponge_2_220(x as Field, y as Field, key))
This can remove a bunch of bn254::gt work entirely.
Option B (easy): compute field_to_signed(x1) once and reuse
In move, don’t do:
abs via field_abs_u128(x1) (which calls field_to_signed)
then later do field_to_signed(x1) again for distance
Compute sx1/sy1/sx2/sy2 once, and derive abs + diffs from those. This is a straightforward reduction in repeated expensive ops.
4) Cut expensive integer division/modulo patterns in Perlin
The pain points in your current Perlin implementation
Lots of signed_div_exact(...) calls in inner loops (scale + fixed denominators)
At the end, signed_modulo(scaled, DENOMINATOR) just to get a quotient, even though you don’t seem to use the remainder
signed_modulo itself does / and % and sign-fixes the remainder/quotient
Targeted improvements
A) If you only need the quotient, implement signed_div_floor_const (no remainder)
Right now you call:
let (_, quotient) = signed_modulo(scaled, DENOMINATOR);
If you don’t use the remainder, you’re paying extra constraints for it.
Implement a specialized “divide by constant with floor semantics” helper that only constrains:
scaled = denom * q + r
0 <= r < denom
…or even avoid r if you can reformulate the mapping to not need floor-with-negative handling.
B) Exploit power-of-two scale
You explicitly assert scale is a power of two and <= 16384. That’s a neon sign saying: stop doing generic division.
If you keep your math in binary-friendly fixed point, division by scale can be implemented as shifts / bit-slicing constraints.
Even if Noir still needs range checks, these are typically cheaper than generic /.
(If you want strict v0.6 parity, you’ll need to be careful here, but this is still a good candidate.)
5) Fix the “config_hash” pattern: you’re doing MiMC-220 in private proofs just to bind params
What’s happening now
init_player and move both compute:
cfg_hash = config_hash(...)
assert(cfg_hash == expected_config_hash)
llm_bundle

And config_hash uses mimc_sponge_2_220 internally. Your MiMC-220 is a full 220-round Feistel (loop 0..220)—that’s a lot of multiplications/constraints to spend just to ensure callers used the correct config knobs.
Better approach (same security goal, smaller private circuit)
Move config binding checks to public execution (no client proof cost):
Have the private method pass the raw config params it used (keys, scale, mirrors, world constants)
In apply_player_action / apply_move, compare them to self.storage.config and assert(...)
Public checks are cheap for the client prover; the sequencer does the work. This is especially compelling because your public apply_* functions already read self.storage.config in multiple places (e.g., apply_move reads it).
6) Consider “bigger levers” if you’re allowed to diverge from v0.6 world-gen
If your goal is “fast Aztec proving” more than “exact DarkForest v0.6 determinism”, the biggest wins are design-level:
A) Replace Perlin with ZK-friendly hash-noise
Your Perlin is expensive because it’s lots of arithmetic + divisions + gradient selection. A common ZK-friendly alternative:
Multi-octave noise = hash quantized coords at a few scales, mix results
Uses only SNARK-friendly hashes + a handful of adds/muls
Still gives spatial coherence (if you quantize / scale coords appropriately)
B) Replace MiMC-220 with a SNARK-optimized hash (Poseidon variants)
MiMC-220 is “okay”, but Poseidon-style permutations are typically chosen to reduce constraints in SNARKs. If Aztec/Noir gives you a well-optimized builtin, switching can be dramatic. This does change:
location IDs
artifact seeds
basically everything derived from those hashes
So it’s a “new world” choice.
7) Practical next step: get a constraint/gate breakdown per private entrypoint
Before/after each change, measure constraint count and proving time for:
init_player
move
reveal_location
find_artifact
Noir’s docs are blunt: gate count is the cost driver
. Given your code structure, I’d start by optimizing in this order:
Perlin random_u4: eliminate to_le_bits()
Reduce field_to_signed / abs repeated conversions
Remove config_hash() from private proofs
Then revisit divisions/modulo and gradient selection.
If you want, I can propose a concrete patch plan (function signatures + exactly where to move checks into apply_player_action / apply_move) while keeping gameplay semantics intact.

Sources
You said:
Suggest
ChatGPT said:
Reasoned for 31m 19s
According to a document from 2026-01-08, you’re seeing ~37s end-to-end for both init_player and move when proving is enabled, and the first proof after starting the node can be ~1,033s due to CRS warm-up (later proofs drop to ~16–26s).
llm_bundle


Here are the highest-impact things I’d change (in roughly “biggest win per effort” order) to shorten Noir proving time for this repo.

1) Fix the “first proof is insanely slow” dev experience
Your own docs already point at the culprit: CRS warm-up. Preloading it removes that “first proof after restart” cliff.

Run aztec preload-crs before benchmarking / local play sessions.
llm_bundle


Avoid restarting the node/prover between tests if you’re measuring improvements (otherwise you keep paying the warm-up tax).
llm_bundle


This won’t change steady-state 16–26s much, but it massively improves perceived performance and makes benchmark runs less noisy.

2) Stop proving config_hash (two 220-round MiMC sponges!) in every private call
Right now, config_hash(...) is extremely expensive: it calls mimc_sponge_2_220 twice.
llm_bundle


And mimc_feistel_220 itself is a 220-round permutation with a t^5-style round function—i.e., lots of field muls per call.
llm_bundle


You do this inside private entrypoints like init_player (and similarly in move, reveal_location, find_artifact), just to assert cfg_hash == expected_config_hash—even though for action 0/1 the public function doesn’t use config_hash at all.

Better pattern: read the config from storage in private, don’t hash it
Store game config as public state (ideally immutable), and read it in the private function. Then use the stored keys/params directly for perlin + MiMC.

Aztec supports reading PublicImmutable from private execution (it reads from historical state).
So you can change the storage type of your config from PublicMutable<GameConfig> to PublicImmutable<GameConfig> (or keep mutable only if you truly need runtime updates).

Also, if you use custom structs in storage, Aztec docs call out the needed traits (Serialize, Deserialize, Packable, Eq).
(Your GameConfig already looks like it’s designed for this.)

Why this helps proving time
You eliminate 2× mimc_sponge_2_220 per private call (today it’s inside config_hash).
llm_bundle


You also eliminate the need to pass a huge pile of config parameters into every private call (smaller witness & fewer checks).

Bonus: it fixes a correctness/security footgun
config_hash currently commits only to the perlin/hash keys and length/mirror flags
llm_bundle

—but your private ABI accepts many other config-ish values (world_radius, spawn_rim_area, init_perlin_min/max, max_location_id, etc.)
If the contract ever mattered adversarially, those are spoofable today. Reading config from storage removes that class of spoofing.

If you truly need config to be mutable
Use DelayedPublicMutable for values you need to read from private execution (Aztec explicitly recommends it for “read public values in private execution”, with delayed updates).

3) Split “move/reveal that might initialize a planet” into two circuits so most actions avoid perlin
move and reveal_location compute perlin even when it won’t be used (because the destination planet is already initialized, so the public function ignores the passed perlin).

In your public apply_move, perlin is only needed when to_planet is uninitialized; otherwise it’s unused. Same idea exists in apply_player_action for reveal.

How to get the win (without needing runtime branching)
Runtime if won’t skip constraints; you need separate entrypoints (separate circuits):

move_to_known_planet(...) private:

compute to_location_id (still needed),

do distance/pop constraints,

do not compute perlin,

enqueue apply_move(... perlin=0 ...).

move_to_new_planet(...) private:

same as today, includes perlin computation,

enqueue apply_move(... perlin=real ...).

Then in public apply_move, enforce:

if to_planet is uninitialized: assert(perlin != 0) and use it

else ignore perlin

This makes the “most common” gameplay action (moving between already-initialized planets) cheaper.

Same idea for reveals:

reveal_existing_location (no perlin)

reveal_and_init_location (with perlin)

4) Perlin: replace expensive exact division with bitshifts where valid
Your perlin code asserts scale is a power of two and ≤ 16384
llm_bundle

, and then single_scale_perlin does a lot of signed_div_exact(..., scale) calls.
llm_bundle


But signed_div_exact is implemented as a normal integer division plus an “exactness” assertion
llm_bundle

—which is typically much more expensive in-circuit than shifts when the divisor is 2^k.

So:

Add signed_div_pow2_exact(a, scale_shift) and use >> shift on magnitudes.

Store scale_shift (log2 of perlin_length_scale) in config so you don’t have to compute it in-circuit.

This can cut a meaningful chunk of constraints inside perlin without changing semantics.

5) Reduce expensive hashes where you don’t need MiMC-220 compatibility
Even if you must keep MiMC-220 for location IDs (to match Dark Forest’s mining/rarity scheme), you still have other hashes that are internal-only:

player_nullifier = mimc_sponge_2_220(player, 1, planethash_key) in init_player
This does not need to match DF v0.6. You could swap it to a cheaper built-in hash (Poseidon2 if available in your stack) or a simpler namespaced construction.

If your goal is pure proof speed, and you’re okay changing the universe:

Switch the location_id hash from MiMC-220 to Poseidon2 (typically far fewer constraints / better backend support).

This is the “biggest possible win”, but it breaks DF parity and mining expectations.

6) Measure what’s actually dominating: nargo info + noir-profiler
Before/after each change, you want to confirm you’re shrinking the right thing.

nargo info gives function-level info, and it has options like --print-acir for inspecting ACIR.

The Noir profiler can attribute cost to opcodes/gates (noir-profiler opcodes / noir-profiler gates) to pinpoint hotspots like your MiMC/perlin code.

Practical workflow:

profile init_player and move

confirm MiMC/config_hash dominates

implement “read config from storage” and remove config_hash

re-profile and see if perlin becomes #1

then do the perlin division/shift optimization

Quick “do this first” checklist
If you want the shortest path to noticeably better proving times:

Always preload CRS for fair benchmarks.
llm_bundle


Remove config_hash from private circuits by reading config via PublicImmutable in private execution.

Split move/reveal into “known planet” vs “new planet” entrypoints to avoid perlin on most moves.

Optimize perlin’s power-of-two divides (replace signed_div_exact by shifts).
llm_bundle


llm_bundle


Use noir-profiler to verify the wins.

If you want, I can sketch a concrete refactor plan for the contract ABI (new entrypoints + storage type changes) based on your current init_player/move/reveal/find_artifact signatures so it’s straightforward to implement without breaking the client more than necessary.


Sources
You said:
Please continue 
ChatGPT said:

Thought for 36m 45s
Continuing with more concrete ways to cut client-side proving time for the heavy private calls (especially init_player and move):
1) Don’t benchmark CRS cold-start: preload it first
Your own perf notes show the first init_player proof can take ~1033 seconds, while subsequent proofs are down in the tens of seconds. Your devnet docs explicitly recommend running:
aztec preload-crs
to make the first proof faster. The Aztec CLI docs describe this command as preloading the points data needed for proving/verifying. This doesn’t shrink the circuit, but it eliminates a huge fixed “startup tax” while you iterate.
2) Use bn254::assert_lt instead of assert(bn254::lt(...))
Right now you often do the “compute bool then assert it” pattern, e.g.:
init_player: assert(bn254::lt(location_id, max_location_id));
llm_bundle

move: assert(bn254::lt(to_location_id, max_location_id));
llm_bundle

Noir’s bn254 stdlib notes that assert_lt / assert_gt produce fewer constraints than assert(lt(...)) / assert(gt(...)). So change:
assert(bn254::lt(location_id, max_location_id));
to:
bn254::assert_lt(location_id, max_location_id);
Same semantics, smaller circuit.
3) Move “publicly checkable” assertions out of the private circuit
Some assertions in private are only guarding values that are already public call arguments you enqueue anyway. Examples:
In private move, you assert to_location_id < max_location_id
llm_bundle

.
In private init_player, you assert location_id < max_location_id
llm_bundle

.
But to_location_id and location_id end up in your public apply_move / apply_player_action calls. So you can enforce these bounds in the public-only functions instead and delete them from the private circuit. That reduces client proving work without revealing anything new (because the checked value is already public in the tx).
4) Delete a full MiMC-220 sponge from init_player by changing the per-player nullifier
In init_player, you currently do:
location_id = mimc_sponge_2_220(x, y, planethash_key)
player_nullifier = mimc_sponge_2_220(player.to_field(), 1, planethash_key)
push both nullifiers
llm_bundle

That second hash is expensive and is only there to make “init once per player”. You can get the same property with a cheap domain-separated nullifier that can’t collide with location nullifiers:
You already enforce location_id < max_location_id
llm_bundle

.
So set something like:
player_nullifier = max_location_id + 1 + player.to_field()
Now it’s guaranteed outside the [0, max_location_id) location range, with zero MiMC cost. This is often a big win because it removes a full mimc_sponge_2_220 from your hottest private path.
5) Don’t use MiMC-220 for config_hash (it’s just a parameter commitment)
Your config_hash helper does two mimc_sponge_2_220 calls (seed + final hash), and every heavy private action recomputes it and checks it matches expected_config_hash (e.g., in init_player and move)
llm_bundle


llm_bundle

. But config_hash isn’t part of worldgen—it’s only binding the user-supplied keys/flags to the deployed config. So you can switch it to a cheaper hash (Poseidon2/Pedersen—whatever is best supported in your current Noir/Aztec toolchain), update the stored expected hash + client calculation, and keep:
location IDs unchanged (still MiMC with planethash_key)
Perlin distribution unchanged (still using your Perlin code)
…and cut a lot of MiMC work out of every proof.
6) Reduce Field→signed conversions + u128 arithmetic in move
Private move does multiple conversions like field_abs_u128(x) and field_to_signed(x)
llm_bundle

. Those rely on BN254 comparisons against FIELD_MODULUS_HALF and then you do u128 squaring/summing for radius and distance checks
llm_bundle

. Because you already cap coordinates to 31 bits (MAX_COORD_ABS = 2^31) in private move
llm_bundle

, you can:
represent x/y as i64 (or convert once into a small signed int type after the bound check),
do abs/delta and distance² in u64/u128 with much cheaper range checks,
only cast to Field right before mimc_sponge_2_220(...) and multi_scale_perlin(...).
This tends to shrink the “range-check heavy” part of the circuit.
7) Perlin knobs (if you can tolerate worldgen drift)
A few places to look:
Perlin asserts scale is power-of-two and ≤ 16384 and runs 3 octaves (scale, scale*2, scale*4). Dropping one octave cuts Perlin work roughly ~⅓.
random_u4 does out.to_le_bits() just to take 4 bits. Bit-decomposition can be expensive. If parity isn’t required, consider changing gradient selection to a PRF that outputs a small index directly (so you avoid full field-to-bits).
8) Profile before/after so you only keep the wins
Noir’s profiler can generate an opcode flamegraph (e.g., noir-profiler opcodes ...) so you can see whether you’re dominated by range checks vs field arithmetic, and confirm each refactor actually reduces the hot opcodes.
If you want a “highest impact, least design change” bundle
preload CRS
replace assert(bn254::lt(...)) with bn254::assert_lt(...)
replace player_nullifier MiMC sponge with max_location_id + 1 + player.to_field()
replace config_hash away from MiMC-220
Those four typically give the biggest proving-time reduction without touching location hashing or the core Perlin worldgen.

Sources
You said:
Alright one more discussion item time - I've talked the following with someone smart:

# Chat Conversation

Note: _This is purely the output of the chat conversation and does not contain any raw data, codebase snippets, etc. used to generate the output._

### User Input

I feel like my implementation makes a lot of network requests. Analyze the reasons. Then, compare it with how OG Aztec game handles it.

### Planner Response

I'll analyze the network request patterns in your implementation and compare them with the original Aztec game. Let me explore the codebase to understand the architecture.

*Listed directory [darkforest-aztec](file:///Users/talip/Desktop/darkforest-aztec) *

*Viewed [032-og-ui-integration.md](file:///Users/talip/Desktop/darkforest-aztec/tasks/032-og-ui-integration.md) *

*Listed directory [apps](file:///Users/talip/Desktop/darkforest-aztec/apps) *

*Listed directory [packages](file:///Users/talip/Desktop/darkforest-aztec/packages) *

*Listed directory [reference](file:///Users/talip/Desktop/darkforest-aztec/reference) *

*Listed directory [client-og](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og) *

*Listed directory [df-network](file:///Users/talip/Desktop/darkforest-aztec/packages/df-network) *

*Listed directory [src](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src) *

*Listed directory [src](file:///Users/talip/Desktop/darkforest-aztec/packages/df-network/src) *

*Listed directory [darkforest-v0.6](file:///Users/talip/Desktop/darkforest-aztec/reference/darkforest-v0.6) *

### Planner Response

Let me explore the core client implementation and the GameUIManager to understand the network request patterns:

*Listed directory [Frontend](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/Frontend) *

*Searched filesystem*

*Searched filesystem*

*Listed directory [scripts](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts) *

*Grep searched codebase*

*Analyzed [darkforest.ts](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts/darkforest.ts) *

*Analyzed [chain.ts](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts/chain.ts) *

### Planner Response

Let me look at the core chain data fetching and storage logic:

*Viewed [chain.ts](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts/chain.ts) *

*Viewed [storage.ts](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts/storage.ts) *

### Planner Response

Now let me look at how the UI fetches data, specifically the Game components and adaptation:

*Listed directory [Game](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/Frontend/Game) *

*Grep searched codebase*

*Grep searched codebase*

### Planner Response

Let me now look at where the data is fetched and used in the UI, and then compare with the original Dark Forest v0.6 implementation:

*Searched filesystem*

*Searched filesystem*

*Analyzed [ContractsAPI.ts](file:///Users/talip/Desktop/darkforest-aztec/reference/darkforest-v0.6/client/src/Backend/GameLogic/ContractsAPI.ts) *

*Analyzed [GameObjects.ts](file:///Users/talip/Desktop/darkforest-aztec/reference/darkforest-v0.6/client/src/Backend/GameLogic/GameObjects.ts) *

### Planner Response

Let me look at the key data loading functions in the OG implementation:

*Grep searched codebase*

*Viewed [ContractsAPI.ts](file:///Users/talip/Desktop/darkforest-aztec/reference/darkforest-v0.6/client/src/Backend/GameLogic/ContractsAPI.ts) *

### Planner Response

Now let me look at the network package for `aggregateBulkGetter`:

*Viewed [Network.ts](file:///Users/talip/Desktop/darkforest-aztec/reference/darkforest-v0.6/packages/network/src/Network.ts) *

### Planner Response

Now let me look at how your client currently polls for data to complete the comparison:

*Grep searched codebase*

*Grep searched codebase*

*Grep searched codebase*

### Planner Response

Let me now look at how individual planet data is fetched in the adapter layer:

*Grep searched codebase*

*Searched filesystem*

### Planner Response

Let me look at the GameUIManagerAdapter to understand how data flows:

*Searched filesystem*

*Searched filesystem*

*Grep searched codebase*

### Planner Response

Now I have gathered enough information to provide a detailed analysis. Let me create a comprehensive analysis document for the user.

*Edited relevant file*

### User Input

What are your suggestions - I also believe there are stuff caused by lack of Aztec's skills compared to Eth as well. Do some research and tell me.

### Planner Response

Let me research Aztec's specific limitations compared to Ethereum that contribute to this issue.

*Searched web for Aztec Network batch read storage slots getPublicStorageAt multiple fields*

*Searched web for Aztec Network event subscription logs WebSocket RPC limitations*

*Searched web for Aztec unconstrained functions batch read public storage noir contract*

*Searched web for Aztec Network RPC API getPublicStorageAt batch read multiple slots single call*

*Searched web for Aztec Network "getLogs" events L2 blocks query historical*

### Planner Response

Let me also check the Aztec documentation and your codebase for more context:

*Searched web for Aztec Network vs Ethereum eth_call view function Solidity return struct*

*Grep searched codebase*

### Planner Response

Let me look at the main contract to see if there are any existing unconstrained query functions:

*Searched filesystem*

*Analyzed [main.nr](file:///Users/talip/Desktop/darkforest-aztec/packages/contracts/src/main.nr) *

### Planner Response

Now I have a complete picture. Let me update the analysis document with Aztec-specific limitations and provide actionable suggestions:

*Edited relevant file*

### User Input

a) cache fixes for active games but for restarts in browser it might be painful
b) What would happen to zk proving or constraints or fields stuff once we introduce bulk fetching to noir contract
c) Would poll really work? even when proving enabled?
d) How would getPublicStorageAt work?

### Planner Response

Great questions! Let me address each one:

## a) Cache & Browser Restarts

You're right - in-memory cache disappears on page refresh. Here's how OG Dark Forest handles this:
typescript
// OG uses IndexedDB + ChunkStore to persist:
// 1. Explored chunks (the critical persistent data)
// 2. Known planet locations

// But planet STATE is re-fetched on load via:
await contractsAPI.bulkGetPlanets(touchedPlanetIds);  // One call for all known planets
**For Aztec**, the solution is similar:
- **Persist to IndexedDB**: Planet IDs you've discovered, chunk coordinates
- **On startup**: Bulk fetch current state for those IDs
- **During gameplay**: In-memory cache only

The problem isn't cache invalidation - it's that your startup bulk fetch is slow (39 calls × N planets). With unconstrained bulk getters, startup becomes fast again.

---

## b) ZK Proving with Bulk Unconstrained Functions

**Short answer**: Nothing changes for ZK proofs because unconstrained functions are **not proved**.
noir
// This IS proved (ZK circuit):
#[external("public")]
fn move(from: Field, to: Field, ...) {
    // All logic here becomes ZK constraints
}

// This is NOT proved (just runs on node):
#[aztec(query)]
unconstrained fn bulk_get_planets(ids: [Field; 10]) -> [Planet; 10] {
    // No ZK constraints generated
    // Just reads storage and returns data
}
**Why this is safe**:
- Unconstrained functions can only **read** storage
- They cannot modify state
- They're called via RPC like Ethereum's `eth_call`
- The data they return is public anyway (from public storage)

**The tradeoff**: If you needed **proven** reads (e.g., "prove I saw this planet state"), you couldn't use unconstrained. But for UI display, unproven reads are fine.

---

## c) Block Polling with Proving Enabled

**Yes, polling will work**, but with caveats:

Timeline:
  Block N:   You poll, fetch planet states
  Block N+1: Someone sends a move tx (proving happens)
  Block N+2: Move proof is verified, state changes
  Block N+3: You poll again, see updated state
**How it works**:
1. Transactions (moves, upgrades) require ZK proofs
2. Proofs are submitted to the network
3. When a block is produced, it includes verified txs
4. Polling `aztecNode.getBlock()` gives you the block header
5. Events in that block tell you what changed

**The lag**: 
- Proving takes time (seconds to minutes depending on circuit)
- You poll block N, but the tx from block N-2 just finished proving
- This is unavoidable in any ZK system

**Practical approach**:
typescript
// Poll every new block
const lastBlock = await node.getBlockNumber();
if (lastBlock > cachedBlockNumber) {
    const block = await node.getBlock(lastBlock);
    // Parse events, update only changed entities
}
---

## d) How `getPublicStorageAt` Works

It's the Aztec equivalent of Ethereum's `eth_getStorageAt`:
typescript
// Your current code (storage.ts):
const value = await node.getPublicStorageAt(
    "latest",           // Block tag
    contractAddress,    // Which contract
    new Fr(slot)        // Which storage slot
);
**Under the hood**:
1. Aztec node maintains a **public data tree** (Merkle tree of all public storage)
2. The slot you request is hashed: `siloed_slot = hash(contractAddress, slot)`
3. Node does a tree lookup for that siloed slot
4. Returns the value as a [Fr](cci:1://file:///Users/talip/Desktop/darkforest-aztec/reference/darkforest-v0.6/client/src/Backend/GameLogic/GameObjects.ts:459:2-535:3) (field element)

**Why it's expensive**:

Your planet struct = 20 fields
Each field = separate slot in the tree
Reading planet = 20 tree lookups + 20 network round-trips
**JSON-RPC Batching Possibility**:
javascript
// Instead of:
await Promise.all([
    node.getPublicStorageAt("latest", addr, slot1),
    node.getPublicStorageAt("latest", addr, slot2),
    // ... 18 more
]);

// You could batch at HTTP level:
const batchRequest = [
    { jsonrpc: "2.0", method: "aztec_getPublicStorageAt", params: [...], id: 1 },
    { jsonrpc: "2.0", method: "aztec_getPublicStorageAt", params: [...], id: 2 },
    // ... 18 more
];
const responses = await fetch(rpcUrl, { body: JSON.stringify(batchRequest) });
This sends 20 calls in **1 HTTP request** instead of 20 HTTP requests. Still 20 tree lookups server-side, but eliminates network latency multiplication.

---

## Summary Table

| Concern | Reality | Solution |
|---------|---------|----------|
| Cache on restart | Need to refetch state | IndexedDB for IDs + fast bulk fetch |
| Bulk in Noir + ZK | No impact (unconstrained ≠ proved) | Safe for reads |
| Polling + proving | Works, has inherent latency | Poll blocks, parse events |
| `getPublicStorageAt` | 1 slot = 1 tree lookup | JSON-RPC batch or unconstrained bulk |

Would you like me to prototype any of these solutions?

### User Input

I don't understand how og-game was working. Could you explain? 

### Planner Response

Let me walk you through how the OG Dark Forest architecture worked. It's actually quite elegant:

## OG Dark Forest Data Flow Architecture

┌─────────────────────────────────────────────────────────────────────────┐
│                              STARTUP PHASE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. Load from IndexedDB (instant, local)                               │
│      └── Explored chunks, planet IDs you've discovered                  │
│                                                                          │
│   2. Bulk fetch from contract (1-2 RPC calls)                           │
│      └── bulkGetPlanetsByIds([all known IDs]) → 200 planets per call   │
│      └── bulkGetArtifacts([...])                                        │
│                                                                          │
│   3. Build GameObjects (in-memory cache)                                │
│      └── planets: Map<LocationId, Planet>                               │
│      └── artifacts: Map<ArtifactId, Artifact>                          │
│      └── arrivals: Map<VoyageId, Arrival>                              │
│                                                                          │
│   4. Subscribe to contract events (WebSocket)                           │
│      └── contract.on("ArrivalQueued", handler)                         │
│      └── contract.on("PlanetUpgraded", handler)                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            GAMEPLAY PHASE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   UI Component wants planet data:                                        │
│   ┌─────────────────┐    ┌──────────────────┐                           │
│   │ PlanetPane.tsx  │───▶│ GameObjects      │──▶ Instant!               │
│   │ "show planet X" │    │ .getPlanet(X)    │   (from memory)           │
│   └─────────────────┘    └──────────────────┘                           │
│                                                                          │
│   NO NETWORK REQUEST! Just a Map.get()                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EVENT-DRIVEN UPDATES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Ethereum emits event: "ArrivalQueued" (planetId: 0x123)               │
│                     │                                                    │
│                     ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ ContractsAPI.setupEventListeners()                              │   │
│   │                                                                  │   │
│   │   contract.on("ArrivalQueued", (planetId) => {                  │   │
│   │       // Only fetch the ONE planet that changed                 │   │
│   │       const planet = await contract.getPlanetById(planetId);    │   │
│   │       gameObjects.updatePlanet(planetId, planet);               │   │
│   │       emit("PlanetUpdate", planetId);  // Tell UI to re-render  │   │
│   │   });                                                            │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Result: 1 planet updated, 1 network request, UI updates instantly    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
## The Key Components

### 1. **GameObjects Class** (The Cache)
typescript
// This class holds ALL game state in memory
class GameObjects {
    private planets: Map<LocationId, Planet> = new Map();
    private artifacts: Map<ArtifactId, Artifact> = new Map();
    private arrivals: Map<VoyageId, Arrival> = new Map();
    
    // UI calls this - instant, no network
    getPlanetWithId(id: LocationId): Planet | undefined {
        return this.planets.get(id);
    }
    
    // Called when contract event fires
    replacePlanetFromContractData(planet: Planet) {
        this.planets.set(planet.locationId, planet);
        this.emit$('planetUpdated', planet.locationId);
    }
}
### 2. **Bulk Getters** (Startup Speed)

The Solidity contract has special functions:
solidity
// Instead of fetching 1 planet at a time...
function getPlanetById(uint256 id) external view returns (Planet memory);

// ...there's a bulk version that returns 200 at once
function bulkGetPlanetsByIds(uint256[] calldata ids) 
    external view returns (Planet[] memory) 
{
    Planet[] memory result = new Planet[](ids.length);
    for (uint i = 0; i < ids.length; i++) {
        result[i] = planets[ids[i]];
    }
    return result;  // ONE eth_call, 200 planets returned
}
### 3. **Event Subscriptions** (Real-time Updates)
typescript
// WebSocket connection to Ethereum node
contract.on("ArrivalQueued", (playerId, arrivalId, fromPlanet, toPlanet) => {
    // Someone sent a move! Only refetch the 2 affected planets
    const from = await contract.getPlanetById(fromPlanet);
    const to = await contract.getPlanetById(toPlanet);
    
    gameObjects.updatePlanet(fromPlanet, from);
    gameObjects.updatePlanet(toPlanet, to);
});

contract.on("PlanetUpgraded", (playerId, planetId) => {
    // Only refetch the 1 upgraded planet
    const planet = await contract.getPlanetById(planetId);
    gameObjects.updatePlanet(planetId, planet);
});
## Your Aztec Implementation vs OG

| Step | OG Dark Forest | Your Aztec Client |
|------|---------------|-------------------|
| **Startup** | [bulkGetPlanets(ids[])](cci:1://file:///Users/talip/Desktop/darkforest-aztec/reference/darkforest-v0.6/client/src/Backend/GameLogic/ContractsAPI.ts:762:2-786:3) → 1 call | Loop through IDs → N × 39 calls |
| **Get planet for UI** | `gameObjects.get(id)` → 0 calls | [readLocationBundle(id)](cci:1://file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts/chain.ts:368:0-394:2) → 39 calls |
| **Someone moved** | Event fires → 2 calls | Poll interval → refetch everything |
| **Cache** | GameObjects Map | None (always hit network) |

## Visual Timeline

OG Dark Forest:
═══════════════════════════════════════════════════════════════════════════
t=0     STARTUP: Load 500 planets (3 bulk calls)
t=1s    Done! UI is responsive
t=5s    Player clicks planet → instant (from cache)
t=10s   EVENT: "ArrivalQueued" → fetch 2 planets
t=15s   Player clicks another planet → instant
═══════════════════════════════════════════════════════════════════════════
        Total calls in 15s: ~5-10

Your Aztec Client:
═══════════════════════════════════════════════════════════════════════════
t=0     STARTUP: Fetch player state
t=1s    Player clicks planet → 39 calls to read it
t=5s    PlanetDex opens → 39 calls × 10 planets = 390 calls  
t=10s   Poll interval → refetch everything (hundreds of calls)
t=15s   Player clicks another planet → 39 more calls
═══════════════════════════════════════════════════════════════════════════
        Total calls in 15s: ~500-1000+
## The Philosophy

OG Dark Forest treats the blockchain as a **source of truth that you sync from**, not a **database you query on every render**:

1. **Sync once at startup** (bulk)
2. **Keep local copy** (GameObjects)
3. **Listen for changes** (events)
4. **Update incrementally** (only what changed)

Your client currently treats the blockchain as a traditional API - fetch on every access, no local state.

Does this help clarify the architecture difference?

### User Input

No I mean as a whole, how was OG game working

### Planner Response

Ah, you want the full picture! Let me explain how OG Dark Forest worked as a complete system:

## What Is Dark Forest?

Dark Forest is an **MMO space conquest game** built entirely on Ethereum. You explore an infinite procedural universe, discover planets, and fight other players for territory. The twist: **the fog of war is cryptographic** - you can only see what you've personally explored, and no one can see your planets unless they've explored that region too.

## The Universe

┌──────────────────────────────────────────────────────────────────────────┐
│                        INFINITE PROCEDURAL GALAXY                         │
│                                                                           │
│    The universe is a 2D coordinate space with planets at certain (x,y)   │
│                                                                           │
│         ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·            │
│         ·  ·  ·  ·  ·  🪐 ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·            │
│         ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  🌍 ·  ·  ·  ·  ·  ·            │
│         ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·            │
│         ·  ·  ·  ⭐ ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·            │
│         ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·            │
│                                                                           │
│    A location has a planet if: hash(x, y) < threshold                    │
│    (Perlin noise determines space type, biome, planet level, etc.)       │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
**Key insight**: The universe exists mathematically. Nobody "creates" planets - they exist if their coordinate hash meets certain criteria. Anyone doing the same hash will discover the same planet.

## The Privacy Model (ZK-SNARKs)

This is what made Dark Forest revolutionary:

┌─────────────────────────────────────────────────────────────────────────┐
│                         FOG OF WAR VIA CRYPTOGRAPHY                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   The CONTRACT only stores:                                              │
│   - Planet states (population, owner) indexed by HASH(x,y)              │
│   - NOT the actual coordinates (x, y)                                   │
│                                                                          │
│   When you MOVE between planets:                                         │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │  You prove: "I know coordinates (x1,y1) and (x2,y2) such that: │    │
│   │    - hash(x1,y1) = fromPlanetId                                │    │
│   │    - hash(x2,y2) = toPlanetId                                  │    │
│   │    - distance(x1,y1,x2,y2) <= planet's range                  │    │
│   │                                                                 │    │
│   │  WITHOUT revealing x1, y1, x2, y2 to anyone!"                  │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│   Result: Contract verifies the move is valid, but no one learns        │
│   WHERE your planets actually are in the coordinate space.              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
## Client-Side Exploration ("Mining")

┌─────────────────────────────────────────────────────────────────────────┐
│                            EXPLORING THE GALAXY                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Your browser runs a "miner" that checks coordinates:                  │
│                                                                          │
│   for x in range(-10000, 10000):                                        │
│       for y in range(-10000, 10000):                                    │
│           hash = mimc_hash(x, y)                                        │
│           if hash < threshold:                                          │
│               # Found a planet! Store it locally                         │
│               localDB.savePlanet(x, y, hash)                            │
│                                                                          │
│   This runs in WebWorkers, exploring chunks of 16x16 coordinates.       │
│   The more you explore, the more of the galaxy you can see.             │
│                                                                          │
│   ⚠️ ONLY YOU know the planets you've found!                            │
│   Other players have explored different regions.                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
## Game Mechanics

### Planets

┌─────────────────────────────────────────────────────────────────────────┐
│   PLANET TYPES                                                           │
│                                                                          │
│   🌍 Planet       - Standard, produces population (energy)              │
│   ⭐ Asteroid     - Produces silver (currency for upgrades)             │
│   🌑 Foundry      - Has artifacts buried, can mine them                 │
│   ⬛ Spacetime Rip - Trade post for depositing/withdrawing artifacts    │
│   🚀 Quasar       - Can project energy to distant planets               │
│                                                                          │
│   PLANET LEVELS (0-9)                                                    │
│   Higher level = more population cap, range, speed, defense             │
│   Rarer to find higher level planets                                    │
│                                                                          │
│   SPACE TYPES                                                            │
│   - Nebula (safe): 100% defense                                         │
│   - Space (normal): 50% defense                                         │
│   - Deep Space (dangerous): 25% defense                                 │
│   - Dead Space (deadly): 5% defense                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
### Combat & Movement

┌─────────────────────────────────────────────────────────────────────────┐
│                              MOVING ENERGY                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│         Planet A                              Planet B                   │
│         (you own)              voyage         (enemy owns)               │
│            🌍 ─────────────────────────────────▶ 🌍                     │
│        pop: 1000              ~~~>            pop: 500                  │
│                                                                          │
│   You send 800 population from A to B:                                  │
│   1. Prove you know coordinates (ZK proof)                              │
│   2. Contract deducts 800 from A                                        │
│   3. Arrival scheduled based on distance × speed                        │
│   4. When arrival lands: 800 vs 500 × defense                          │
│   5. If attacker wins: you capture the planet                          │
│                                                                          │
│   Population decays during travel (longer distance = more decay)        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
### Artifacts

┌─────────────────────────────────────────────────────────────────────────┐
│                               ARTIFACTS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Found by prospecting Foundry planets:                                 │
│   1. Prospect (starts a timer)                                          │
│   2. Find Artifact (after timer, proves you found it)                   │
│                                                                          │
│   TYPES:                                                                 │
│   - Wormhole: Teleport energy to a linked planet                        │
│   - Photoid Cannon: Doubles attack when activated                       │
│   - Bloom Filter: Doubles planet population cap                         │
│   - Black Domain: Destroys a planet entirely                            │
│   - Spaceships: Mobile units that can carry artifacts                   │
│                                                                          │
│   Artifacts are NFTs - can be withdrawn to your wallet and traded       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
## The Complete Flow

┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE GAME FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. SPAWN                                                               │
│      - Browser mines to find a valid home planet                        │
│      - Submit init proof: "I know coords (x,y) for planetId"            │
│      - Contract marks planet as yours                                   │
│                                                                          │
│   2. EXPLORE                                                             │
│      - WebWorkers hash coordinates in the background                    │
│      - Discovered planets saved to IndexedDB                            │
│      - Canvas renders your explored region                              │
│                                                                          │
│   3. EXPAND                                                              │
│      - Select planet A, click planet B                                  │
│      - Generate ZK proof of valid move (takes 10-60 seconds)            │
│      - Submit tx with proof                                             │
│      - Wait for arrival time                                            │
│      - Contract resolves combat                                         │
│                                                                          │
│   4. UPGRADE                                                             │
│      - Spend silver to upgrade range/speed/defense                      │
│      - Higher range = can attack further planets                        │
│                                                                          │
│   5. COMPETE                                                             │
│      - Leaderboard tracks players by score                              │
│      - Score = sum of planet levels you own                             │
│      - Rounds last ~2 weeks, prizes for top players                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
## The Tech Stack

┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   CLIENT (Browser)                                                       │
│   ├── React UI                                                           │
│   ├── WebGL Canvas Renderer (galaxy, planets, voyages)                  │
│   ├── WASM ZK Prover (snarkjs compiled to WASM)                         │
│   ├── WebWorker Mining (coordinate hashing)                             │
│   ├── IndexedDB (chunk storage, persistence)                            │
│   └── GameObjects (in-memory state cache)                               │
│                                                                          │
│   BLOCKCHAIN (Ethereum/xDai)                                             │
│   ├── Diamond Contract (upgradeable)                                    │
│   │   ├── Core.sol (init, move, upgrade)                                │
│   │   ├── Verifier.sol (ZK proof verification)                          │
│   │   └── NFT.sol (artifact tokens)                                     │
│   └── Events (ArrivalQueued, PlanetUpgraded, etc.)                      │
│                                                                          │
│   CIRCUITS (Circom → snarkjs)                                            │
│   ├── init.circom (prove valid spawn location)                          │
│   ├── move.circom (prove valid move between planets)                    │
│   ├── reveal.circom (prove coordinates for a planet)                    │
│   └── biome.circom (prove planet's biome for artifacts)                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
## Why It Matters

Dark Forest was the first fully on-chain game with:
- **Incomplete information** (fog of war)
- **Cryptographic privacy** (ZK proofs)
- **Persistent world** (anyone can join anytime)
- **Real stakes** (NFT artifacts, prize pools)

It proved that complex strategy games could exist entirely on blockchain without servers.

---

Does this give you a better understanding of the overall game? Want me to dive deeper into any specific part?

### User Input

Wait my game also works like this at the moment?

### Planner Response

Yes! Your Aztec implementation follows the same **game mechanics** - that's the whole point of the port. Let me quickly verify what you have:

*Grep searched codebase*

*Grep searched codebase*

*Searched filesystem*

*Analyzed [hashing.ts](file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts/hashing.ts) *

*Grep searched codebase*

### Planner Response

Yes! Your game works exactly like OG Dark Forest. Let me confirm what you have:

## ✅ What Your Aztec Game Already Does (Same as OG)

| Feature | OG Dark Forest | Your Aztec Port |
|---------|---------------|-----------------|
| **MiMC hashing** | Circom circuits | ✅ [hashing.ts](cci:7://file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/scripts/hashing.ts:0:0-0:0) - JS implementation |
| **Coordinate exploration** | WebWorkers mine coords | ✅ [minimap.worker.ts](cci:7://file:///Users/talip/Desktop/darkforest-aztec/apps/client-og/src/Frontend/Panes/Lobbies/minimap.worker.ts:0:0-0:0) + explore UI |
| **ZK proofs for moves** | snarkjs (Circom) | ✅ Noir circuits (init, move, reveal, find) |
| **Planet discovery** | `hash(x,y) < threshold` | ✅ Same algorithm |
| **Combat & arrivals** | Contract logic | ✅ [main.nr](cci:7://file:///Users/talip/Desktop/darkforest-aztec/packages/contracts/src/main.nr:0:0-0:0) handles it |
| **Artifacts** | Prospect → Find → Activate | ✅ Full artifact system |
| **Spaceships** | Mobile units | ✅ Implemented |
| **Canvas renderer** | WebGL galaxy view | ✅ Full OG renderer ported |

## The Core Game Is Identical

Your game flow:
1. Connect wallet (Aztec instead of Ethereum)
2. Browser mines coordinates to find planets
3. Prove you found a valid home → init_player()
4. Explore more of the galaxy (client-side mining)
5. Send moves with ZK proofs → move()
6. Upgrade, prospect, find artifacts, trade
## What's Different (Only the Network Layer)

The **game mechanics** are the same. The **data fetching pattern** is what differs:

OG Dark Forest:
┌────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   UI renders   │────▶│   GameObjects   │────▶│  (from RAM)  │
│   planet info  │     │   cache lookup  │     │   instant!   │
└────────────────┘     └─────────────────┘     └──────────────┘

Your Aztec version:
┌────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   UI renders   │────▶│ readLocation()  │────▶│  39 RPC calls│
│   planet info  │     │ (network fetch) │     │   slow...    │
└────────────────┘     └─────────────────┘     └──────────────┘
## Summary

**Your game works!** It's a complete, faithful port of Dark Forest to Aztec. The core gameplay, ZK proofs, exploration, combat, artifacts - all working.

The network request issue we discussed is an **optimization problem**, not a functionality problem. Your game is correct, just slower than it could be because:
1. No client-side cache (GameObjects)
2. No bulk contract reads
3. Polling instead of event subscriptions

But yes - you built Dark Forest on Aztec! 🎮


what do you think about this conversation? Do you agree with these points? How I can improve this too many network requests situation, without killing the game perf + zk proving perf?
ChatGPT said:

Thought for 32m 45s
I agree with the core diagnosis in that conversation (and your repo backs up the “why” pretty concretely), but there are a few important corrections / missing nuances that matter for choosing the right fix.
What I agree with
1) “39 RPC calls per planet” is basically real in your current read path
In your Aztec client, a single readLocationBundle() fans out into multiple reads: planet state, artifacts, coords, destroyed, space junk, arrivals, etc. It does this via a Promise.all(...) of those sub-reads. 
llm_bundle

 Those sub-reads have fixed field-counts:
readPlanetState(..., 20)
llm_bundle

readPlanetArtifacts(..., 5)
llm_bundle

readPlanetArtifactState(..., 2)
llm_bundle

readRevealedCoords(..., 4)
llm_bundle

readPlanetDestroyed(...) (single map field)
llm_bundle

readPlanetSpaceJunk(...) (single map field)
llm_bundle

readPlanetArrivals(..., 6)
llm_bundle

That’s 20 + 5 + 2 + 4 + 1 + 1 + 6 = 39 public-storage slot reads per “location bundle”. And those “field reads” are not “batch reads”: your helper reads each slot independently. readPublicFields literally does a Promise.all(slots.map(readPublicField))
llm_bundle

, and readPublicField calls node.getPublicStorageAt("latest", ...) for each slot
llm_bundle

. So the “too many network requests” feeling is not just subjective — it’s a direct consequence of the current storage-read primitive you’re using.
2) The “OG Dark Forest” contrast is directionally right
OG Dark Forest avoided “per-render chain reads” mainly via:
an in-memory cache of game objects (planets/artifacts/arrivals)
bulk getters (one eth_call returning many planets)
event-driven incremental updates
That philosophy (sync → cache → incremental updates) is still the right mental model.
What I don’t fully agree with / what’s missing
1) “Your Aztec client has no cache” is not true
Your code already has a cache/store layer — GameManager writes contract-fetched planets into entityStore via replacePlanetFromContractData(...) and friends. That’s basically the “GameObjects Map” idea. Also, you already do “simulate forward locally” for continuous variables like energy/silver using updatePlanetIfStale → updatePlanetToTime(...) (i.e., you don’t need to refetch every tick just to make numbers move)
llm_bundle

. So the real issue isn’t “no cache exists”; it’s that the source-of-truth sync step (chain → cache) is currently very expensive because of the per-slot reads.
2) Ethereum-style event subscriptions may not be available the same way
Your own port notes highlight a key difference: “No Ethereum-style event stream”, and that you instead rely on explicit indexing lists (e.g., touched_planet_ids, revealed_coords_count) for syncing
llm_bundle

. So any plan that assumes “just subscribe to contract events and refetch 2 planets” needs to be adapted to what Aztec node + your contract currently expose.
3) The “unconstrained = read-only” framing is sloppy
In Aztec docs: public functions are also “unconstrained” and don’t generate proofs (they’re executed by the sequencer) — “unconstrained” does not mean “read-only”. 
 Read-only is achieved with #[view] / utility functions intended for querying. 
 That said, the spirit of the suggestion (“use read-only contract calls to aggregate reads server-side, not 39 client calls”) is good.
So how do you reduce network requests without hurting game perf or proving perf?
Here’s the practical, low-risk path, in the order I’d do it.
1) Biggest win with zero protocol assumptions: Batch node_getPublicStorageAt calls at the HTTP level
Right now each slot read is its own request because you call node.getPublicStorageAt(...) for each slot
llm_bundle

. The Aztec node JSON-RPC method is node_getPublicStorageAt and takes params like: ["latest", "0x<contract>", "0x<slot>"] 
 That means you can send a JSON-RPC batch (an array of many node_getPublicStorageAt requests) in one HTTP POST.
Why this is the “best first move”
No contract changes
No impact on proving (pure read-path change)
Often yields an immediate 10–100× reduction in HTTP request count, which is what kills you on latency + browser overhead.
How to apply it to your code
You can keep almost all your call sites the same and just change the plumbing:
Replace readPublicFields(...count) implementation so it uses a single batched JSON-RPC request instead of Promise.all per-slot. (Same inputs/outputs, vastly fewer network round-trips.)
Even better: let a batcher coalesce across multiple planets over a short window (e.g., 5–15ms) and flush as one batch.
Even if the node ends up doing the same number of Merkle lookups internally, you eliminate the worst part: 39× network round-trips per planet. (One caveat: not every JSON-RPC server supports batching; many do. You can feature-detect once at startup and fall back to current behavior.)
2) Make reads block-consistent and cacheable by block number
Right now every slot read uses "latest"
llm_bundle

. That can cause:
inconsistent planet bundles if a new block lands mid-read
difficulty caching (because you don’t know what “latest” meant)
Instead:
read blockNumber once (you already have a reporter polling block number)
pass that block tag through your read functions for the whole bundle
Then you can safely implement:
in-flight de-dup: if 3 UI components ask for planet X at block N, they share one promise
per-block cache: if you already fetched planet X at block N, you return it instantly
This reduces both duplicate reads and “thrash” from UI re-renders.
3) Don’t always fetch the full LocationBundle: add “summary vs detail” tiers
Your readLocationBundle always fetches:
planet core state (20)
artifacts (5)
artifact state (2)
revealed coords (4)
destroyed (1)
space junk (1)
arrivals list (6)
…even if the UI just needs “owner + level + planetType + maybe energy”.
llm_bundle

A big performance pattern in OG was:
the map / list views work on a summary struct
the detail pane loads full detail on demand
Do the same here:
readPlanetSummary(locationId)
Reads only the slots you actually need for:
rendering on-canvas
tooltips
planet lists
readPlanetDetails(locationId)
Fetches artifacts/arrivals/revealed coords only when:
the planet is selected
you open the artifacts pane
you inspect arrivals, etc.
This reduces total slot reads, not just HTTP overhead.
4) Lean harder on local simulation, and refresh only on discrete “events”
You already have the machinery to update planets forward locally (updatePlanetIfStale / updatePlanetToTime)
llm_bundle

, which is exactly how OG kept “energy/silver growth” smooth without re-querying chain constantly. So: make your chain refresh policy be mostly about discrete state changes:
arrivals being queued / landing
ownership changes
upgrades
artifact transfers / activations
“destroyed” toggles, etc.
Everything continuous can be simulated between “real sync points”. This reduces the pressure on your sync loops like syncOwnedPlanets() (which currently hard refreshes owned planets via bulkHardRefreshPlanets → contractsAPI.bulkGetPlanets).
5) If you can tolerate infra: use the Snapshot Indexer you already built
You already documented a solution specifically meant to avoid slow startup and tons of getPublicStorageAt calls: the Snapshot Indexer.
llm_bundle

 It:
generates snapshot.json via yarn indexer_snapshot
serves it via yarn run_indexer
and lets the client hydrate from that snapshot quickly (instead of hammering the node)
llm_bundle

.
You also have a SnapshotLoader in code that loads and applies snapshots, and can start live updates. If your goal is “playable game UX”, this is a very pragmatic path:
startup becomes fast
you only do “on-chain slot reads” for deltas / fallback / verification
Tradeoff: you now operate an indexer (or you tell players to run one locally).
6) Contract-level bulk getters (utility/view) for true OG-style reads
If you want a trust-minimized approach without adding a separate indexer, the closest analogue to OG “bulk getters” is:
add #[external("utility")] + #[view] functions that return:
get_location_bundle(location_id) -> LocationBundle
bulk_get_location_bundles(ids: [Field; N]) -> [LocationBundle; N]
These are unconstrained and don’t contribute to gate count (so they won’t hurt proving performance). 
 This shifts the “39 slot reads” from “39 HTTP calls” into “a single simulated call that reads a bunch of state internally”, which is exactly what an Ethereum eth_call bulk getter does. Tradeoffs to be aware of:
return payload size limits / practical performance (so choose small N like 5–20)
contract artifact/bytecode growth (you’ve got an Aztec public bytecode size ticket in your repo, so keep an eye on it if you’re already tight)
If I had to pick only 3 changes
Implement JSON-RPC batching for node_getPublicStorageAt (biggest immediate win, no contract changes). 
Add block-tag + cache + in-flight de-dup (fixes “same planet fetched multiple times” and makes reads consistent).
llm_bundle

Split summary vs detail reads (reduce total data read, not just round-trips).
llm_bundle

Then layer in snapshot/indexer or contract bulk getters depending on whether you prefer “infra” or “on-chain view API”.
One last framing: this won’t “kill proving perf”
The main fixes above are:
client-side caching / batching
node read-path improvements
optional utility/view functions for aggregation
None of that changes your private circuit complexity. Proof generation for private execution is a separate step and happens client-side in Aztec’s model. 
 So you can be aggressive about optimizing reads without worrying that you’re inflating ZK constraints. If you want, I can propose a concrete refactor plan around your existing readPublicFields/readPublicMapFields so you can drop in a BatchingPublicStorageReader without touching the rest of the code structure.

Sources




No file chosenNo file chosen
ChatGPT can make mistakes. Check important info. See Cookie Preferences.

