const { pool } = require('../db/pool')

// 資料存取層：只放 credit_purchase 資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 最後一個參數 db 預設為 pool，交易中可傳入 client

function insert(userId, creditPackageId, purchasedCredits, pricePaid, db = pool) {
  return db.query(
    `INSERT INTO credit_purchase (user_id, credit_package_id, purchased_credits, price_paid)
       VALUES ($1, $2, $3, $4)`,
    [userId, creditPackageId, purchasedCredits, pricePaid]
  )
}

module.exports = { insert }
