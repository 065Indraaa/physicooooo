importScripts("libsodium-wrappers.min.js");

(async () => {
  await sodium.ready;

  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function decodeBase58(str) {
    let bytes = [0];
    for (let c of str) {
      const val = ALPHABET.indexOf(c);
      if (val < 0) throw new Error("Invalid Base58");
      let carry = val;
      for (let i = 0; i < bytes.length; i++) {
        carry += bytes[i] * 58;
        bytes[i] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }
    bytes.reverse();
    return new Uint8Array(bytes);
  }

  function hexFromBigInt(bi) {
    let h = bi.toString(16);
    return h.padStart(64, "0");
  }

  onmessage = async (e) => {
    const { cmd, targetBase58, workerId, step } = e.data;
    if (cmd !== "start") return;

    const targetBytes = decodeBase58(targetBase58);
    const seed = new Uint8Array(32);

    let checked = 0;
    let bi = BigInt(workerId + 1); // worker start offset

    while (true) {
      // isi seed dengan hex dari BigInt
      const hex = hexFromBigInt(bi);
      for (let i = 0; i < 32; i++) {
        seed[i] = parseInt(hex.substr(i * 2, 2), 16);
      }

      // derive keypair
      const kp = sodium.crypto_sign_seed_keypair(seed);
      const pub = kp.publicKey;

      // compare langsung bytes
      let same = pub.length === targetBytes.length;
      for (let i = 0; i < pub.length && same; i++) {
        if (pub[i] !== targetBytes[i]) same = false;
      }
      if (same) {
        // encode base58 hanya jika ketemu
        postMessage({
          type: "found",
          seedHex: hex,
          pubkeyBase58: targetBase58
        });
        return;
      }

      checked++;
      if (checked % 1000 === 0) {
        postMessage({ type: "progress", count: 1000 });
      }

      bi += BigInt(step);
    }
  };
})();
