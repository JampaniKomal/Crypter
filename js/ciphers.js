/*
 * Crypter cipher engine.
 *
 * All cipher logic lives here so it can be exercised both in the browser
 * (loaded as a plain <script>, exposing a global `Ciphers`) and under Node
 * (via `require`), which is what the automated test suite does.
 *
 * The classical ciphers (Caesar, Rail Fence, Playfair, Affine, Hill) are
 * self-contained and have no dependencies. The modern block ciphers
 * (DES, 2DES, 3DES, AES) delegate to CryptoJS, which the browser loads from
 * a CDN and Node pulls in with `require('crypto-js')`.
 */
(function (global, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        global.Ciphers = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Resolve CryptoJS from whatever environment we are in. In the browser it
    // is a global (loaded before this file); under Node it is a module. The
    // classical ciphers work without it, so a missing CryptoJS is tolerated
    // until a block cipher is actually called.
    var CryptoJS = (function () {
        if (typeof window !== 'undefined' && window.CryptoJS) return window.CryptoJS;
        if (typeof self !== 'undefined' && self.CryptoJS) return self.CryptoJS;
        if (typeof global !== 'undefined' && global.CryptoJS) return global.CryptoJS;
        try { return require('crypto-js'); } catch (e) { return null; }
    })();

    function requireCrypto() {
        if (!CryptoJS) {
            throw new Error('CryptoJS is not available; the block ciphers (DES, 2DES, 3DES, AES) need it.');
        }
        return CryptoJS;
    }

    // --- Math helpers ---

    // Always-positive modulo. JavaScript's % keeps the sign of the dividend,
    // so (-47 % 26) is -21, not 5. Every modular step below goes through this
    // so that negative intermediate values (e.g. a Hill determinant) are
    // normalised into [0, m) correctly.
    var mod = function (n, m) {
        return ((n % m) + m) % m;
    };

    var gcd = function (a, b) {
        return b === 0 ? a : gcd(b, a % b);
    };

    // Modular multiplicative inverse of a (mod m), or null if none exists.
    var modInverse = function (a, m) {
        a = mod(a, m);
        for (var x = 1; x < m; x++) {
            if (mod(a * x, m) === 1) return x;
        }
        return null;
    };

    // --- Classical ciphers ---

    var caesarCipher = function (text, shift, encrypt) {
        if (encrypt === undefined) encrypt = true;
        var result = '';
        shift = mod(shift, 26);
        if (!encrypt) shift = mod(26 - shift, 26);
        for (var i = 0; i < text.length; i++) {
            var code = text.charCodeAt(i);
            if (code >= 65 && code <= 90) {
                result += String.fromCharCode(((code - 65 + shift) % 26) + 65);
            } else if (code >= 97 && code <= 122) {
                result += String.fromCharCode(((code - 97 + shift) % 26) + 97);
            } else {
                result += text.charAt(i);
            }
        }
        return result;
    };

    var railFenceEncrypt = function (text, key) {
        if (key <= 1) return text;
        var rails = [];
        for (var r = 0; r < key; r++) rails.push([]);
        var rail = 0, direction = 1;
        for (var i = 0; i < text.length; i++) {
            rails[rail].push(text[i]);
            rail += direction;
            if (rail === 0 || rail === key - 1) direction *= -1;
        }
        return rails.map(function (row) { return row.join(''); }).join('');
    };

    var railFenceDecrypt = function (cipher, key) {
        if (key <= 1) return cipher;
        var railLengths = new Array(key).fill(0);
        var rail = 0, direction = 1, i;
        for (i = 0; i < cipher.length; i++) {
            railLengths[rail]++;
            rail += direction;
            if (rail === 0 || rail === key - 1) direction *= -1;
        }
        var rails = [];
        var idx = 0;
        for (var k = 0; k < railLengths.length; k++) {
            rails.push(cipher.substring(idx, idx + railLengths[k]).split(''));
            idx += railLengths[k];
        }
        var result = '';
        rail = 0;
        direction = 1;
        for (i = 0; i < cipher.length; i++) {
            result += rails[rail].shift();
            rail += direction;
            if (rail === 0 || rail === key - 1) direction *= -1;
        }
        return result;
    };

    var playfairCipher = function (text, keyword, encrypt) {
        if (encrypt === undefined) encrypt = true;

        var generateKeyMatrix = function (key) {
            var alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // classic Playfair drops J
            var processed = '';
            var upper = key.toUpperCase(), c;
            for (var p = 0; p < upper.length; p++) {
                c = upper[p];
                if (c >= 'A' && c <= 'Z' && c !== 'J' && processed.indexOf(c) === -1) {
                    processed += c;
                }
            }
            for (var a = 0; a < alphabet.length; a++) {
                c = alphabet[a];
                if (processed.indexOf(c) === -1) processed += c;
            }
            var matrix = [];
            for (var r = 0; r < 5; r++) {
                matrix.push(processed.substring(r * 5, r * 5 + 5).split(''));
            }
            return matrix;
        };

        var findCharPos = function (matrix, ch) {
            for (var r = 0; r < 5; r++) {
                for (var c = 0; c < 5; c++) {
                    if (matrix[r][c] === ch) return { r: r, c: c };
                }
            }
            return null;
        };

        var prepared = text.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
        var digraphs = [];
        for (var i = 0; i < prepared.length; i += 2) {
            var c1 = prepared[i];
            var c2 = (i + 1 < prepared.length) ? prepared[i + 1] : 'X';
            if (c1 === c2) {
                c2 = 'X';
                i--; // reprocess the repeated letter as the start of the next pair
            }
            digraphs.push([c1, c2]);
        }

        var keyMatrix = generateKeyMatrix(keyword);
        var out = [];
        var dir = encrypt ? 1 : -1;
        for (var d = 0; d < digraphs.length; d++) {
            var pos1 = findCharPos(keyMatrix, digraphs[d][0]);
            var pos2 = findCharPos(keyMatrix, digraphs[d][1]);
            var n1, n2;
            if (pos1.r === pos2.r) {
                n1 = keyMatrix[pos1.r][mod(pos1.c + dir, 5)];
                n2 = keyMatrix[pos2.r][mod(pos2.c + dir, 5)];
            } else if (pos1.c === pos2.c) {
                n1 = keyMatrix[mod(pos1.r + dir, 5)][pos1.c];
                n2 = keyMatrix[mod(pos2.r + dir, 5)][pos2.c];
            } else {
                n1 = keyMatrix[pos1.r][pos2.c];
                n2 = keyMatrix[pos2.r][pos1.c];
            }
            out.push(n1, n2);
        }
        return out.join('');
    };

    var affineCipher = function (text, a, b, encrypt) {
        if (encrypt === undefined) encrypt = true;
        if (gcd(mod(a, 26), 26) !== 1) {
            throw new Error("Affine key 'a' must be coprime to 26.");
        }
        text = text.toUpperCase().replace(/[^A-Z]/g, '');
        var result = '';
        var i, code;
        if (encrypt) {
            for (i = 0; i < text.length; i++) {
                code = text.charCodeAt(i) - 65;
                result += String.fromCharCode(mod(a * code + b, 26) + 65);
            }
        } else {
            var aInv = modInverse(a, 26);
            for (i = 0; i < text.length; i++) {
                code = text.charCodeAt(i) - 65;
                result += String.fromCharCode(mod(aInv * (code - b), 26) + 65);
            }
        }
        return result;
    };

    // Convert a 4-letter keyword into the numeric 2x2 key the Hill cipher uses.
    var hillKeyFromKeyword = function (keyword) {
        var cleaned = keyword.toUpperCase().replace(/[^A-Z]/g, '');
        if (cleaned.length !== 4) {
            throw new Error('Hill cipher needs a 4-letter keyword for a 2x2 key.');
        }
        return cleaned.split('').map(function (c) { return c.charCodeAt(0) - 65; });
    };

    var hillCipher = function (text, key, encrypt) {
        if (encrypt === undefined) encrypt = true;
        var keyMatrix = [[key[0], key[1]], [key[2], key[3]]];
        // Normalise the determinant into [0, 26) with the always-positive mod.
        var det = mod(keyMatrix[0][0] * keyMatrix[1][1] - keyMatrix[0][1] * keyMatrix[1][0], 26);
        var detInv = modInverse(det, 26);
        if (detInv === null) {
            throw new Error('Invalid key: the key matrix is not invertible (mod 26). Its determinant is not coprime to 26.');
        }
        var matrix = keyMatrix;
        if (!encrypt) {
            var adj = [
                [keyMatrix[1][1], mod(-keyMatrix[0][1], 26)],
                [mod(-keyMatrix[1][0], 26), keyMatrix[0][0]]
            ];
            matrix = [
                [mod(adj[0][0] * detInv, 26), mod(adj[0][1] * detInv, 26)],
                [mod(adj[1][0] * detInv, 26), mod(adj[1][1] * detInv, 26)]
            ];
        }
        text = text.toUpperCase().replace(/[^A-Z]/g, '');
        if (text.length % 2 !== 0) text += 'X';
        var result = '';
        for (var i = 0; i < text.length; i += 2) {
            var v1 = text.charCodeAt(i) - 65;
            var v2 = text.charCodeAt(i + 1) - 65;
            var o1 = mod(matrix[0][0] * v1 + matrix[0][1] * v2, 26);
            var o2 = mod(matrix[1][0] * v1 + matrix[1][1] * v2, 26);
            result += String.fromCharCode(o1 + 65) + String.fromCharCode(o2 + 65);
        }
        return result;
    };

    // --- Modern block ciphers (CryptoJS, passphrase mode) ---

    var desEncrypt = function (text, key) {
        return requireCrypto().DES.encrypt(text, key).toString();
    };
    var desDecrypt = function (cipher, key) {
        var C = requireCrypto();
        return C.DES.decrypt(cipher, key).toString(C.enc.Utf8);
    };

    // 2DES = DES(k2, DES(k1, text)). The intermediate CipherParams must be
    // serialised with toString() before it is fed back in as plaintext,
    // otherwise CryptoJS throws "Invalid array length".
    var twoDesEncrypt = function (text, key1, key2) {
        var C = requireCrypto();
        var stage1 = C.DES.encrypt(text, key1).toString();
        return C.DES.encrypt(stage1, key2).toString();
    };
    var twoDesDecrypt = function (cipher, key1, key2) {
        var C = requireCrypto();
        var stage1 = C.DES.decrypt(cipher, key2).toString(C.enc.Utf8);
        return C.DES.decrypt(stage1, key1).toString(C.enc.Utf8);
    };

    var tripleDesEncrypt = function (text, key) {
        return requireCrypto().TripleDES.encrypt(text, key).toString();
    };
    var tripleDesDecrypt = function (cipher, key) {
        var C = requireCrypto();
        return C.TripleDES.decrypt(cipher, key).toString(C.enc.Utf8);
    };

    var aesEncrypt = function (text, key) {
        return requireCrypto().AES.encrypt(text, key).toString();
    };
    var aesDecrypt = function (cipher, key) {
        var C = requireCrypto();
        return C.AES.decrypt(cipher, key).toString(C.enc.Utf8);
    };

    return {
        mod: mod,
        gcd: gcd,
        modInverse: modInverse,
        caesarCipher: caesarCipher,
        railFenceEncrypt: railFenceEncrypt,
        railFenceDecrypt: railFenceDecrypt,
        playfairCipher: playfairCipher,
        affineCipher: affineCipher,
        hillCipher: hillCipher,
        hillKeyFromKeyword: hillKeyFromKeyword,
        desEncrypt: desEncrypt,
        desDecrypt: desDecrypt,
        twoDesEncrypt: twoDesEncrypt,
        twoDesDecrypt: twoDesDecrypt,
        tripleDesEncrypt: tripleDesEncrypt,
        tripleDesDecrypt: tripleDesDecrypt,
        aesEncrypt: aesEncrypt,
        aesDecrypt: aesDecrypt
    };
});
