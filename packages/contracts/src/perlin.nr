use crate::hash::hash_3_4;
use crate::utils::{
    Signed,
    field_to_signed,
    signed_add,
    signed_div_exact,
    signed_from_i64,
    signed_from_u128,
    signed_mul,
    signed_mul_u128,
    signed_neg,
    signed_sub,
    signed_modulo,
    signed_to_field,
    signed_zero,
};
use dep::std::field::bn254;

global DENOMINATOR: u128 = 1125899906842624000;
global MAX_PERLIN_VALUE: u128 = 32;

fn random_u4(x: Field, y: Field, scale: Field, key: Field) -> u8 {
    let out = hash_3_4(x, y, scale, key);
    // Use a 128-bit limb decomposition to avoid a full 254-bit bit-decomposition.
    let (lo, _) = bn254::decompose(out);
    let lo_u128: u128 = lo as u128;
    (lo_u128 & 15) as u8
}

fn random_gradient_at(x: Signed, y: Signed, scale: u128, key: Field) -> [Signed; 2] {
    let vecs: [[i64; 2]; 16] = [
        [1000, 0],
        [923, 382],
        [707, 707],
        [382, 923],
        [0, 1000],
        [-383, 923],
        [-708, 707],
        [-924, 382],
        [-1000, 0],
        [-924, -383],
        [-708, -708],
        [-383, -924],
        [-1, -1000],
        [382, -924],
        [707, -708],
        [923, -383],
    ];

    let idx = random_u4(signed_to_field(x), signed_to_field(y), scale as Field, key);
    let mut gx: i64 = 0;
    let mut gy: i64 = 0;
    for i in 0..16 {
        if idx == i as u8 {
            gx = vecs[i as u32][0];
            gy = vecs[i as u32][1];
        }
    }

    let vector_denominator = DENOMINATOR / 1000;
    let gx_signed = signed_from_i64(gx);
    let gy_signed = signed_from_i64(gy);

    [
        signed_mul_u128(gx_signed, vector_denominator),
        signed_mul_u128(gy_signed, vector_denominator),
    ]
}

fn get_corners_and_grads(
    p: [Signed; 2],
    scale: u128,
    key: Field,
) -> ([[Signed; 2]; 4], [[Signed; 2]; 4]) {
    let (x_rem, _) = signed_modulo(p[0], scale);
    let (y_rem, _) = signed_modulo(p[1], scale);

    let rem_x = signed_from_u128(x_rem);
    let rem_y = signed_from_u128(y_rem);
    let scale_signed = signed_from_u128(scale);

    let bottom_left = [signed_sub(p[0], rem_x), signed_sub(p[1], rem_y)];
    let bottom_right = [signed_add(bottom_left[0], scale_signed), bottom_left[1]];
    let top_left = [bottom_left[0], signed_add(bottom_left[1], scale_signed)];
    let top_right = [
        signed_add(bottom_left[0], scale_signed),
        signed_add(bottom_left[1], scale_signed),
    ];

    let bl_grad = random_gradient_at(bottom_left[0], bottom_left[1], scale, key);
    let br_grad = random_gradient_at(bottom_right[0], bottom_right[1], scale, key);
    let tl_grad = random_gradient_at(top_left[0], top_left[1], scale, key);
    let tr_grad = random_gradient_at(top_right[0], top_right[1], scale, key);

    (
        [bottom_left, bottom_right, top_left, top_right],
        [bl_grad, br_grad, tl_grad, tr_grad],
    )
}

fn get_weight(corner: [Signed; 2], p: [Signed; 2], which_corner: u8) -> u128 {
    let mut diff_x = signed_zero();
    let mut diff_y = signed_zero();

    if which_corner == 0 {
        diff_x = signed_sub(p[0], corner[0]);
        diff_y = signed_sub(p[1], corner[1]);
    } else if which_corner == 1 {
        diff_x = signed_sub(corner[0], p[0]);
        diff_y = signed_sub(p[1], corner[1]);
    } else if which_corner == 2 {
        diff_x = signed_sub(p[0], corner[0]);
        diff_y = signed_sub(corner[1], p[1]);
    } else {
        diff_x = signed_sub(corner[0], p[0]);
        diff_y = signed_sub(corner[1], p[1]);
    }

    assert(!diff_x.neg);
    assert(!diff_y.neg);

    let factor_x = DENOMINATOR - diff_x.mag;
    let factor_y = DENOMINATOR - diff_y.mag;
    let nominator = factor_x * factor_y;
    let weight = nominator / DENOMINATOR;
    assert(nominator == weight * DENOMINATOR);
    weight
}

