
class Debug {
  static getEmptyLogger(){ return (msg)=>{ /* ignore */ }; }
  static getPrefixedLogger(prefix){ return (msg)=>{ console.log(`[${prefix}] ${msg}`) }; }
  static getLogger(name){
    if(Debug.ready[name]) return Debug.ready[name];

    if(!("target" in Debug)){
      let envString = process.env["DEBUG_LOG"] || "";
      Debug.target = envString.split(",").map(v => v.trim()).filter(v => v);
    }
    if(Debug.target.includes(name)){
      return Debug.ready[name] = Debug.getPrefixedLogger(name);
    }else{
      return Debug.ready[name] = Debug.getEmptyLogger();
    }
  }
}
Debug.ready = {};

module.exports = Debug;
