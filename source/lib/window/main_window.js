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
      return conn.find(id).then((pwstore)=>{
        pwstore.password = this.appContext.encryptor.decrypt(pwstore.password);
        (pwstore.extras || []).filter(extra => extra.encrypted).forEach((extra)=>{
          extra.value = this.appContext.encryptor.decrypt(extra.value);
        });
        return pwstore;
      })
    })
  }
  create(){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      let blankPassword = this.appContext.encryptor.encrypt("");
      return conn.create({ status: this.status.active, password: blankPassword })
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

    return this.appContext.database.getConnection()
    .then((conn)=>{
      // encrypt
      if(input.password){
        Object.assign(input, { password: this.appContext.encryptor.encrypt(input.password) });
      }
      return conn.update(id, input)
      .then(()=>{
        return Promise.all((input.extras || []).map((extra)=>{
          if(extra.encrypted){
            Object.assign(extra, { value: this.appContext.encryptor.encrypt(extra.value) });
          }
          return conn.createExtra(id, extra.sequence_no, extra)
        }))
      })
    })
  }
  deleteExtra(id, seqNo){
    let messageContent = { message: "Delete this Extra filed, OK?", buttons: ["Cancel", "Delete!"] };
    if(electron.dialog.showMessageBox(messageContent) == 0)
      return Promise.reject("cancelled");

    seqNo = parseInt(seqNo);
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.deleteExtra(id, seqNo)
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
        let outputObj = Object.keys(row)
        .filter(key => key != "extras" && row[key] != null)
        .reduce((sum,key)=>{
          sum[key] = key == "password" ? this.appContext.encryptor.decrypt(row[key]) : row[key];
          return sum;
        }, {});

        (row.extras || []).reduce((sum, extra)=>{
          sum[`extra${extra.sequence_no}_key_name`] = extra.key_name;
          sum[`extra${extra.sequence_no}_value`] =
            extra.encrypted ? this.appContext.encryptor.decrypt(extra.value) : extra.value;
          return sum;
        }, outputObj);

        return JSON.stringify(outputObj);
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
