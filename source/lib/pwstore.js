const electron = require('electron');
const {config} = require('./utils/config');
const isDev = process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);

class PwStore {
  static get WindowManager(){ return require("./window/window_manager") }
  static get Database(){ return require("./database") }
  static get Encryptor(){ return require("./utils/encryptor") }

  constructor(app){
    this.appContext = {}
    // このイベントはElectronが初期化を終えて、ブラウザウィンドウを作成可能になった時に呼び出される。
    // 幾つかのAPIはこのイベントの後でしか使えない。
    app.on('ready', ()=>{
      // productionモードの場合は用意したメニューを表示(開発モードはデフォルトのメニューを使用)
      if(!isDev){
        electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate([
          {
            label: app.getName(),
            submenu: [{ role: "about" },{ type: 'separator' }, { role: 'quit' }]
          },
          {
            label: "Edit",
            submenu: [
              { role: 'undo' },
              { role: 'redo' },
              { type: "separator" },
              { role: 'cut' },
              { role: 'copy' },
              { role: 'paste' }
            ]
          }
        ]));
      }
      this.initialize();
      this.windowManager = new PwStore.WindowManager(this.appContext);
      this.windowManager.create(config.initialized ? "SearchWindow" : "InitializeWindow");
    })
    app.on('window-all-closed', ()=>{ app.quit() });
  }
  initialize(force = false){
    if(!config.initialized) return;
    if(!this.appContext.database || force){
      if(config.databaseFile && config.dbEncryptionKey){
        this.appContext.database = new PwStore.Database(config.databaseFile, config.dbEncryptionKey)
      }
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
