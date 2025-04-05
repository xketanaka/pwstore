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
      return conn.categories();
    })
  }
  addCategory(name){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.createCategory(name);
    })
  }
  updateCategory(id, name){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.updateCategory(id, name)
    })
  }
  deleteCategory(id){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.searchWithCategory(undefined, id)
      .then((rows)=>{
        if(!rows || rows.length == 0){
          return conn.deleteCategory(id);
        }
        electron.dialog.showErrorBox("Not Removable", "You could not remove This category, because it has password items")
        throw "disallow";
      })
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
      if('password' in input){
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
    // choose dir
    return electron.dialog.showSaveDialog(this.appContext.win, {
      title: "Export To File",
      defaultPath: "data.encrypted",
      message: "Select FilePath to Save Exported Passwords, \n" +
        "that is In JSON Format, and Encrypted by AES-256-CBC with Your Master-Password."
    })
    .then((result)=>{ return locals.filename = result.filePath }).then((filename)=>{
      // export all
      if(!filename) throw "skip";
      return this.categories()
    })
    .then((categories)=>{ return locals.categories = categories }).then(()=>{
      return this.appContext.database.getConnection().then((conn)=>{ return conn.findAll() })
    })
    .then((rows)=>{
      // convert to JSON
      let rowsString = rows.map((row)=>{
        let outputObj = Object.keys(row)
        .filter(key => key != "extras" && row[key] != null)
        .reduce((sum,key)=>{
          switch(key){
            case "password": sum[key] = this.appContext.encryptor.decrypt(row[key]); break;
            case "category": sum[key] = locals.categories.find(c => c.id == row[key]).name; break;
            default: sum[key] = row[key];
          }
          return sum;
        }, {});

        (row.extras || []).reduce((sum, extra)=>{
          sum[`extra${extra.sequence_no}_key_name`] = extra.key_name;
          sum[`extra${extra.sequence_no}_value`] =
            extra.encrypted ? this.appContext.encryptor.decrypt(extra.value) : extra.value;
          sum[`extra${extra.sequence_no}_encrypted`] = extra.encrypted;
          return sum;
        }, outputObj);

        return JSON.stringify(outputObj);
      }).join(",\n");

      let jsonString = `{"entries":[\n${rowsString}\n]}`;
      // encrypt and save
      return new Promise((resolve, reject)=>{
        fs.writeFile(locals.filename, new Encryptor(password, config.profile).encrypt(jsonString), resolve)
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
  import(){
    let options = {
      title: 'Choose a JSON file which contains Password info',
      buttonLabel: '選択',
    };
    let connection, parsedObject, categories = {};
    return electron.dialog.showOpenDialog(this.appContext.win, options)
    .then((result) => {
      return new Promise((resolve, reject) => {
          if (!result.filePaths && result.filePaths.length == 0) {
          return reject("no selected")
        }
        let filePath = result.filePaths[0];
        fs.stat(filePath, (err, stats)=>{ if(err) reject(err); else resolve(filePath); })
      })
    })
    .then((filepath)=>{
      return new Promise((resolve, reject)=>{
        fs.readFile(filepath, 'utf8', (err, data)=>{
          try {
            err ? reject(err) : resolve(JSON.parse(data));
          }catch(e){
            reject(()=>{ electron.dialog.showErrorBox("Parse Error", "Selected File is not a JSON Format.") })
          }
        })
      })
    })
    .then((object)=>{ parsedObject = object }).then(()=>{
      // clean DB
      return this.appContext.database.getConnection()
      .then((conn)=>{ connection = conn }).then(()=>{ return connection.beforeImport() })
    })
    .then(()=>{
      // import all!
      return parsedObject.entries.reduce((promise, entry)=>{
        return promise.then(()=>{
          function categoryNameToCategoryId(entry){
            if(!("category" in entry)) return Promise.resolve(entry);
            if(entry.category in categories){
              return Promise.resolve(entry.category = categories[entry.category]);
            }
            return connection.createCategory(entry.category)
            .then((id)=>{ entry.category = categories[entry.category] = id })
          }
          return categoryNameToCategoryId(entry)
          .then(()=>{
            if("password" in entry){
              entry.password = this.appContext.encryptor.encrypt(entry.password);
            }
            return connection.create(entry)
          })
          .then((id)=>{
            let promises = [];
            for(let i = 1; true; i++){
              if(!(`extra${i}_key_name` in entry)) break;
              let values = { key_name: entry[`extra${i}_key_name`], encrypted: entry[`extra${i}_encrypted`] };
              let val = entry[`extra${i}_value`];
              values.value = values.encrypted == 1 ? this.appContext.encryptor.encrypt(val) : val;
              promises.push(connection.createExtra(id, i, values));
            }
            return Promise.all(promises);
          })
        })
      }, Promise.resolve());
    })
    .catch((err)=>{
      if(typeof err === "function") return err(); else throw err;
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
