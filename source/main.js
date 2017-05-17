const config = require("./lib/utils/config").initialize(`${__dirname}/config/app.ini`);
const pwstore = require("./lib/pwstore");

process.on('uncaughtException', (error)=>{
  console.error(error);
});
