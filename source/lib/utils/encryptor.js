const crypto = require("crypto");

class Encryptor {
  constructor(encryptionKey){
    this.encryptionKey = encryptionKey;
  }
  encrypt(string){
    let cipher = crypto.createCipher('aes128', this.encryptionKey)
    return cipher.update(string, 'utf8', 'hex') + cipher.final('hex');
  }
  decrypt(string){
    let decipher = crypto.createDecipher('aes128', this.encryptionKey);
    return decipher.update(string, 'hex', 'utf8') + decipher.final('utf8');
  }
  static generateKey(mail, pass){
    return crypto.createHash("sha1").update(`${mail}:${pass}`).digest("hex");
  }
  static generateSecretKey(mail, pass){
    return crypto.createHash("sha256").update(`${mail}:${pass}`).digest("hex");
  }
}

module.exports = Encryptor;
