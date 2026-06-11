# CypherToshi.com

Privacy-first, open-source, client-side tools and guides for cypherpunks. Everything runs in your browser, and nothing is sent to a server.

Live on the clearnet and Tor:

- Clearnet: [cyphertoshi.com](https://cyphertoshi.com)
- Tor: [d7w3gz2atjwmvxtjr32j4rwskgro7vsyxvzt4l2bivcrtbos3drkjcqd.onion](http://d7w3gz2atjwmvxtjr32j4rwskgro7vsyxvzt4l2bivcrtbos3drkjcqd.onion)

## Tools

- How Monero Works: an interactive explainer with live cryptography
- Monero: address validator, integrated address generator, mnemonic tool, node config generator
- OpenAlias: checker, generator, pay
- Crypto: payment QR generator, unit converter
- Security and self-hosting: Diceware passphrase generator, Tor config generator, SSH hardening generator

## Verifying the cryptography

The cryptographic code (Keccak-256, ed25519, and the Monero address, mnemonic, key image, subaddress, and Pedersen commitment routines) is checked against the Monero project's own test vectors. Open `/tests/` in a browser to run the full suite and confirm every value matches.

## License

- Source code: [MIT](LICENSE).
- Written content (guides, explainers, and other prose): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). You are free to share and adapt it, with attribution to CypherToshi (Tech1k) and a link back.

## Credits

- EFF long word list (EFF, CC BY 3.0 US)
- qrcode-generator (Kazuhiko Arase, MIT)
- Inter font (SIL Open Font License)
- Monero English word list and test vectors (The Monero Project)
- ed25519 hash-to-point ported from mininero (The Monero Project)
