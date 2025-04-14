const electron = require('electron');
const pwstore = require("../pwstore");
const {config} = require("../utils/config");
const Encryptor = require("../utils/encryptor");
const TOTPGenerator = require("../utils/totp_generator");

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
  search(keyword, limit = 8){
    let resizeWindow = (results)=>{
      let [w, h] = this.browserWindow.getSize();
      this.browserWindow.setSize(w, this.defaultSize.height + results.length * 40 + 4);
      return results;
    };
    if(!keyword) return Promise.resolve([]).then(resizeWindow);

    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.search(keyword, limit).then(resizeWindow);
    });
  }
  copy(id, target = "password"){
    return this.appContext.database.getConnection()
    .then((conn)=>{
      return conn.find(id)
    })
    .then((pwstore)=>{
      if(!pwstore || !pwstore[target]) return { status: false };

      if(target.match(/password/)){
        electron.clipboard.writeText(this.appContext.encryptor.decrypt(pwstore[target]));
      }else if(target.match(/otp_uri/)){
        let uri = new URL(this.appContext.encryptor.decrypt(pwstore[target]));
        let totp = new TOTPGenerator(uri.searchParams.get('secret'));
        electron.clipboard.writeText(totp.totp());
      }else{
        electron.clipboard.writeText(pwstore[target]);
      }
      return { status: true, hasNext: target == "account" || (target == "password" && pwstore.otp_uri) };
    })
  }
  showOnReady(){
    this.browserWindow.show();
  }
  hide(){
    let [w, h] = this.browserWindow.getSize();
    this.browserWindow.setSize(w, this.defaultSize.height);
    this.browserWindow.minimize();
  }
  moveToMainWindow(options){
    this.browserWindow.hide();
    this.windowManager.moveToNext("MainWindow", this.browserWindow, options);
  }
}

module.exports = SearchWindow;
