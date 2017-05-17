const electron = require('electron');

class BrowserWindow extends electron.BrowserWindow {
  constructor(options){ super(options) }
  get associatedWindow(){ return this._name_ }
  set associatedWindow(val){ this._name_ = val }
  getCenterPosition(){
    let [x, y] = this.getPosition(), [w, h] = this.getSize();
    return [ x + w/2, y + h/2 ];
  }
}

class WindowManager {
  static get SearchWindow(){ return require("./search_window") }
  static get InitializeWindow(){ return require("./initialize_window") }
  static get MainWindow(){ return require("./main_window") }
  static get pwstore(){ return require("../pwstore") }

  static createBrowserWindow(name, options){
    let browserWindow = new BrowserWindow(options);
//    browserWindow.openDevTools();
    browserWindow.associatedWindow = name;

    // ウィンドウが閉じられたら pwstore から解放（ウィンドウオブジェクトを参照から外す）
    browserWindow.on('closed', ()=>{
      WindowManager.pwstore.windowManager.release(browserWindow.associatedWindow)
    })
    return browserWindow;
  }
  constructor(appContext){
    this.appContext = appContext;
    this.windowContainer = new Map();
  }
  create(name, browserWindow){
    let targetConstructor = WindowManager[name];
    if(!targetConstructor.prototype.windowManager){
      targetConstructor.prototype.windowManager = {
        createBrowserWindow: (options)=>{ return WindowManager.createBrowserWindow(name, options) }
      };
      targetConstructor.prototype.windowManager.__proto__ = this;
    }
    this.windowContainer.set(name, new targetConstructor(this.appContext, browserWindow));
  }
  moveToNext(name, browserWindow){
    this.windowContainer.delete(browserWindow.associatedWindow);

    this.create(name, browserWindow);
    browserWindow.associatedWindow = name;
  }
  get(name){
    return this.windowContainer.get(name);
  }
  release(name){
    this.windowContainer.delete(name);
  }
  isNoWindow(){
    return this.windowContainer.size == 0;
  }
}

module.exports = WindowManager;
