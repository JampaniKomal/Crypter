/*
 * Crypter UI.
 *
 * Wiring only: theme toggle, cipher switching, the mobile "More ciphers"
 * collapser, and the encrypt/decrypt handler. All cryptographic logic lives
 * in js/ciphers.js (exposed as the global `Ciphers`).
 */
$(document).ready(function () {
    // --- Custom alert / message box ---
    var customAlertModal = $('#customAlertModal');
    var customAlertTitle = $('#customAlertTitle');
    var customAlertMessage = $('#customAlertMessage');

    var showAlert = function (title, message) {
        customAlertTitle.text(title);
        customAlertMessage.html(message); // .html() so messages may contain <br>
        customAlertModal.show();
    };

    $('.custom-alert-close-button, .custom-alert-ok-button').on('click', function () {
        customAlertModal.hide();
    });
    $(window).on('click', function (event) {
        if ($(event.target).is(customAlertModal)) customAlertModal.hide();
    });

    // --- Theme toggle ---
    var applyTheme = function (theme) {
        $('body').removeClass('dark-mode light-mode').addClass(theme);
        try { localStorage.setItem('theme', theme); } catch (e) { /* storage may be blocked */ }
    };

    $('#themeToggle').on('change', function () {
        applyTheme($(this).is(':checked') ? 'dark-mode' : 'light-mode');
    });

    var savedTheme = null;
    try { savedTheme = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
    if (savedTheme === 'light-mode') {
        $('#themeToggle').prop('checked', false);
        applyTheme('light-mode');
    } else {
        $('#themeToggle').prop('checked', true);
        applyTheme('dark-mode');
    }

    // --- Info modal ---
    var infoModal = $('#infoModal');
    $('#infoBtn').on('click', function () { infoModal.show(); });
    $('.info-close-button').on('click', function () { infoModal.hide(); });
    $(window).on('click', function (event) {
        if ($(event.target).is(infoModal)) infoModal.hide();
    });

    // --- Cipher switching ---
    var activeCipher = 'caesar';

    var showCipherTool = function (cipherName) {
        $('.cipher-buttons .btn-main').removeClass('active-cipher');
        var button = $('button[data-cipher="' + cipherName + '"]');
        button.addClass('active-cipher');
        $('#currentCipherTitle').text(button.text() + ' Cipher');

        $('.cipher-controls').removeClass('active-controls').addClass('hidden-controls');
        $('#' + cipherName + 'Controls').removeClass('hidden-controls').addClass('active-controls');

        activeCipher = cipherName;
        $('#inputText').val('');
        $('#outputText').val('');
    };

    $('.cipher-buttons button[data-cipher]').on('click', function () {
        showCipherTool($(this).data('cipher'));
    });

    // --- Mobile "More ciphers" collapser ---
    var setInitialMobileView = function () {
        if (window.innerWidth <= 768) {
            $('.extra-cipher').hide();
        } else {
            $('.extra-cipher').show();
        }
    };

    $('#moreCiphersBtn').on('click', function () {
        var btn = $(this);
        $('.extra-cipher').slideToggle('fast');
        btn.text(btn.text() === 'More Ciphers...' ? 'Show Less' : 'More Ciphers...');
    });

    // --- Encrypt / decrypt handler ---
    var handleCipherAction = function (isEncrypt) {
        var inputText = $('#inputText').val();
        var outputText = '';
        if (inputText.trim() === '') {
            showAlert('Input Missing', 'Please enter text to ' + (isEncrypt ? 'encrypt' : 'decrypt') + '.');
            return;
        }
        try {
            switch (activeCipher) {
                case 'caesar': {
                    var shiftKey = parseInt($('#shiftKey').val(), 10);
                    if (isNaN(shiftKey) || shiftKey < 1 || shiftKey > 25) {
                        showAlert('Invalid Shift Key', 'Please enter a valid shift key between 1 and 25.');
                        return;
                    }
                    outputText = Ciphers.caesarCipher(inputText, shiftKey, isEncrypt);
                    break;
                }
                case 'railfence': {
                    var railFenceKey = parseInt($('#railFenceKey').val(), 10);
                    if (isNaN(railFenceKey) || railFenceKey < 2) {
                        showAlert('Invalid Key', 'Please enter a valid key (number of rails, minimum 2).');
                        return;
                    }
                    outputText = isEncrypt
                        ? Ciphers.railFenceEncrypt(inputText, railFenceKey)
                        : Ciphers.railFenceDecrypt(inputText, railFenceKey);
                    break;
                }
                case 'playfair': {
                    var playfairKeyword = $('#playfairKeyword').val().toUpperCase().replace(/[^A-Z]/g, '');
                    if (playfairKeyword.length === 0) {
                        showAlert('Invalid Keyword', 'Please enter a valid keyword for the Playfair cipher.');
                        return;
                    }
                    outputText = Ciphers.playfairCipher(inputText, playfairKeyword, isEncrypt);
                    break;
                }
                case 'affine': {
                    var a = parseInt($('#affineA').val(), 10);
                    var b = parseInt($('#affineB').val(), 10);
                    if (isNaN(a) || isNaN(b) || Ciphers.gcd(Ciphers.mod(a, 26), 26) !== 1) {
                        showAlert('Invalid Key', "Key 'a' must be an integer coprime to 26 (e.g. 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25).");
                        return;
                    }
                    outputText = Ciphers.affineCipher(inputText, a, b, isEncrypt);
                    break;
                }
                case 'hill': {
                    var hillKeyword = $('#hillKeyword').val().toUpperCase().replace(/[^A-Z]/g, '');
                    if (hillKeyword.length !== 4) {
                        showAlert('Invalid Keyword', 'Please enter a 4-letter keyword for the Hill cipher.');
                        return;
                    }
                    outputText = Ciphers.hillCipher(inputText, Ciphers.hillKeyFromKeyword(hillKeyword), isEncrypt);
                    break;
                }
                case 'des': {
                    var desKey = $('#desKey').val();
                    if (!desKey) { showAlert('Key Missing', 'Please enter a key for DES.'); return; }
                    outputText = isEncrypt ? Ciphers.desEncrypt(inputText, desKey) : Ciphers.desDecrypt(inputText, desKey);
                    break;
                }
                case '2des': {
                    var key1 = $('#2desKey1').val();
                    var key2 = $('#2desKey2').val();
                    if (!key1 || !key2) { showAlert('Key Missing', 'Please enter both keys for 2DES.'); return; }
                    outputText = isEncrypt
                        ? Ciphers.twoDesEncrypt(inputText, key1, key2)
                        : Ciphers.twoDesDecrypt(inputText, key1, key2);
                    break;
                }
                case '3des': {
                    var tdesKey = $('#3desKey').val();
                    if (!tdesKey) { showAlert('Key Missing', 'Please enter a key for 3DES.'); return; }
                    outputText = isEncrypt
                        ? Ciphers.tripleDesEncrypt(inputText, tdesKey)
                        : Ciphers.tripleDesDecrypt(inputText, tdesKey);
                    break;
                }
                case 'aes': {
                    var aesKey = $('#aesKey').val();
                    if (!aesKey) { showAlert('Key Missing', 'Please enter a key for AES.'); return; }
                    outputText = isEncrypt ? Ciphers.aesEncrypt(inputText, aesKey) : Ciphers.aesDecrypt(inputText, aesKey);
                    break;
                }
                default:
                    showAlert('Error', 'Unknown cipher selected.');
                    return;
            }
            if (!outputText && ['des', '2des', '3des', 'aes'].indexOf(activeCipher) !== -1 && !isEncrypt) {
                throw new Error('Decryption failed. This is likely an incorrect key or corrupted ciphertext.');
            }
        } catch (e) {
            showAlert('An Error Occurred', e.message);
            return;
        }
        $('#outputText').val(outputText);
    };

    $('#encryptBtn').on('click', function () { handleCipherAction(true); });
    $('#decryptBtn').on('click', function () { handleCipherAction(false); });

    // Initial setup
    setInitialMobileView();
    showCipherTool('caesar');

    // Optional demo prefill for documentation screenshots: index.html?demo
    if (/[?&]demo(\b|=)/.test(window.location.search)) {
        showCipherTool('caesar');
        $('#shiftKey').val(3);
        $('#inputText').val('Attack at dawn');
        handleCipherAction(true);
    }
});
