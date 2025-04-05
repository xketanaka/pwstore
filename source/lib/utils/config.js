const fs = require("fs");
const path = require("path");
const electron = require("electron");
const Encryptor = require("./encryptor");

// configuratin 情報を保持するクラス
//
class Config {

  get profile(){ return this._profile }
  get userDataDir(){ return electron.app.getPath('userData') }
  get configFilePath(){ return path.join(this.userDataDir, `${this.profile}.conf`) } // 当クラスで扱う属性を保存するプロパティファイルパス

  constructor(){
    let buildEnvFile = `${__dirname}/../../config/build.environment`;
    this._profile = fs.existsSync(buildEnvFile) ? fs.readFileSync(buildEnvFile, 'utf8').trim() : "development";

    let buildSecretFile = `${__dirname}/../../config/build.secret`;
    let buildSecret = fs.existsSync(buildSecretFile) ? fs.readFileSync(buildSecretFile, 'utf8').trim() : "pwstore";

    // 暗号化モジュールを生成
    this.configEncryptor = new Encryptor(buildSecret, this._profile);
    // 設定値の初期化
    this.raw = {}
    // configファイルが存在する場合は読み込む
    if(fs.existsSync(this.configFilePath)){
      const encrypted = fs.readFileSync(this.configFilePath, 'utf8');
      const jsonString = Buffer.from(this.configEncryptor.decrypt(encrypted), "hex").toString('utf8');
      this.raw = JSON.parse(jsonString);
    }
  }
  store(){
    let values = Object.assign({}, this.raw);
    return new Promise((resolve, reject)=>{
      let encrypted = this.configEncryptor.encrypt(Buffer.from(JSON.stringify(values)).toString('hex'));
      fs.writeFile(this.configFilePath, encrypted, (err)=>{
        err ? reject(err) : resolve();
      })
    })
  }
  // 初期化が完了しているかどうか
  get initialized(){ return this.databaseFile && this.encryptionKey }
  // データベースファイルパス
  get databaseFile(){ return this.raw.databaseFile }
  set databaseFile(val){ this.raw.databaseFile = val }
  // 暗号化キー
  get encryptionKey(){ return this.raw.encryptionKey }
  set encryptionKey(val){ this.raw.encryptionKey = val }
}

Config.config = new Config();

module.exports = Config;
