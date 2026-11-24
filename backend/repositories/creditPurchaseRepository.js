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

/** 會員的購買紀錄（新到舊），附方案名稱 */
function findHistoryByUserId(userId, db = pool) {
  return db.query(
    `SELECT cp.name,
              pur.purchased_credits,
              pur.price_paid,
              pur.created_at AS purchase_at
         FROM credit_purchase pur
         JOIN credit_package cp ON cp.id = pur.credit_package_id
        WHERE pur.user_id = $1
        ORDER BY pur.created_at DESC`,
    [userId]
  )
}

/** 會員累計購買堂數（沒有購買時為 0） */
function sumCreditsByUserId(userId, db = pool) {
  return db.query(
    'SELECT COALESCE(SUM(purchased_credits), 0) AS total FROM credit_purchase WHERE user_id = $1',
    [userId]
  )
}

module.exports = { insert, findHistoryByUserId, sumCreditsByUserId }
