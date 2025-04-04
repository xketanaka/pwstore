const fs = require("fs");
const path = require("path");
const electron = require('electron');
const pwstore = require("../pwstore");
const {config} = require("../utils/config");
const Encryptor = require("../utils/encryptor");

class InitializeWindow {

  constructor(appContext){
    this.appContext = appContext;

    // ブラウザウィンドウの作成
    this.browserWindow = this.windowManager.createBrowserWindow({ width: 900, height: 400, frame: false })

    // htmlの読み込み
    this.browserWindow.loadURL(pwstore.viewURL("views/initialize_window.html"));
  }
  databaseFileSelect(){
    let options = {
      title: 'Choose a database file or Choose a directory to store database file(and filename of database file will be pwstore.db)',
      buttonLabel: '選択',
      properties: ['openFile', 'openDirectory', 'createDirectory'],
      filters: [
        { name: 'Passwordデータベースファイル', extensions: ['db','store', 'data', 'database'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    return electron.dialog.showOpenDialog(this.appContext.win, options)
    .then((result)=>{
      return new Promise((resolve, reject) => {
          if (!result.filePaths && result.filePaths.length == 0) {
          return reject("no selected")
        }
        let filePath = result.filePaths[0];
        fs.stat(filePath, (err, stats) => {
            if(err) {
            return reject(err)
          }
          return resolve(stats.isFile() ? filePath : path.join(filePath, "pwstore.db"));
        });
      })
    })
    .then((filepath)=>{
      config.databaseFile = filepath;
      return config.store().then(()=>{ pwstore.initialize() }).then(()=>{ return filepath })
    })
    .catch((err)=>{ if(err != "cancel") throw err })
  }
  setMasterPassword(email, passwd){
    config.encryptionKey = Encryptor.generateKey(email, passwd);
    return config.store().then(()=>{ pwstore.initialize() })
  }
  complete(){
    // 別ウィンドウを起動する（フレームありにするため）
    this.windowManager.create("MainWindow");
    this.browserWindow.close();
  }
}

module.exports = InitializeWindow;
