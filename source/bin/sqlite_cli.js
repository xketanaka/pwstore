const fs = require("fs");
const crypto = require("crypto");
const electron = require("electron");

let profile = process.argv.slice(2)
  .reduce((prof, v)=>{ return prof ? (v == "--profile" ? undefined : prof) : v }, "default");


let iniFileContent = fs.readFileSync(`${__dirname}/../config/app.ini`, 'utf8');
let ini = JSON.parse(new Buffer(iniFileContent, 'hex').toString('utf8'))

const Config = require("../lib/utils/config");
Config.initialize({
  profile: profile,
  appKey: ini.appKey,
  padding: crypto.randomBytes(ini.appKey.length).toString("hex"),
  userDataDir: electron.app.getPath('userData').replace(/\/Electron/, "/pwstore")
});

const Database = require('../lib/database');
const DBConnection = require('../lib/db_connection');

process.stdout.write(`connected to [${Config.config.databaseFile}] ....`)

new Database(Config.config.databaseFile, Config.config.dbEncryptionKey)
.getConnection().then((connection)=>{
  process.stdout.write("SUCCESS!\n");

  const reader = require('readline').createInterface({ input: process.stdin, output: process.stdout });

  let queryInvokeFunction = (resolve, reject)=>{
    reader.question('slite3 > ', (sql)=>{
      if(!sql.trim().match(/^select/i)) return connection.runAsPromise(sql).then(resolve);

      connection.allAsPromise(sql).then((rows)=>{
        if(!rows || !rows[0]){ console.log("empty set."); return resolve() }

        let strLength = (str)=>{
          str = String(str);
          return str.split("").map((v,i)=>{ return str.charCodeAt(i) }).reduce((sum, c)=>{
            sum += ((c >= 0x0 && c < 0x81) ||
                    (c == 0xf8f0) ||
                    (c >= 0xff61 && c < 0xffa0) ||
                    (c >= 0xf8f1 && c < 0xf8f4)) ? 1 : 2;
            return sum;
          }, 0)
        }
        let padRight = (v, cnt, padChar = " ")=>{
          v = String(v);
          let len = strLength(v);
          return (v + Array(cnt).fill(padChar).join("")).substring(0, v.length + (cnt - len));
        }
        // 表示する桁数の計算
        let columnSizes = {}
        Object.keys(rows[0]).forEach((key)=>{
          columnSizes[key] = Math.max.apply(null, rows.map(row => strLength(row[key]))) + 1;
          if(columnSizes[key] < (key.length+1)) columnSizes[key] = key.length + 1;
        })
        // 列名を出力
        console.log("|" + Object.keys(rows[0]).map(key => `${padRight(key, columnSizes[key])}|`).join(""));
        console.log("|" + Object.keys(rows[0]).map(key => `${padRight("", columnSizes[key], "-")}|`).join(""));

        rows.forEach((row)=>{
          console.log("|" + Object.keys(row).map((key)=>{
            let v = typeof row[key] == "string" ? row[key].replace(/\n/g, "\\n"): row[key];
            return `${padRight(v, columnSizes[key])}|`;
          }).join(""))
        })
        console.log("|" + Object.keys(rows[0]).map(key => `${padRight("", columnSizes[key], "-")}|`).join(""));
        resolve();
      })
    })
  };
  let displayNextPrompt = (promise)=>{
    return promise.then(()=>{ return displayNextPrompt(new Promise(queryInvokeFunction)) })
  };
  return displayNextPrompt(new Promise(queryInvokeFunction));
})
