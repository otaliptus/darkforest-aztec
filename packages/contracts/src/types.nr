use dep::aztec::protocol_types::{
    address::AztecAddress,
    traits::{Deserialize, Packable, Serialize},
};

pub type ArtifactRarity = u8;
pub type ArtifactType = u8;
pub type Biome = u8;

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct GameConfig {
    pub planethash_key: Field,
    pub spacetype_key: Field,
    pub biomebase_key: Field,
    pub perlin_length_scale: u64,
    pub perlin_mirror_x: bool,
    pub perlin_mirror_y: bool,
    pub init_perlin_min: u64,
    pub init_perlin_max: u64,
    pub world_radius: u64,
    pub spawn_rim_area: u64,
    pub location_reveal_cooldown: u32,
    pub time_factor_hundredths: u64,
    pub planet_rarity: u64,
    pub max_location_id: Field,
}

impl GameConfig {
    pub fn new(
        planethash_key: Field,
        spacetype_key: Field,
        biomebase_key: Field,
        perlin_length_scale: u64,
        perlin_mirror_x: bool,
        perlin_mirror_y: bool,
        init_perlin_min: u64,
        init_perlin_max: u64,
        world_radius: u64,
        spawn_rim_area: u64,
        location_reveal_cooldown: u32,
        time_factor_hundredths: u64,
        planet_rarity: u64,
        max_location_id: Field,
    ) -> GameConfig {
        Self {
            planethash_key,
            spacetype_key,
            biomebase_key,
            perlin_length_scale,
            perlin_mirror_x,
            perlin_mirror_y,
            init_perlin_min,
            init_perlin_max,
            world_radius,
            spawn_rim_area,
            location_reveal_cooldown,
            time_factor_hundredths,
            planet_rarity,
            max_location_id,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct Player {
    pub is_initialized: bool,
    pub home_planet: Field,
    pub last_reveal_block: u32,
}

impl Player {
    pub fn empty() -> Player {
        Self {
            is_initialized: false,
            home_planet: 0,
            last_reveal_block: 0,
        }
    }

    pub fn new(
        home_planet: Field,
        last_reveal_block: u32,
    ) -> Player {
        Self {
            is_initialized: true,
            home_planet,
            last_reveal_block,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct Planet {
    pub is_initialized: bool,
    pub owner: AztecAddress,
    pub perlin: u64,
    pub population: u64,
    pub population_cap: u64,
    pub population_growth: u64,
    pub silver: u64,
    pub silver_cap: u64,
    pub silver_growth: u64,
    pub range: u64,
    pub speed: u64,
    pub defense: u64,
    pub last_updated: u32,
    pub planet_level: u8,
    pub planet_type: u8,
    pub space_type: u8,
    pub is_home_planet: bool,
    pub upgrade_state0: u8,
    pub upgrade_state1: u8,
    pub upgrade_state2: u8,
}

impl Planet {
    pub fn empty() -> Planet {
        Self {
            is_initialized: false,
            owner: AztecAddress::zero(),
            perlin: 0,
            population: 0,
            population_cap: 0,
            population_growth: 0,
            silver: 0,
            silver_cap: 0,
            silver_growth: 0,
            range: 0,
            speed: 0,
            defense: 0,
            last_updated: 0,
            planet_level: 0,
            planet_type: 0,
            space_type: 0,
            is_home_planet: false,
            upgrade_state0: 0,
            upgrade_state1: 0,
            upgrade_state2: 0,
        }
    }

    pub fn new(
        owner: AztecAddress,
        perlin: u64,
        population: u64,
        population_cap: u64,
        population_growth: u64,
        silver: u64,
        silver_cap: u64,
        silver_growth: u64,
        range: u64,
        speed: u64,
        defense: u64,
        last_updated: u32,
        planet_level: u8,
        planet_type: u8,
        space_type: u8,
        is_home_planet: bool,
        upgrade_state0: u8,
        upgrade_state1: u8,
        upgrade_state2: u8,
    ) -> Planet {
        Self {
            is_initialized: true,
            owner,
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
            last_updated,
            planet_level,
            planet_type,
            space_type,
            is_home_planet,
            upgrade_state0,
            upgrade_state1,
            upgrade_state2,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct Upgrade {
    pub pop_cap_multiplier: u64,
    pub pop_gro_multiplier: u64,
    pub range_multiplier: u64,
    pub speed_multiplier: u64,
    pub def_multiplier: u64,
}

impl Upgrade {
    pub fn new(
        pop_cap_multiplier: u64,
        pop_gro_multiplier: u64,
        range_multiplier: u64,
        speed_multiplier: u64,
        def_multiplier: u64,
    ) -> Upgrade {
        Self {
            pop_cap_multiplier,
            pop_gro_multiplier,
            range_multiplier,
            speed_multiplier,
            def_multiplier,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct PlanetArtifactState {
    pub has_tried_finding_artifact: bool,
    pub prospected_block_number: u32,
}

impl PlanetArtifactState {
    pub fn empty() -> PlanetArtifactState {
        Self {
            has_tried_finding_artifact: false,
            prospected_block_number: 0,
        }
    }

    pub fn new(
        has_tried_finding_artifact: bool,
        prospected_block_number: u32,
    ) -> PlanetArtifactState {
        Self {
            has_tried_finding_artifact,
            prospected_block_number,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct PlanetArtifacts {
    pub ids: [Field; 5],
}

impl PlanetArtifacts {
    pub fn empty() -> PlanetArtifacts {
        Self { ids: [0; 5] }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct Artifact {
    pub is_initialized: bool,
    pub id: Field,
    pub planet_discovered_on: Field,
    pub rarity: ArtifactRarity,
    pub planet_biome: Biome,
    pub discoverer: AztecAddress,
    pub artifact_type: ArtifactType,
    pub activations: u32,
    pub last_activated: u32,
    pub last_deactivated: u32,
    pub wormhole_to: Field,
    pub burned: bool,
}

impl Artifact {
    pub fn empty() -> Artifact {
        Self {
            is_initialized: false,
            id: 0,
            planet_discovered_on: 0,
            rarity: 0,
            planet_biome: 0,
            discoverer: AztecAddress::zero(),
            artifact_type: 0,
            activations: 0,
            last_activated: 0,
            last_deactivated: 0,
            wormhole_to: 0,
            burned: false,
        }
    }

    pub fn new(
        id: Field,
        planet_discovered_on: Field,
        rarity: ArtifactRarity,
        planet_biome: Biome,
        discoverer: AztecAddress,
        artifact_type: ArtifactType,
    ) -> Artifact {
        Self {
            is_initialized: true,
            id,
            planet_discovered_on,
            rarity,
            planet_biome,
            discoverer,
            artifact_type,
            activations: 0,
            last_activated: 0,
            last_deactivated: 0,
            wormhole_to: 0,
            burned: false,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct ArtifactWithMetadata {
    pub artifact: Artifact,
    pub owner: AztecAddress,
    pub location_id: Field,
}

impl ArtifactWithMetadata {
    pub fn empty() -> ArtifactWithMetadata {
        Self {
            artifact: Artifact::empty(),
            owner: AztecAddress::zero(),
            location_id: 0,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct RevealedCoords {
    pub location_id: Field,
    pub x: Field,
    pub y: Field,
    pub revealer: AztecAddress,
}

impl RevealedCoords {
    pub fn empty() -> RevealedCoords {
        Self {
            location_id: 0,
            x: 0,
            y: 0,
            revealer: AztecAddress::zero(),
        }
    }

    pub fn new(location_id: Field, x: Field, y: Field, revealer: AztecAddress) -> RevealedCoords {
        Self {
            location_id,
            x,
            y,
            revealer,
        }
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct Arrival {
    pub player: AztecAddress,
    pub from_planet: Field,
    pub to_planet: Field,
    pub pop_silver: u128,
    pub meta: u128,
    pub carried_artifact_id: Field,
}

impl Arrival {
    pub fn empty() -> Arrival {
        Self {
            player: AztecAddress::zero(),
            from_planet: 0,
            to_planet: 0,
            pop_silver: 0,
            meta: 0,
            carried_artifact_id: 0,
        }
    }

    pub fn new(
        player: AztecAddress,
        from_planet: Field,
        to_planet: Field,
        pop_arriving: u64,
        silver_moved: u64,
        departure_block: u32,
        arrival_block: u32,
        arrival_type: u8,
        distance: u64,
        carried_artifact_id: Field,
    ) -> Arrival {
        assert(distance <= 0xFFFF_FFFF);
        let pop_silver = ((pop_arriving as u128) << 64) | (silver_moved as u128);
        let distance_u32 = distance as u32;
        let meta = (departure_block as u128)
            | ((arrival_block as u128) << 32)
            | ((arrival_type as u128) << 64)
            | ((distance_u32 as u128) << 72);
        Self {
            player,
            from_planet,
            to_planet,
            pop_silver,
            meta,
            carried_artifact_id,
        }
    }

    pub fn pop_arriving(self) -> u64 {
        (self.pop_silver >> 64) as u64
    }

    pub fn silver_moved(self) -> u64 {
        (self.pop_silver & 0xFFFF_FFFF_FFFF_FFFF) as u64
    }

    pub fn arrival_block(self) -> u32 {
        ((self.meta >> 32) & 0xFFFF_FFFF) as u32
    }

    pub fn arrival_type(self) -> u8 {
        ((self.meta >> 64) & 0xFF) as u8
    }
}

#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct PlanetArrivals {
    pub ids: [u128; 6],
}

impl PlanetArrivals {
    pub fn empty() -> PlanetArrivals {
        Self { ids: [0; 6] }
    }

    pub fn get(self, idx: u32) -> u64 {
        let pair_index = idx / 2;
        let pair = self.ids[pair_index];
        if (idx & 1) == 0 {
            (pair & 0xFFFF_FFFF_FFFF_FFFF) as u64
        } else {
            ((pair >> 64) & 0xFFFF_FFFF_FFFF_FFFF) as u64
        }
    }

    pub fn set(self, idx: u32, value: u64) -> PlanetArrivals {
        let mut updated = self;
        let pair_index = idx / 2;
        let pair = updated.ids[pair_index];
        let value_u128 = value as u128;
        let low_mask: u128 = 0xFFFF_FFFF_FFFF_FFFF;
        let high_mask: u128 = 0xFFFF_FFFF_FFFF_FFFF_0000_0000_0000_0000;
        let new_pair = if (idx & 1) == 0 {
            (pair & high_mask) | value_u128
        } else {
            (pair & low_mask) | (value_u128 << 64)
        };
        updated.ids[pair_index] = new_pair;
        updated
    }
}
