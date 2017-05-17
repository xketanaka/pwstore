const fs = require("fs");
const path = require("path");
const electron = require("electron");
const crypto = require("crypto");

class AppConfig {
  static get appKey(){ return AppConfig.config.appKey }
  static get padding(){ return crypto.randomBytes(this.appKey.length).toString("hex") }
}

class Private {
  static encrypt(str){
    let cipher = crypto.createCipher('aes128', AppConfig.appKey);
    return cipher.update(str, 'utf8', 'hex') + cipher.final('hex');
  }
  static decrypt(str){
    let decipher = crypto.createDecipher('aes128', AppConfig.appKey);
    return decipher.update(str, 'hex', 'utf8') + decipher.final('utf8');
  }
}

class Config {
  static get filePath(){ return path.join(electron.app.getPath('userData'), "app.conf") }
  static initialize(filename){
    AppConfig.config = JSON.parse(new Buffer(fs.readFileSync(filename, 'utf8'), 'hex').toString('utf8'));
    Config.config = new Config();
  }
  constructor(){
    // configファイルが存在しない
    if(!fs.existsSync(Config.filePath)){
      this.raw = {}
    }
    else {
      // configファイルの読込み
      this.raw = JSON.parse(new Buffer(fs.readFileSync(Config.filePath, 'utf8'), "hex").toString('utf8'));
      if(this.raw.encryptionKey){
        this.raw.encryptionKey = Private.decrypt(this.raw.encryptionKey);
      }
      if(this.raw.dbEncryptionKey){
        this.raw.dbEncryptionKey = Private.decrypt(this.raw.dbEncryptionKey);
      }
    }
  }
  store(){
    let values = Object.assign({}, this.raw);
    if(this.encryptionKey){
      values.encryptionKey = Private.encrypt(this.raw.encryptionKey)
    }
    if(this.dbEncryptionKey){
      values.dbEncryptionKey = Private.encrypt(this.raw.dbEncryptionKey)
    }
    return new Promise((resolve, reject)=>{
      fs.writeFile(Config.filePath, new Buffer(JSON.stringify(values)).toString('hex'), (err)=>{
        err ? reject(err) : resolve();
      })
    })
  }
  get initialized(){ return this.databaseFile && this.encryptionKey }
  get databaseFile(){ return this.raw.databaseFile }
  set databaseFile(val){ this.raw.databaseFile = val }
  get encryptionKey(){ let k = this.raw.encryptionKey; return k && k.slice(AppConfig.padding.length) }
  set encryptionKey(val){ this.raw.encryptionKey = `${AppConfig.padding}${val}` }
  get dbEncryptionKey(){ let k = this.raw.dbEncryptionKey; return k && k.slice(AppConfig.padding.length) }
  set dbEncryptionKey(val){ this.raw.dbEncryptionKey = `${AppConfig.padding}${val}` }
}

module.exports = Config;
