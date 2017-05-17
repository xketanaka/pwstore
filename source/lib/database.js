const sqlite3 = require("sqlite3");
const DBConnection = require("./db_connection");

/**
 * DBConnection のファクトリークラス
 */
class Database {
  constructor(filepath, dbEncryptionKey){
    this.filepath = filepath;
    this.dbEncryptionKey = dbEncryptionKey;
  }
  getConnection(){
    return new Promise((resolve, reject)=>{
      let db = new sqlite3.Database(this.filepath)
      db.on("error", reject);
      db.on("open", ()=>{ resolve(db) });
    })
    .then((db)=>{
      if(!this.dbEncryptionKey) return db;

      return new Promise((resolve, reject)=>{
        db.run(`PRAGMA key = '${this.dbEncryptionKey}'`, (err)=>{
          db.run("PRAGMA CIPHER = 'aes-128-cbc'", (err)=>{
            err? reject(err): resolve(db);
          });
        })
      });
    })
    .then((db)=>{
      let conn = new DBConnection(db);
      if(!this.dbInitialized){
        this.dbInitialized = true;
        return this.initialize(db).then(()=>{ return conn });
      }
      return conn;
    })
  }
  initialize(db){
    return new Promise((resolve, reject)=>{
      let query = "select count(*) from sqlite_master where type='table' and name='pwstore'";
      let create1 = `create table pwstore (
        id integer primary key autoincrement,
        service_name text,
        account text,
        account_2nd text,
        account_3rd text,
        password text,
        password_2nd text,
        password_3rd text,
        url text,
        note text,
        status integer,
        keyword text,
        category integer
      )`;
      let create2 = `create table category (
        id integer primary key autoincrement,
        name text,
        display_order integer
      )`;
      db.get(query, (err, res)=>{
        if(err) return reject(err);
        if(res['count(*)'] > 0) return resolve(db);

        db.run(create1, (err)=>{
          if(err) return reject(err);
          db.run(create2, (err)=>{
            if(err) return reject(err);
            return resolve(db);
          })
        });
      });
    })
  }
}

module.exports = Database;
