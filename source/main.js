
const pwstore = require("./lib/pwstore");

process.on('uncaughtException', (error)=>{
  console.error(error);
});
