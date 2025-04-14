const crypto = require("crypto");

class Encryptor {
  constructor(encryptionKey, initVector){
    this.encryptionKey = Encryptor.toBytes(encryptionKey, 32);
    this.initVector = Encryptor.toBytes(initVector, 16);
  }
  encrypt(string){
    if (!string) return string;

    let cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, this.initVector);
    let encrypted = cipher.update(Buffer.from(string, 'utf8'))
    return Buffer.concat([encrypted, cipher.final()]).toString('hex');
  }
  decrypt(string){
    if (!string) return string;

    let decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, this.initVector);
    let decrypted = decipher.update(Buffer.from(string, 'hex'));
      return Buffer.concat([decrypted, decipher.final()]).toString('utf8');
  }
  static generateKey(mail, pass){
    return crypto.createHash("sha1").update(`${mail}:${pass}`).digest("hex");
  }

  static toBytes(string, length) {
    const fillStr = "https://github.com/xketanaka/pwstore";
    return Buffer.from(string + fillStr, 'utf8').slice(0, length)
  }
}

module.exports = Encryptor;
