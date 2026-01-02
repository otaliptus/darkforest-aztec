use dep::std::field::bn254;

use crate::mimc::mimc_sponge_2_220;

pub fn config_hash(
    planethash_key: Field,
    config_key: Field,
    perlin_length_scale: u64,
    perlin_mirror_x: bool,
    perlin_mirror_y: bool,
) -> Field {
    let flags: u8 = (perlin_mirror_x as u8) + ((perlin_mirror_y as u8) << 1);
    let seed = mimc_sponge_2_220(planethash_key, config_key, 0);
    mimc_sponge_2_220(perlin_length_scale as Field, flags as Field, seed)
}

pub struct Signed {
    pub neg: bool,
    pub mag: u128,
}

global FIELD_MODULUS_HALF: Field =
    10944121435919637611123202872628637544274182200208017171849102093287904247808;

fn normalize(neg: bool, mag: u128) -> Signed {
    if mag == 0 {
        Signed { neg: false, mag: 0 }
    } else {
        Signed { neg, mag }
    }
}

pub fn signed_zero() -> Signed {
    Signed { neg: false, mag: 0 }
}

pub fn signed_from_u128(value: u128) -> Signed {
    normalize(false, value)
}

pub fn signed_from_i64(value: i64) -> Signed {
    if value < 0 {
        normalize(true, (-value) as u128)
    } else {
        normalize(false, value as u128)
    }
}

pub fn signed_neg(value: Signed) -> Signed {
    if value.mag == 0 {
        value
    } else {
        Signed {
            neg: !value.neg,
            mag: value.mag,
        }
    }
}

pub fn signed_add(a: Signed, b: Signed) -> Signed {
    if a.neg == b.neg {
        normalize(a.neg, a.mag + b.mag)
    } else if a.mag >= b.mag {
        normalize(a.neg, a.mag - b.mag)
    } else {
        normalize(b.neg, b.mag - a.mag)
    }
}

pub fn signed_sub(a: Signed, b: Signed) -> Signed {
    signed_add(a, signed_neg(b))
}

pub fn signed_mul(a: Signed, b: Signed) -> Signed {
    let neg = a.neg != b.neg;
    normalize(neg, a.mag * b.mag)
}

pub fn signed_mul_u128(a: Signed, b: u128) -> Signed {
    if a.mag == 0 {
        signed_zero()
    } else if b == 0 {
        signed_zero()
    } else {
        normalize(a.neg, a.mag * b)
    }
}

pub fn signed_div_exact(a: Signed, divisor: u128) -> Signed {
    assert(divisor != 0);
    let quotient = a.mag / divisor;
    assert(a.mag == quotient * divisor);
    normalize(a.neg, quotient)
}

pub fn signed_modulo(a: Signed, divisor: u128) -> (u128, Signed) {
    assert(divisor > 0);
    let raw_remainder = a.mag % divisor;
    let raw_quotient = a.mag / divisor;

    if !a.neg {
        (raw_remainder, normalize(false, raw_quotient))
    } else if raw_remainder == 0 {
        (0, normalize(true, raw_quotient))
    } else {
        let remainder = divisor - raw_remainder;
        let quotient = raw_quotient + 1;
        (remainder, normalize(true, quotient))
    }
}

pub fn field_is_negative(x: Field) -> bool {
    bn254::gt(x, FIELD_MODULUS_HALF)
}

pub fn field_to_signed(x: Field) -> Signed {
    let is_negative = field_is_negative(x);
    if is_negative {
        let mag_field = 0 - x;
        normalize(true, mag_field as u128)
    } else {
        normalize(false, x as u128)
    }
}

pub fn signed_to_field(x: Signed) -> Field {
    let val = x.mag as Field;
    if x.neg { 0 - val } else { val }
}

pub fn field_abs_u128(x: Field) -> u128 {
    field_to_signed(x).mag
}

pub fn pow2_frac_q32(frac: u32) -> u128 {
    let consts: [u64; 32] = [
        6074001000,
        5107605667,
        4683695048,
        4485121744,
        4389014833,
        4341736423,
        4318288544,
        4306612134,
        4300785774,
        4297875550,
        4296421177,
        4295694175,
        4295330720,
        4295149004,
        4295058149,
        4295012722,
        4294990009,
        4294978653,
        4294972974,
        4294970135,
        4294968716,
        4294968006,
        4294967651,
        4294967473,
        4294967385,
        4294967340,
        4294967318,
        4294967307,
        4294967302,
        4294967299,
        4294967297,
        4294967297,
    ];

    let mut result: u128 = 1u128 << 32;
    for i in 0..32 {
        let shift = 31 - i;
        let bit = (frac >> shift) & 1;
        if bit == 1 {
            result = (result * (consts[i] as u128)) >> 32;
        }
    }
    result
}

global INV_LN2_Q32: u64 = 6196328019;

pub fn pow2_q32_from_q32(exp_q32: u128) -> u128 {
    let int_part = (exp_q32 >> 32) as u32;
    let frac_part = (exp_q32 & 0xFFFF_FFFF) as u32;
    let mut result = pow2_frac_q32(frac_part);
    result = result << (int_part as u128);
    result
}

pub fn exp_neg_q32(x_q32: u128) -> u128 {
    let y_q32 = (x_q32 * (INV_LN2_Q32 as u128)) >> 32;
    let y_int = (y_q32 >> 32) as u32;
    let mut result: u128 = 0;
    if y_int < 64 {
        let pow2 = pow2_q32_from_q32(y_q32);
        if pow2 != 0 {
            result = (1u128 << 64) / pow2;
        }
    }
    result
}
