const debug = require("./utils/debug").getLogger("query");

class DBConnection {
  constructor(db){
    this.db = db;
  }
  searchImpl(word, condition, limit){
    let query = "SELECT * FROM pwstore WHERE (service_name LIKE ? ESCAPE '#' OR keyword LIKE ? ESCAPE '#')";
    let keyword = `%${word.replace(/'/g, "''").replace(/([%_#])/g, "#$1")}%`;
    let params = [ keyword, keyword ]

    if(condition.category){
      query += "AND category = ?";
      params.push(condition.category)
    }
    if(condition.status){
      query += "AND status = ?";
      params.push(condition.status)
    }

    return this.allAsPromise(query, params)
    .then((rows)=>{
      let wordLower = word.toLowerCase();
      // ソート用のスコアを算出するファンクション
      let sortScore = (row)=>{
        // 大文字小文字を区別しない
        let serviceName = row["service_name"].toLowerCase();
        let keywords = (row["keyword"] || "").split(" ").map(kw => kw.toLowerCase());
        // 優先度が高いほうがスコアは小
        if(serviceName == wordLower) return 1;
        if(keywords.some(kw => kw == wordLower)) return 2;
        if(serviceName.match(new RegExp("^" + wordLower))) return 3;
        if(keywords.some(kw => kw.match(new RegExp("^" + wordLower)))) return 4;
        if(serviceName.match(new RegExp(wordLower))) return 5;
        if(keywords.some(kw => kw.match(new RegExp(wordLower)))) return 6;
        return 7;
      }
      let sorted = rows.sort((rowA, rowB)=>{ return sortScore(rowA) - sortScore(rowB) })
      return limit ? sorted.slice(0, limit) : sorted;
    })
  }
  search(word, limit){
    return this.searchImpl(word, { status: 1 }, limit)
  }
  searchWithCategory(word, category){
    if(word) return this.searchImpl(word, { category: category });

    let query = `SELECT * FROM pwstore ${category ? "WHERE category = ?" : ""}
                 ORDER BY lower(service_name), lower(account)`;
    return this.allAsPromise(query, category ? [ category ] : [])
  }
  find(id){
    return this.allAsPromise("SELECT * FROM pwstore WHERE id = ?", [ id ])
    .then((rows)=>{
      if(rows && rows[0]){
        return this.findExtra(rows[0]);
      }
    })
  }
  findAll(){
    return this.allAsPromise("SELECT * FROM pwstore ORDER BY id")
    .then((rows)=>{
      return Promise.all(rows.map((row)=>{ return this.findExtra(row) }));
    })
  }
  findExtra(row){
    let sql = "SELECT * FROM pwstore_extra where pwstore_id = $id ORDER BY sequence_no";
    return this.allAsPromise(sql, { $id: row.id })
    .then((extras)=>{ row.extras = extras; return row })
  }
  create(values){
    let columns = this.getEditableColumns();
    return this.runAsPromise(
      `INSERT INTO pwstore (${columns.join(",")}) values (${columns.map(c => "?").join(",")})`,
      columns.map(c => values[c])
    )
    .then((statement)=>{ return statement.lastID })
  }
  update(id, values){
    let targetColumns = Object.keys(values).filter(k => this.getEditableColumns().includes(k))
    if(targetColumns.length == 0) return Promise.resolve();

    let set = targetColumns.map(k => `${k} = $${k}`).join(", ");
    let params = targetColumns.reduce((sum, k)=>{ sum['$'+k] = values[k]; return sum }, { $id: id })
    return this.runAsPromise(`UPDATE pwstore SET ${set} WHERE id = $id`, params)
  }
  getEditableColumns(){
    return [
      "service_name",
      "account",
      "password",
      "url",
      "note",
      "status",
      "keyword",
      "category",
      "otp_uri"
    ];
  }
  delete(id){
    return this.runAsPromise("DELETE FROM pwstore_extra WHERE pwstore_id = $id", { $id: id })
    .then(()=>{
      return this.runAsPromise("DELETE FROM pwstore WHERE id = $id", { $id: id })
    })
  }
  categories(){
    return this.allAsPromise("SELECT * FROM category ORDER BY lower(name)", [])
  }
  createCategory(name){
    return this.runAsPromise(`INSERT INTO category (name) values ($name)`, { $name: name})
    .then((statement)=>{ return statement.lastID })
  }
  updateCategory(id, name){
    return this.runAsPromise("UPDATE category SET name = $name WHERE id = $id", { $id: id, $name: name })
  }
  deleteCategory(id){
    return this.runAsPromise("DELETE FROM category WHERE id = $id", { $id: id })
  }
  createExtra(id, sequence_no, values){
    let sql = "SELECT * FROM pwstore_extra where pwstore_id = $id AND sequence_no = $sequence_no";
    return this.allAsPromise(sql, { $id: id, $sequence_no: sequence_no })
    .then((rows)=>{
      const columns = ["pwstore_id", "sequence_no", "key_name", "value", "encrypted"];
      let targetColumns = Object.keys(values).filter(k => columns.includes(k));
      if(rows && rows[0]){
        let set = targetColumns.map(k => `${k} = $${k}`).join(", ");
        let params = targetColumns.reduce((sum, k)=>{ sum['$'+k] = values[k]; return sum }, { $id: rows[0].id })
        return this.runAsPromise(`UPDATE pwstore_extra SET ${set} WHERE id = $id`, params)
      }else{
        // CREATE
        return this.runAsPromise(
          `INSERT INTO pwstore_extra (${columns.join(",")}) values (${columns.map(c => "?").join(",")})`,
          [id, sequence_no, values["key_name"], values["value"], values["encrypted"]])
      }
    })
  }
  deleteExtra(id, sequence_no){
    let sql = "DELETE FROM pwstore_extra WHERE pwstore_id = $id AND sequence_no = $sequence_no";
    return this.runAsPromise(sql, { $id: id, $sequence_no: sequence_no })
    .then(()=>{
      return this.findExtra({ id: id })
    })
    .then((row)=>{
      return row.extras.filter(extra => extra.sequence_no >= sequence_no).reduce((promise, extra)=>{
        return promise.then(()=>{
          return this.runAsPromise(
            "UPDATE pwstore_extra SET sequence_no = $sequence_no WHERE id = $id",
            { $id: extra.id, $sequence_no: extra.sequence_no - 1 })
        })
      }, Promise.resolve());
    })
  }
  beforeImport(){
    return this.runAsPromise("DELETE FROM pwstore_extra", {})
    .then(()=>{
      return this.runAsPromise("DELETE FROM pwstore", {})
    })
    .then(()=>{
      return this.runAsPromise("DELETE FROM category", {})
    })
  }
  allAsPromise(statement, params){
    debug(`${statement}, ${JSON.stringify(params)}`);

    return new Promise((resolve, reject)=>{
      this.db.all(statement, params, function(err, rows){
        if(err) return reject(err);
        return resolve(rows);
      });
    });
  }
  runAsPromise(statement, params){
    debug(`${statement}, ${JSON.stringify(params)}`);

    return new Promise((resolve, reject)=>{
      this.db.run(statement, params, function(err){
        if(err) return reject(err);
        return resolve(this); // this: statement object
      });
    });
  }
}

module.exports = DBConnection;
