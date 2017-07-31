const fs = require("fs");
const pwstore = require("../pwstore");
const electron = require('electron');
const debug = require("../utils/debug").getLogger("app");
const Encryptor = require("../utils/encryptor");
const {config} = require('../utils/config');

class MainWindow {
  get defaultSize(){ return { width: 1000, height: 600 } }

  constructor(appContext, browserWindow){
    this.appContext = appContext;

    // ブラウザウィンドウのリサイズ
    if(browserWindow){
      this.browserWindow = browserWindow;
      let [x, y] = browserWindow.getCenterPosition();
      this.browserWindow.setPosition(Math.round(x - this.defaultSize.width / 2), Math.round(y - this.defaultSize.height / 2));
      this.browserWindow.setSize(this.defaultSize.width, this.defaultSize.height)
    }else{
      // ブラウザウィンドウの作成
      this.browserWindow = this.windowManager.createBrowserWindow(Object.assign({ show: false }, this.defaultSize));
    }

    this.browserWindow.loadURL(pwstore.viewURL("views/main_window.html"));
  }
  get status(){
    return { active: 1, expired: 7, exited: 8, closed: 9 }
  }
  categories(){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return [
        { id: 1, name: "business" },
        { id: 2, name: "private" }
      ]
    })
  }
  list(category, keyword){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.searchWithCategory(keyword, category)
    })
  }
  get(id){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.find(id).then((password)=>{
        return Object.assign(password, {
          password:     this.appContext.encryptor.decrypt(password.password),
          password_2nd: this.appContext.encryptor.decrypt(password.password_2nd),
          password_3rd: this.appContext.encryptor.decrypt(password.password_3rd),
        })
      })
    })
  }
  create(){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      let blankPassword = this.appContext.encryptor.encrypt("");
      return conn.create({
        status: this.status.active,
        password: blankPassword, password_2nd: blankPassword, password_3rd: blankPassword,
      })
    })
  }
  delete(id){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.delete(id);
    })
  }
  update(id, input){
    // TODO: validation
    debug("register(input:" + JSON.stringify(input));

    // encrypt
    ['password', 'password_2nd', 'password_3rd'].filter(attrName => attrName in input).forEach((attrName)=>{
      Object.assign(input, { [attrName]: this.appContext.encryptor.encrypt(input[attrName]) });
    })

    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.update(id, input)
    })
  }
  authenticate(email, password){
    if(Encryptor.generateKey(email, password) == config.encryptionKey){
      return Promise.resolve()
    }else{
      return Promise.reject("auth failure");
    }
  }
  export(password){
    let locals = {}
    return new Promise((resolve, reject)=>{
      // choose dir
      electron.dialog.showSaveDialog(this.appContext.win, {
        title: "Export To File",
        defaultPath: "data.encrypted",
        message: "Select FilePath to Save Exported Passwords, \n" +
        "that is In JSON Format, and Encrypted by AES-128 with Your Master-Password."
      }, resolve)
    })
    .then((filename)=>{ return locals.filename = filename }).then((filename)=>{
      // export all
      if(!filename) throw "skip";
      return this.appContext.database.getConnection().then((conn)=>{ return conn.findAll() })
    })
    .then((rows)=>{
      // convert to JSON
      let rowsString = rows.map((row)=>{
        return JSON.stringify(Object.keys(row).reduce((sum,key)=>{
          if(row[key] != null){
            sum[key] = key.match(/password/) ? this.appContext.encryptor.decrypt(row[key]) : row[key];
          }
          return sum;
        }, {}));
      }).join(",\n");

      let jsonString = `{"entries":[\n${rowsString}\n]}`;
      // encrypt and save
      return new Promise((resolve, reject)=>{
        fs.writeFile(locals.filename, new Encryptor(password).encrypt(jsonString), resolve)
      })
    })
    .then((err)=>{
      if(err){
        electron.dialog.showErrorBox("Write Error", "Error has occurred in writting File.")
      }else{
        electron.dialog.showErrorBox("Save complete", `Exported to ${locals.filename}.`)
      }
    })
    .catch((err)=>{
      if(err == "skip") return;
      throw err;
    })
  }
  showOnReady(){
    this.browserWindow.show();
  }
  moveToSearchWindow(){
    this.browserWindow.hide();
    this.windowManager.moveToNext("SearchWindow", this.browserWindow);
  }
}

module.exports = MainWindow;
