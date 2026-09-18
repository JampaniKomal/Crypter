# Crypter

A versatile, client-side web application that allows users to encrypt and decrypt text using a variety of classical and modern cryptographic ciphers.

**Live Demo:** [jampanikomal.github.io/Crypter/](https://jampanikomal.github.io/Crypter/)

## Features

- **Multiple Ciphers:** Implements a wide range of ciphers:
    - **Classical:** Caesar, Rail Fence, Playfair, Affine, and Hill.
    - **Modern (Symmetric):** DES, 2DES, 3DES, and AES.
- **User-Friendly Interface:** Easily switch between ciphers, with controls and key inputs dynamically updating for the selected algorithm.
- **Privacy-Focused:** All encryption and decryption operations are performed locally in your browser. No data is ever sent to a server.
- **Light/Dark Theme:** Toggle between light and dark modes for user comfort.
- **Informative Modals:** An "Info" modal provides a brief overview of each available cipher.
- **Custom Alerts:** Clean, non-blocking alerts for user guidance and error messages.
- **Responsive Design:** Fully functional on both desktop and mobile devices.

## Technologies Used

- **HTML5:** For the core structure of the application.
- **CSS3:** For modern styling, layout, and responsiveness.
- **JavaScript (with jQuery):** Powers the user interface, cipher logic, and all interactivity.
- **CryptoJS:** Used for the robust and standardized implementations of modern block ciphers (DES, 3DES, AES).

## Installation and Setup

You can run this project locally with just a few simple steps.

1.  **Clone the Repository:**
    ```sh
    git clone https://github.com/JampaniKomal/Crypter.git
    cd Crypter
    ```

2.  **Run Locally:**
    Since the project uses CDN links for jQuery and CryptoJS, you don't need to install any dependencies. Simply open the `index.html` file in your favorite web browser.

    For the best experience (to avoid any potential CORS issues with local files), it's recommended to use a local server.

    **Using the VS Code Live Server Extension:**
    - Install the "Live Server" extension from the VS Code Marketplace.
    - Right-click on `index.html` in the file explorer and select "Open with Live Server."

    **Using Python's built-in HTTP server:**
    - Navigate to the project directory in your terminal and run:
      ```sh
      python -m http.server
      ```
    - Open your browser and go to `http://localhost:8000`.

## Usage

- **Select a Cipher:** Click any button in the "Select Cipher" panel to choose an algorithm.
- **Enter Text:** Type or paste the text you want to encrypt or decrypt into the "Input Text" box.
- **Provide Key(s):** Enter the required key(s) for the selected cipher in the control section.
- **Encrypt/Decrypt:** Click the "Encrypt" or "Decrypt" button to perform the operation.
- **View Output:** The result will appear in the "Output Text" box. For modern ciphers like AES/DES, the encrypted output is a Base64 string, which should be used as the input for decryption.
- **Switch Themes:** Use the toggle switch in the top-right to change between light and dark modes.
- **Get Info:** Click the "ⓘ Info" button to learn more about the ciphers.

## Contributing

Contributions are welcome! Feel free to fork the repository, open issues, or submit pull requests for new features, bug fixes, or improvements.

## Testing & Verification

Every cipher was actually exercised in a real browser (Playwright,
served locally) rather than just read: input text was encrypted, the
ciphertext fed back in, and decrypted, checking the round trip matches
the original for all 9 ciphers (Caesar, Rail Fence, Playfair, Affine,
Hill, DES, 2DES, 3DES, AES).

That run surfaced two real bugs, both fixed:

- **2DES was completely broken.** It chained two `CryptoJS.DES.encrypt()`
  calls without converting the intermediate result to a string first,
  passing a raw `CipherParams` object as if it were plaintext. This
  threw `Invalid array length` the instant a user tried to encrypt
  anything with 2DES selected (and would have failed identically on
  decrypt). Fixed by calling `.toString()` between stages on both the
  encrypt and decrypt paths.
- **The Hill cipher's default keyword was mathematically invalid.**
  "GYBN" produces a key matrix with determinant 2 (mod 26), which
  shares a factor with 26 and therefore has no modular inverse — Hill
  cipher requires an invertible key matrix for both encryption and
  decryption. Selecting Hill and clicking Encrypt or Decrypt without
  changing the default key threw "Invalid key" immediately. Changed
  the default to "HILL" (determinant 15, invertible), verified with a
  real round trip.

Playfair's decrypted output can include an inserted filler letter
(e.g. a double letter in the input becomes `..X..` after a round
trip) — this is expected behavior of the classical Playfair cipher
itself, not a bug.

## Known Limitations

- The classical ciphers (Caesar, Affine, Hill, Playfair, Rail Fence)
  are for educational demonstration only and provide no real security.
- DES and 2DES are cryptographically broken by modern standards and
  are included for comparison/educational purposes, not as a
  recommended way to protect real data.
- No automated test suite — verification was exercising the real app
  in a real browser, not a committed `tests/` directory.

## License

This project is open source and available under the [MIT License](LICENSE).