fn dot(a: [Signed; 2], b: [Signed; 2]) -> Signed {
    let prod0 = signed_mul(a[0], b[0]);
    let prod1 = signed_mul(a[1], b[1]);
    let sum = signed_add(prod0, prod1);
    signed_div_exact(sum, DENOMINATOR)
}

fn single_scale_perlin(p: [Signed; 2], scale: u128, key: Field) -> Signed {
    let (coords, grads) = get_corners_and_grads(p, scale, key);
    let scaled_p = [
        signed_mul_u128(p[0], DENOMINATOR),
        signed_mul_u128(p[1], DENOMINATOR),
    ];

    let mut total = signed_zero();
    for i in 0..4 {
        let scaled_corner = [
            signed_mul_u128(coords[i as u32][0], DENOMINATOR),
            signed_mul_u128(coords[i as u32][1], DENOMINATOR),
        ];
        let dist_vec = [
            signed_sub(scaled_p[0], scaled_corner[0]),
            signed_sub(scaled_p[1], scaled_corner[1]),
        ];

        let corner_unit = [
            signed_div_exact(scaled_corner[0], scale),
            signed_div_exact(scaled_corner[1], scale),
        ];
        let p_unit = [
            signed_div_exact(scaled_p[0], scale),
            signed_div_exact(scaled_p[1], scale),
        ];
        let dist_unit = [
            signed_div_exact(dist_vec[0], scale),
            signed_div_exact(dist_vec[1], scale),
        ];

        let weight = get_weight(corner_unit, p_unit, i as u8);
        let dot_val = dot(grads[i as u32], dist_unit);
        let term = signed_div_exact(signed_mul_u128(dot_val, weight), DENOMINATOR);
        total = signed_add(total, term);
    }

    total
}

fn is_power_of_two(value: u64) -> bool {
    if value == 0 { false } else { (value & (value - 1)) == 0 }
}

pub fn multi_scale_perlin(
    x: Field,
    y: Field,
    key: Field,
    scale: u64,
    x_mirror: bool,
    y_mirror: bool,
) -> u64 {
    assert(scale <= 16384);
    assert(is_power_of_two(scale));

    let mut px = field_to_signed(x);
    let mut py = field_to_signed(y);

    if y_mirror {
        if px.neg {
            px = signed_neg(px);
        }
    }
    if x_mirror {
        if py.neg {
            py = signed_neg(py);
        }
    }

    let scale_i = scale as u128;
    let p0 = single_scale_perlin([px, py], scale_i, key);
    let p1 = single_scale_perlin([px, py], scale_i * 2, key);
    let p2 = single_scale_perlin([px, py], scale_i * 4, key);

    let mut total = signed_add(p0, p0);
    total = signed_add(total, p1);
    total = signed_add(total, p2);

    let avg = signed_div_exact(total, 4);
    let scaled = signed_mul_u128(avg, MAX_PERLIN_VALUE / 2);
    let (_, quotient) = signed_modulo(scaled, DENOMINATOR);
    let result = signed_add(quotient, signed_from_u128(MAX_PERLIN_VALUE / 2));

    assert(!result.neg);
    result.mag as u64
}

#[test]
fn test_random_u4_matches_bits() {
    let xs: [Field; 5] = [1, 123, 0 - 1, 999999, 42];
    let ys: [Field; 5] = [2, 456, 0 - 2, 888888, 0];
    let scales: [Field; 5] = [3, 789, 1024, 16384, 1];
    let keys: [Field; 5] = [4, 42, 98765, 555, 7];

    for i in 0..5 {
        let out = hash_3_4(xs[i], ys[i], scales[i], keys[i]);
        let bits: [u1; 254] = out.to_le_bits();
        let mut expected: u8 = 0;
        if bits[0] == 1 { expected += 1; }
        if bits[1] == 1 { expected += 2; }
        if bits[2] == 1 { expected += 4; }
        if bits[3] == 1 { expected += 8; }

        let got = random_u4(xs[i], ys[i], scales[i], keys[i]);
        assert(got == expected);
    }
}
