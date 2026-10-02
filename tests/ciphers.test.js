'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/ciphers.js');

// --- Caesar -----------------------------------------------------------------

test('Caesar: known-answer vector (shift 3)', () => {
    assert.equal(C.caesarCipher('HELLO', 3, true), 'KHOOR');
    assert.equal(C.caesarCipher('KHOOR', 3, false), 'HELLO');
});

test('Caesar: wraps past Z/z and preserves case + punctuation', () => {
    assert.equal(C.caesarCipher('XYZ', 3, true), 'ABC');
    assert.equal(C.caesarCipher('xyz', 3, true), 'abc');
    assert.equal(C.caesarCipher('Hello, World!', 5, true), 'Mjqqt, Btwqi!');
});

test('Caesar: round-trips for every shift 1..25', () => {
    const msg = 'The Quick Brown Fox, 123!';
    for (let s = 1; s <= 25; s++) {
        assert.equal(C.caesarCipher(C.caesarCipher(msg, s, true), s, false), msg);
    }
});

// --- Rail Fence -------------------------------------------------------------

test('Rail Fence: classic textbook vector (3 rails)', () => {
    const pt = 'WEAREDISCOVEREDFLEEATONCE';
    assert.equal(C.railFenceEncrypt(pt, 3), 'WECRLTEERDSOEEFEAOCAIVDEN');
    assert.equal(C.railFenceDecrypt('WECRLTEERDSOEEFEAOCAIVDEN', 3), pt);
});

test('Rail Fence: round-trips for rails 2..6', () => {
    const pt = 'ATTACKATDAWN';
    for (let k = 2; k <= 6; k++) {
        assert.equal(C.railFenceDecrypt(C.railFenceEncrypt(pt, k), k), pt);
    }
});

// --- Playfair ---------------------------------------------------------------

test('Playfair: hand-verified digraphs with MONARCHY key', () => {
    // Matrix rows: MONAR / CHYBD / EFGIK / LPQST / UVWXZ
    assert.equal(C.playfairCipher('INSTRUMENTS', 'MONARCHY', true), 'GATLMZCLRQXA');
});

test('Playfair: round-trips on the prepared (A-Z, J->I) text', () => {
    // Even length, no adjacent duplicates -> no filler inserted, so the
    // decrypt returns the input exactly.
    const prepared = 'CRYPTO';
    const ct = C.playfairCipher(prepared, 'MONARCHY', true);
    assert.equal(C.playfairCipher(ct, 'MONARCHY', false), prepared);
});

// --- Affine -----------------------------------------------------------------

test('Affine: Wikipedia vector a=5 b=8', () => {
    assert.equal(C.affineCipher('AFFINECIPHER', 5, 8, true), 'IHHWVCSWFRCP');
    assert.equal(C.affineCipher('IHHWVCSWFRCP', 5, 8, false), 'AFFINECIPHER');
});

test('Affine: rejects a not coprime to 26', () => {
    assert.throws(() => C.affineCipher('HELLO', 13, 8, true), /coprime/);
});

test('Affine: round-trips for every valid a, with b that exceeds 26', () => {
    const coprime = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];
    for (const a of coprime) {
        // b = 40 exercises the negative-intermediate path on decrypt.
        assert.equal(C.affineCipher(C.affineCipher('HELLOWORLD', a, 40, true), a, 40, false), 'HELLOWORLD');
    }
});

// --- Hill -------------------------------------------------------------------

test('Hill: known-answer vector with key [[3,3],[2,5]]', () => {
    assert.equal(C.hillCipher('HI', [3, 3, 2, 5], true), 'TC');
    assert.equal(C.hillCipher('TC', [3, 3, 2, 5], false), 'HI');
});

test('Hill: default keyword HILL round-trips', () => {
    const key = C.hillKeyFromKeyword('HILL');
    assert.equal(C.hillCipher(C.hillCipher('HELLOWORLD', key, true), key, false), 'HELLOWORLD');
});

// Regression: before the determinant was normalised with an always-positive
// mod, keyword "BZCD" (det = 3 - 50 = -47 == 5 mod 26, which IS invertible)
// was wrongly rejected as "not invertible" because -47 + 26 = -21 stayed
// negative. It must now be accepted and round-trip.
test('Hill: regression - large-negative determinant key BZCD is accepted', () => {
    const key = C.hillKeyFromKeyword('BZCD');
    assert.doesNotThrow(() => C.hillCipher('HI', key, true));
    assert.equal(C.hillCipher(C.hillCipher('HELPME', key, true), key, false), 'HELPME');
});

test('Hill: genuinely singular key (det shares a factor with 26) is rejected', () => {
    // "GYBN" -> det 2 (mod 26), gcd(2,26)=2 -> no inverse.
    assert.throws(() => C.hillCipher('HI', C.hillKeyFromKeyword('GYBN'), true), /not invertible/);
});

// --- Modern block ciphers (CryptoJS) ---------------------------------------

test('DES: round-trips', () => {
    const ct = C.desEncrypt('Attack at dawn', 'SecretKey1');
    assert.equal(C.desDecrypt(ct, 'SecretKey1'), 'Attack at dawn');
});

test('2DES: round-trips (regression for the CipherParams toString bug)', () => {
    const ct = C.twoDesEncrypt('Attack at dawn', 'SecretKey1', 'SecretKey2');
    assert.equal(C.twoDesDecrypt(ct, 'SecretKey1', 'SecretKey2'), 'Attack at dawn');
});

test('3DES: round-trips', () => {
    const ct = C.tripleDesEncrypt('Attack at dawn', 'MyComplicatedSecretKey');
    assert.equal(C.tripleDesDecrypt(ct, 'MyComplicatedSecretKey'), 'Attack at dawn');
});

test('AES: round-trips', () => {
    const ct = C.aesEncrypt('Attack at dawn', 'MyStrongSecretKey');
    assert.equal(C.aesDecrypt(ct, 'MyStrongSecretKey'), 'Attack at dawn');
});

test('AES: wrong key yields empty UTF-8 (so the UI can flag a failure)', () => {
    const ct = C.aesEncrypt('secret', 'right-key');
    assert.equal(C.aesDecrypt(ct, 'wrong-key'), '');
});
