// Hash wrapper module that selects between original Dark Forest MiMC and Aztec MiMC
// based on the USE_AZTEC_MIMC feature flag.
//
// When USE_AZTEC_MIMC is true:
//   - Uses 91 rounds with exponent 7 (Noir standard)
//   - ~45% fewer constraints per hash
//   - Creates different location IDs (new game universe)
//
// When USE_AZTEC_MIMC is false:
//   - Uses 220 rounds with exponent 5 (Dark Forest v0.6 original)
//   - Compatible with original Dark Forest location IDs

use crate::feature_flags::USE_AZTEC_MIMC;
use crate::mimc::{mimc_sponge_2_220, mimc_sponge_3_4 as mimc_sponge_3_4_original};
use crate::aztec_mimc::{aztec_mimc_sponge_2, aztec_mimc_sponge_3_4};

/// Primary hash function for 2 inputs.
/// Used for: location_id = hash(x, y), artifact seeds, nullifiers
pub fn hash_2(a: Field, b: Field, k: Field) -> Field {
    if USE_AZTEC_MIMC {
        aztec_mimc_sponge_2(a, b, k)
    } else {
        mimc_sponge_2_220(a, b, k)
    }
}

/// Hash function for 3 inputs with 4 rounds (for perlin noise).
/// Always uses the 4-round variant for efficiency.
pub fn hash_3_4(a: Field, b: Field, c: Field, k: Field) -> Field {
    if USE_AZTEC_MIMC {
        aztec_mimc_sponge_3_4(a, b, c, k)
    } else {
        mimc_sponge_3_4_original(a, b, c, k)
    }
}

#[test]
fn test_hash_2_is_deterministic() {
    let h1 = hash_2(100, 200, 0);
    let h2 = hash_2(100, 200, 0);
    assert(h1 == h2);
    
    // Different input = different output
    let h3 = hash_2(100, 201, 0);
    assert(h1 != h3);
}

#[test]
fn test_hash_3_4_is_deterministic() {
    let h1 = hash_3_4(1, 2, 3, 42);
    let h2 = hash_3_4(1, 2, 3, 42);
    assert(h1 == h2);
}
