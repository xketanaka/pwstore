const crypto = require('crypto');
const base32Decode = require('base32-decode');
const REFRESH_INTERVAL_SEC = 30;

class TOTPGenerator {
  /**
   * @param {String} key  shared secret between client and server, base32 encoded string
   * @param {Number} output_digit
   * @param {Number} refresh_interval
   */
  constructor(key, { output_digit, refresh_interval } = {}) {
    this.key = Buffer.from(base32Decode(key, 'RFC4648'));
    this.output_digit = output_digit || 6;
    this.refresh_interval = refresh_interval || REFRESH_INTERVAL_SEC;
  }
  /**
   * Calculate TOTP value defined in [RFC6238](https://tools.ietf.org/html/rfc6238)
   *
   * @return {string} "output_digit" decimal TOTP value
   */
  totp() {
    // count TIME_STEP from base Unix Time
    const counter = Math.floor(new Date().getTime() / 1000 / this.refresh_interval);

    return this.hotp(counter);
  }
  /**
   * Calculate HOTP value defined in [RFC4226](https://tools.ietf.org/html/rfc4226).
   *
   * @param {number} counter   counter value
   * @return {string} "output_digit" decimal HOTP value
   */
  hotp(counter) {
    // pack counter to 8 Byte buffer in big-endian
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter/2**32), 0); // high 4 bytes
    buf.writeUInt32BE(counter, 4); // low 4 bytes

    // calculate
    const data = (function hmacsha1(key, buf) {
      const hmac = crypto.createHmac('sha1', key);
      hmac.update(buf);
      return hmac.digest();
    })(this.key, buf);

    // truncate
    const val = (function trunc(data, output_digit) {
      const offset = data[data.length-1] & 0x0f; // last 4bit of data, so offset is 0-15

      // get last 31bits of data[offset]...data[offset+3];
      const code = data.readUInt32BE(offset) & 0x7fffffff;

      return code % 10**output_digit;
    })(data, this.output_digit);

    return val.toString().padStart(this.output_digit, '0');
  }
}

module.exports = TOTPGenerator;