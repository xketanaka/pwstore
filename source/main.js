const isDev = process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);
const argv = process.argv.slice(isDev ? 2 : 1);

let profile = argv.reduce((prof, v)=>{ return prof ? (v == "--profile" ? undefined : prof) : v }, "default");

const config = require("./lib/utils/app_config").initialize(`${__dirname}/config/app.ini`, profile);
const pwstore = require("./lib/pwstore");

process.on('uncaughtException', (error)=>{
  console.error(error);
});
