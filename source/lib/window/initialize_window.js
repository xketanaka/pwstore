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
      title: 'Choose a database file or Choose a directory to store database file(and filename of database file will be pwstore.sqlite)',
      buttonLabel: '選択',
      properties: ['openFile', 'openDirectory', 'createDirectory'],
      filters: [
        { name: 'SQLiteデータベースファイル', extensions: ['db','sqlite', 'sqlite3', 'database'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    return new Promise((resolve, reject)=>{
      electron.dialog.showOpenDialog(this.appContext.win, options, (files)=>{
        if(!files) reject("cancel")
        fs.stat(files[0], (err, stats)=>{
          if(err) reject(err);
          resolve(stats.isFile() ? files[0] : path.join(files[0], "store.sqlite"));
        })
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
    config.dbEncryptionKey = Encryptor.generateSecretKey(email, passwd);
    return config.store().then(()=>{ pwstore.initialize() })
  }
  complete(){
    // 別ウィンドウを起動する（フレームありにするため）
    this.windowManager.create("MainWindow");
    this.browserWindow.close();
  }
}

module.exports = InitializeWindow;
