const fs = require("fs");
const stream = require("stream");
const crypto = require("crypto");

function showUsage(){
  console.log(
    " [Usage]:                                                       \n" +
    "         bin/decryptor.js -f <encrypted file> -o <output file>  \n");
  process.exit(1);
}

if(!module.parent){
  let options = {};
  let clArgs = process.argv.slice(2)

  if(clArgs.length != 4) showUsage();
  if((clArgs[0] == "-f" && clArgs[2] == "-o") || (clArgs[0] == "-o" && clArgs[2] == "-f")){
    options[clArgs[0]] = clArgs[1];
    options[clArgs[2]] = clArgs[3];
  }else{
    showUsage();
  }

  let encryptionKey;
  new Promise((resolve, reject)=>{
    // read passphrase from stdin
    process.stdout.write("Please input encryptionKey of input file: ")
    process.stdin.setRawMode(true);
    let reader = require('readline').createInterface({
      input: process.stdin, output: process.stdout, terminal: false
    });
    reader.on('line', (line)=>{
      encryptionKey = line;
      process.stdout.write("\n")
      reader.close();
    });
    reader.on('close', resolve);
  })
  .then(()=>{
    return new Promise((resolve, reject)=>{
      fs.readFile(options["-f"], 'utf-8', (err, data)=>{
        if(err){
          console.log(`[ERROR] fail to read file(${options["-f"]}), abort!`)
          process.exit(1);
        }else{
          resolve(data)
        }
      })
    })
  })
  .then((encrypted)=>{
    let decipher = crypto.createDecipher('aes128', encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');

    // writeFile
    fs.writeFile(options["-o"], decrypted, (err)=>{
      console.log(err ? `[ERROR] fail to write file!, err: ${err}` : `[SUCCESS] save to ${options["-o"]} ...done.`)
    })
  })
}
