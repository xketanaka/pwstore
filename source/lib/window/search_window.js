const electron = require('electron');
const pwstore = require("../pwstore");
const {config} = require("../utils/config");
const Encryptor = require("../utils/encryptor");

class SearchWindow {
  get defaultSize(){ return { width: 600, height: 61 }; }

  constructor(appContext, browserWindow){
    this.appContext = appContext;

    // ブラウザウィンドウの作成 or リサイズ
    if(browserWindow){
      this.browserWindow = browserWindow;
      let [x, y] = browserWindow.getCenterPosition();
      this.browserWindow.setPosition(Math.round(x - this.defaultSize.width / 2), Math.round(y - this.defaultSize.height / 2));
      this.browserWindow.setSize(this.defaultSize.width, this.defaultSize.height);
    }else{
      this.browserWindow = this.windowManager.createBrowserWindow(Object.assign({ show: false }, this.defaultSize))
    }
    // アプリケーションのindex.htmlの読み込み
    this.browserWindow.loadURL(pwstore.viewURL("views/search_window.html"));
  }
  search(keyword, limit = 5){
    let resizeWindow = (results)=>{
      let [w, h] = this.browserWindow.getSize();
      this.browserWindow.setSize(w, this.defaultSize.height + results.length * 40);
      return results;
    };
    if(!keyword) return Promise.resolve([]).then(resizeWindow);

    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.search(keyword, limit).then(resizeWindow);
    });
  }
  copy(id, target = "password"){
console.log(`copy.target: ${target}`)
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.find(id)
    })
    .then((password)=>{
      if(!password || !password[target]) return;

      if(target.match(/password/)){
        electron.clipboard.writeText(this.appContext.encryptor.decrypt(password[target]));
      }else{
        electron.clipboard.writeText(password[target]);
      }
      return true;
    })
  }
  showOnReady(){
    this.browserWindow.show();
  }
  moveToMainWindow(){
    this.browserWindow.hide();
    this.windowManager.moveToNext("MainWindow", this.browserWindow);
  }
}

module.exports = SearchWindow;
