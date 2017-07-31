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
                 ORDER BY service_name, account`;
    return this.allAsPromise(query, category ? [ category ] : [])
  }
  find(id){
    return this.allAsPromise("SELECT * FROM pwstore WHERE id = ?", [ id ])
    .then((rows)=>{ return rows && rows[0] })
  }
  findAll(){
    return this.allAsPromise("SELECT * FROM pwstore ORDER BY id")
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
    let columns = this.getEditableColumns();
    let set = Object.keys(values).filter(k => columns.includes(k)).map(k => `${k} = $${k}`).join(", ");
    let params = Object.keys(values).reduce((sum, k)=>{ sum['$'+k] = values[k]; return sum }, { $id: id })
    return this.runAsPromise(`UPDATE pwstore SET ${set} WHERE id = $id`, params)
  }
  getEditableColumns(){
    return [
      "service_name",
      "account",
      "account_2nd",
      "account_3rd",
      "password",
      "password_2nd",
      "password_3rd",
      "url",
      "note",
      "status",
      "keyword",
      "category"
    ];
  }
  delete(id){
    return this.runAsPromise("DELETE FROM pwstore WHERE id = $id", { $id: id })
  }
  categories(){
    return this.allAsPromise("SELECT * FROM category ORDER BY display_order", [])
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
        return resolve(this);
      });
    });
  }
}

module.exports = DBConnection;
