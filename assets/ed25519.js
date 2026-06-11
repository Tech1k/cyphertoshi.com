// Minimal ed25519 group operations for educational Monero demos (stealth addresses, etc).
// Affine reference math (BigInt), the same implementation verified against a Monero test
// vector elsewhere on this site. Points are [x, y] (BigInt); scalars are BigInt.
// Exposes: base(s)=s*G, scalarmult(P,s), add(P,Q), mul8(P), encode(P), decode(bytes),
//          reduce(bytes), randomScalar().
var ed25519 = (function () {
    'use strict';

    const Q = (1n << 255n) - 19n;
    const ORDER = (1n << 252n) + 27742317777372353535851937790883648493n;

    function mod(a, m) { a %= m; return a < 0n ? a + m : a; }
    function modpow(b, e, m) {
        b = mod(b, m); let r = 1n;
        while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; }
        return r;
    }
    function inv(x) { return modpow(x, Q - 2n, Q); }

    const D = mod(-121665n * inv(121666n), Q);
    const IM = modpow(2n, (Q - 1n) / 4n, Q);

    function xrecover(y) {
        const xx = mod((y * y - 1n) * inv(D * y * y + 1n), Q);
        let x = modpow(xx, (Q + 3n) / 8n, Q);
        if (mod(x * x - xx, Q) !== 0n) x = mod(x * IM, Q);
        if (x % 2n !== 0n) x = Q - x;
        return x;
    }

    const BY = mod(4n * inv(5n), Q);
    const BASE = [xrecover(BY), BY];

    // Monero's hash-to-point (ge_fromfe_frombytes_vartime + cofactor mul8), used for key images.
    // Ported from the mininero reference; verified against Monero's hash_to_ec test vectors.
    const A = 486662n;
    function sqroot(xx) { let x = modpow(xx, (Q + 3n) / 8n, Q); if (mod(x * x - xx, Q) !== 0n) x = mod(x * IM, Q); return x; }

    function add(P, R) {
        const x1 = P[0], y1 = P[1], x2 = R[0], y2 = R[1];
        const x3 = mod((x1 * y2 + x2 * y1) * inv(1n + D * x1 * x2 * y1 * y2), Q);
        const y3 = mod((y1 * y2 + x1 * x2) * inv(1n - D * x1 * x2 * y1 * y2), Q);
        return [x3, y3];
    }

    // Extended twisted-Edwards coordinates (X,Y,Z,T): no per-step modular inverse, so
    // scalar multiplication is far faster than the affine ladder. One inverse at the end.
    function extAdd(P, R) {
        const X1 = P[0], Y1 = P[1], Z1 = P[2], T1 = P[3], X2 = R[0], Y2 = R[1], Z2 = R[2], T2 = R[3];
        const a = mod((Y1 - X1) * (Y2 - X2), Q), b = mod((Y1 + X1) * (Y2 + X2), Q);
        const c = mod(T1 * 2n * D * T2, Q), d = mod(Z1 * 2n * Z2, Q);
        const e = mod(b - a, Q), f = mod(d - c, Q), g = mod(d + c, Q), h = mod(b + a, Q);
        return [mod(e * f, Q), mod(g * h, Q), mod(f * g, Q), mod(e * h, Q)];
    }
    function smul(Paff, e) {
        if (e === 0n) return [0n, 1n];
        const P = [Paff[0], Paff[1], 1n, mod(Paff[0] * Paff[1], Q)];
        let R = [0n, 1n, 1n, 0n];
        const bits = e.toString(2);
        for (let i = 0; i < bits.length; i++) {
            R = extAdd(R, R);
            if (bits[i] === '1') R = extAdd(R, P);
        }
        const zi = inv(R[2]);
        return [mod(R[0] * zi, Q), mod(R[1] * zi, Q)];
    }

    function leToBig(b) { let r = 0n; for (let i = b.length - 1; i >= 0; i--) r = (r << 8n) | BigInt(b[i]); return r; }

    // hashToPoint(bytes32): map a 32-byte hash to a curve point (Monero's Hp). Returns [x, y].
    function hashToPoint(bytes) {
        const u = mod(leToBig(bytes), Q);
        const w = mod(2n * u * u + 1n, Q);
        const xp = mod(w * w - 2n * A * A * u * u, Q);
        let rx = modpow(mod(w * inv(xp), Q), (Q + 3n) / 8n, Q);
        let x = mod(mod(rx * rx, Q) * xp, Q);
        let y = mod(2n * u * u + 1n - x, Q);
        let z, sign, neg = false;
        if (y !== 0n) {
            y = mod(w + x, Q);
            if (y !== 0n) neg = true;
            else rx = mod(rx * mod(-1n * sqroot(mod(-2n * A * (A + 2n), Q)), Q), Q);
        } else {
            rx = mod(rx * mod(-1n * sqroot(mod(2n * A * (A + 2n), Q)), Q), Q);
        }
        if (!neg) {
            rx = mod(rx * u, Q); z = mod(-2n * A * u * u, Q); sign = 0n;
        } else {
            z = mod(-1n * A, Q); x = mod(x * IM, Q); y = mod(w - x, Q);
            if (y !== 0n) rx = mod(rx * sqroot(mod(-1n * IM * A * (A + 2n), Q)), Q);
            else rx = mod(rx * mod(-1n * sqroot(mod(IM * A * (A + 2n), Q)), Q), Q);
            sign = 1n;
        }
        if ((rx & 1n) !== sign) rx = mod(-rx, Q);
        const rz = mod(z + w, Q), ry = mod(z - w, Q);
        rx = mod(rx * rz, Q);
        const zi = inv(rz);
        return smul([mod(rx * zi, Q), mod(ry * zi, Q)], 8n);
    }

    function encode(P) {
        const x = P[0], y = P[1];
        const out = new Uint8Array(32);
        for (let i = 0; i < 255; i++) if ((y >> BigInt(i)) & 1n) out[i >> 3] |= (1 << (i & 7));
        if (x & 1n) out[31] |= 0x80;
        return out;
    }

    function decode(bytes) {
        let y = 0n;
        for (let i = 0; i < 32; i++) y |= BigInt(bytes[i]) << (8n * BigInt(i));
        const sign = (y >> 255n) & 1n;
        y &= (1n << 255n) - 1n;
        let x = xrecover(y);
        if ((x & 1n) !== sign) x = Q - x;
        return [x, y];
    }

    return {
        BASE: BASE,
        ORDER: ORDER,
        base: function (e) { return smul(BASE, mod(e, ORDER)); },     // e * G
        scalarmult: function (P, e) { return smul(P, mod(e, ORDER)); }, // e * P
        add: add,
        negate: function (P) { return [mod(Q - P[0], Q), P[1]]; },    // -P = (-x, y)
        mul8: function (P) { return smul(P, 8n); },                   // cofactor multiply
        encode: encode,
        decode: decode,
        hashToPoint: hashToPoint,
        reduce: function (bytes) { return mod(leToBig(bytes), ORDER); },
        randomScalar: function () { const b = new Uint8Array(32); crypto.getRandomValues(b); return mod(leToBig(b), ORDER); }
    };
})();
