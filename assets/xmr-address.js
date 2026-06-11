// Monero address validation: Keccak-256 (original padding 0x01, as Monero uses; not NIST SHA3)
// + Monero block-based base58 + 4-byte checksum. Self-contained, no dependencies.
// Exposes: moneroAddress.validate(addr) -> { valid, type, network, spend, view, paymentId, error }
var moneroAddress = (function () {
    'use strict';

    const MASK = (1n << 64n) - 1n;
    const RC = [
        0x0000000000000001n, 0x0000000000008082n, 0x800000000000808An, 0x8000000080008000n,
        0x000000000000808Bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
        0x000000000000008An, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000An,
        0x000000008000808Bn, 0x800000000000008Bn, 0x8000000000008089n, 0x8000000000008003n,
        0x8000000000008002n, 0x8000000000000080n, 0x000000000000800An, 0x800000008000000An,
        0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n];
    const RHO = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
    const rol = (x, n) => { const b = BigInt(n); return ((x << b) | (x >> (64n - b))) & MASK; };

    function keccakF(s) {
        for (let r = 0; r < 24; r++) {
            const C = [];
            for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x+5] ^ s[x+10] ^ s[x+15] ^ s[x+20];
            const D = [];
            for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ rol(C[(x+1)%5], 1);
            for (let x = 0; x < 5; x++) for (let y = 0; y < 25; y += 5) s[x+y] ^= D[x];
            const s2 = new Array(25).fill(0n);
            for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++)
                s2[y + ((2*x + 3*y) % 5) * 5] = rol(s[x + 5*y], RHO[x][y]);
            for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++)
                s[x + 5*y] = s2[x + 5*y] ^ ((~s2[((x+1)%5) + 5*y] & MASK) & s2[((x+2)%5) + 5*y]);
            s[0] ^= RC[r];
        }
    }

    function keccak256(data) {
        const rate = 136;
        const s = new Array(25).fill(0n);
        const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
        padded.set(data);
        padded[data.length] ^= 0x01;
        padded[padded.length - 1] ^= 0x80;
        for (let off = 0; off < padded.length; off += rate) {
            for (let i = 0; i < rate / 8; i++) {
                let lane = 0n;
                for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i*8 + b]);
                s[i] ^= lane;
            }
            keccakF(s);
        }
        const out = new Uint8Array(32);
        let p = 0;
        while (p < 32) {
            for (let i = 0; i < rate / 8 && p < 32; i++) {
                let lane = s[i];
                for (let b = 0; b < 8 && p < 32; b++) { out[p++] = Number(lane & 0xffn); lane >>= 8n; }
            }
            if (p < 32) keccakF(s);
        }
        return out;
    }

    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const ENC_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11]; // decoded bytes -> encoded chars per block

    function b58decode(str) {
        const out = [];
        for (let i = 0; i < str.length; i += 11) {
            const block = str.slice(i, i + 11);
            const nbytes = ENC_SIZES.indexOf(block.length);
            if (nbytes < 0) throw new Error('invalid block length');
            let num = 0n;
            for (const c of block) {
                const d = ALPHABET.indexOf(c);
                if (d < 0) throw new Error('invalid base58 character');
                num = num * 58n + BigInt(d);
            }
            const bytes = new Array(nbytes);
            let tmp = num;
            for (let b = nbytes - 1; b >= 0; b--) { bytes[b] = Number(tmp & 0xffn); tmp >>= 8n; }
            if (tmp !== 0n) throw new Error('block overflow');
            for (const v of bytes) out.push(v);
        }
        return Uint8Array.from(out);
    }

    function b58encode(bytes) {
        let out = '';
        for (let i = 0; i < bytes.length; i += 8) {
            const chunk = bytes.subarray(i, i + 8);
            let num = 0n;
            for (const b of chunk) num = (num << 8n) | BigInt(b);
            const chars = ENC_SIZES[chunk.length];
            let block = '';
            for (let j = 0; j < chars; j++) { block = ALPHABET[Number(num % 58n)] + block; num /= 58n; }
            out += block;
        }
        return out;
    }

    const PREFIXES = {
        18: ['Standard', 'Mainnet'],   19: ['Integrated', 'Mainnet'],   42: ['Subaddress', 'Mainnet'],
        53: ['Standard', 'Testnet'],   54: ['Integrated', 'Testnet'],   63: ['Subaddress', 'Testnet'],
        24: ['Standard', 'Stagenet'],  25: ['Integrated', 'Stagenet'],  36: ['Subaddress', 'Stagenet']
    };

    const toHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    function validate(addr) {
        addr = (addr || '').trim();
        if (!addr) return { valid: false, error: 'empty input' };

        let raw;
        try {
            raw = b58decode(addr);
        } catch (err) {
            return { valid: false, error: 'not valid base58 (' + err.message + ')' };
        }

        const info = PREFIXES[raw[0]];
        if (!info) return { valid: false, error: 'unrecognized prefix ' + raw[0] };
        const [type, network] = info;

        const expected = (type === 'Integrated') ? 77 : 69;
        if (raw.length !== expected) {
            return { valid: false, type, network, error: 'wrong length (got ' + raw.length + ' bytes, expected ' + expected + ')' };
        }

        const body = raw.subarray(0, raw.length - 4);
        const checksum = raw.subarray(raw.length - 4);
        const calc = keccak256(body).subarray(0, 4);
        if (!calc.every((v, i) => v === checksum[i])) {
            return { valid: false, type, network, error: 'invalid checksum' };
        }

        const result = { valid: true, type, network, spend: toHex(raw.subarray(1, 33)), view: toHex(raw.subarray(33, 65)) };
        if (type === 'Integrated') result.paymentId = toHex(raw.subarray(65, 73));
        return result;
    }

    // Standard address prefix -> integrated address prefix, per network.
    const INT_PREFIX = { 18: 19, 24: 25, 53: 54 };

    // Build an integrated address from a Standard address + an 8-byte payment ID (Uint8Array).
    // Returns { address, network } or { error }.
    function integrate(addr, paymentId) {
        const v = validate(addr);
        if (!v.valid) return { error: 'invalid address (' + v.error + ')' };
        if (v.type !== 'Standard') return { error: 'address must be a Standard address (got ' + v.type + ')' };
        if (!(paymentId instanceof Uint8Array) || paymentId.length !== 8) return { error: 'payment ID must be 8 bytes' };

        const raw = b58decode(addr.trim());
        const body = new Uint8Array(73);
        body[0] = INT_PREFIX[raw[0]];
        body.set(raw.subarray(1, 65), 1); // public spend + view keys
        body.set(paymentId, 65);
        const checksum = keccak256(body).subarray(0, 4);
        const full = new Uint8Array(77);
        full.set(body, 0);
        full.set(checksum, 73);
        return { address: b58encode(full), network: v.network };
    }

    return { validate: validate, integrate: integrate, keccak256: keccak256, b58encode: b58encode };
})();
