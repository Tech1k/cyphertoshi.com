// Monero 25-word (Electrum-style) mnemonic: decode + key/address derivation.
// Depends on moneroWordlistEN (word list) and moneroAddress (keccak256 + b58encode).
// The ed25519 math is a self-contained port of the reference implementation, verified
// against a known Monero test vector (mnemonic -> address). No external dependencies.
var moneroMnemonic = (function () {
    'use strict';

    const N = 1626;
    let IDX = null;

    // CRC32 (IEEE / zlib), used for the 25th checksum word.
    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc ^= bytes[i];
            for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function checksumIndex(words) {
        let s = '';
        for (let i = 0; i < 24; i++) s += words[i].slice(0, 3); // English unique-prefix length is 3
        return crc32(new TextEncoder().encode(s)) % 24;
    }

    // mnemonic -> { seed: Uint8Array(32) } or { error }
    function decode(mnemonic) {
        const words = (mnemonic || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length !== 25) return { error: 'expected 25 words, got ' + words.length };
        if (!IDX) { IDX = {}; for (let i = 0; i < moneroWordlistEN.length; i++) IDX[moneroWordlistEN[i]] = i; }
        for (const w of words) if (!(w in IDX)) return { error: 'word not in the Monero word list: "' + w + '"' };
        if (words[24] !== words[checksumIndex(words)]) return { error: 'invalid checksum word' };

        const out = new Uint8Array(32);
        for (let i = 0, o = 0; i < 24; i += 3, o += 4) {
            const w1 = IDX[words[i]], w2 = IDX[words[i + 1]], w3 = IDX[words[i + 2]];
            const x = w1 + N * (((N - w1) + w2) % N) + N * N * (((N - w2) + w3) % N);
            if (x % N !== w1 || x >= 4294967296) return { error: 'invalid word group' };
            out[o] = x & 0xff; out[o + 1] = (x >>> 8) & 0xff; out[o + 2] = (x >>> 16) & 0xff; out[o + 3] = (x >>> 24) & 0xff;
        }
        return { seed: out };
    }

    // --- ed25519 reference (BigInt) ---
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
    function edAdd(P, R) {
        const x1 = P[0], y1 = P[1], x2 = R[0], y2 = R[1];
        const x3 = mod((x1 * y2 + x2 * y1) * inv(1n + D * x1 * x2 * y1 * y2), Q);
        const y3 = mod((y1 * y2 + x1 * x2) * inv(1n - D * x1 * x2 * y1 * y2), Q);
        return [x3, y3];
    }
    function scalarMult(P, e) {
        if (e === 0n) return [0n, 1n];
        let R = scalarMult(P, e >> 1n);
        R = edAdd(R, R);
        if (e & 1n) R = edAdd(R, P);
        return R;
    }
    function encodePoint(P) {
        const x = P[0], y = P[1];
        const out = new Uint8Array(32);
        for (let i = 0; i < 255; i++) if ((y >> BigInt(i)) & 1n) out[i >> 3] |= (1 << (i & 7));
        if (x & 1n) out[31] |= 0x80;
        return out;
    }
    function leToBig(b) { let r = 0n; for (let i = b.length - 1; i >= 0; i--) r = (r << 8n) | BigInt(b[i]); return r; }
    function bigToLe(n, len) { const out = new Uint8Array(len); for (let i = 0; i < len; i++) { out[i] = Number(n & 0xffn); n >>= 8n; } return out; }
    function scReduce(bytes) { return mod(leToBig(bytes), ORDER); }
    const toHex = (b) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');

    // seed bytes + network prefix -> derived keys and primary address.
    function derive(seedBytes, prefix) {
        const xmr = moneroAddress;
        const spendScalar = scReduce(seedBytes);                  // sc_reduce32(seed)
        const spendSec = bigToLe(spendScalar, 32);
        const viewScalar = scReduce(xmr.keccak256(spendSec));      // sc_reduce32(keccak256(spend))
        const viewSec = bigToLe(viewScalar, 32);
        const pubSpend = encodePoint(scalarMult(BASE, spendScalar));
        const pubView = encodePoint(scalarMult(BASE, viewScalar));

        const data = new Uint8Array(65);
        data[0] = prefix;
        data.set(pubSpend, 1);
        data.set(pubView, 33);
        const full = new Uint8Array(69);
        full.set(data, 0);
        full.set(xmr.keccak256(data).subarray(0, 4), 65);

        return {
            spendSecret: toHex(spendSec),
            viewSecret: toHex(viewSec),
            spendPublic: toHex(pubSpend),
            viewPublic: toHex(pubView),
            address: xmr.b58encode(full)
        };
    }

    return { decode: decode, derive: derive };
})();
