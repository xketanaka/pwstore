const fs = require("fs");
const crypto = require("crypto");
const electron = require("electron");
const Config = require("./config");

class AppConfig {
  static initialize(iniFilePath, profile = "default"){
    this._config = JSON.parse(new Buffer(fs.readFileSync(iniFilePath, 'utf8'), 'hex').toString('utf8'));
    this._profile = profile;
    Config.initialize(this);
  }
  static get appKey(){ return this._config.appKey }
  static get profile(){ return this._profile }
  static get padding(){ return crypto.randomBytes(this._config.appKey.length).toString("hex") }
  static get userDataDir(){ return electron.app.getPath('userData') }
}

module.exports = AppConfig;
