const electron = require('electron');
const {config} = require('./utils/config');

class PwStore {
  static get WindowManager(){ return require("./window/window_manager") }
  static get Database(){ return require("./database") }
  static get Encryptor(){ return require("./utils/encryptor") }

  constructor(app){
    this.appContext = {}
    // このイベントはElectronが初期化を終えて、ブラウザウィンドウを作成可能になった時に呼び出される。
    // 幾つかのAPIはこのイベントの後でしか使えない。
    app.on('ready', ()=>{
      this.initialize();
      this.windowManager = new PwStore.WindowManager(this.appContext);
      this.windowManager.create(config.initialized ? "SearchWindow" : "InitializeWindow");
    })
    // すべてのウィンドウが閉じられた時にアプリケーションを終了する。
    app.on('window-all-closed', ()=>{
      // 通常、macではウィンドウが全て閉じられても終了しないが、このアプリでは閉じる
      // if(process.platform !== 'darwin'){
        app.quit()
      // }
    })
    app.on('activate', ()=>{
      // macOS では、ドックをクリックされた時にウィンドウがなければ新しく作成する。
      if(this.windowManager.isNoWindow()){
        this.windowManager.create("SearchWindow");
      }
    })
  }
  initialize(force = false){
    if(!config.initialized) return;
    if(!this.appContext.database || force){
      this.appContext.database = new PwStore.Database(config.databaseFile, config.dbEncryptionKey)
    }
    if(!this.appContext.encryptor || force){
      this.appContext.encryptor = new PwStore.Encryptor(config.encryptionKey);
    }
  }
  getWindow(name){
    return this.windowManager.get(name);
  }
  viewURL(path){
    return `file://${__dirname}/../${path}`;
  }
}

module.exports = new PwStore(electron.app)
