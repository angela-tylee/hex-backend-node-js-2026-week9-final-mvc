const { pool } = require('../db/pool')

// 資料存取層：只放 credit_package 資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 最後一個參數 db 預設為 pool，交易中可傳入 client

function findAll(db = pool) {
  return db.query(
    'SELECT id, name, credit_amount, price FROM credit_package ORDER BY created_at ASC'
  )
}

function findIdByName(name, db = pool) {
  return db.query('SELECT id FROM credit_package WHERE name = $1', [name])
}

function insert(name, creditAmount, price, db = pool) {
  return db.query(
    `INSERT INTO credit_package (name, credit_amount, price)
       VALUES ($1, $2, $3)
       RETURNING id, name, credit_amount, price, created_at`,
    [name, creditAmount, price]
  )
}

/** 購買時用：依 id 取出方案的堂數與價格 */
function findCreditAndPriceById(creditPackageId, db = pool) {
  return db.query(
    'SELECT credit_amount, price FROM credit_package WHERE id = $1',
    [creditPackageId]
  )
}

function deleteById(creditPackageId, db = pool) {
  return db.query('DELETE FROM credit_package WHERE id = $1', [
    creditPackageId,
  ])
}

/** 月營收用：全部方案的總價與總堂數（沒有方案時皆為 0） */
function sumPriceAndCredits(db = pool) {
  return db.query(
    `SELECT COALESCE(SUM(price), 0) AS total_price,
              COALESCE(SUM(credit_amount), 0) AS total_credits
         FROM credit_package`
  )
}

module.exports = {
  findAll,
  findIdByName,
  insert,
  findCreditAndPriceById,
  deleteById,
  sumPriceAndCredits,
}
