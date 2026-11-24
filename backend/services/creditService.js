const { pool } = require('../db/pool')
const creditPurchaseRepository = require('../repositories/creditPurchaseRepository')
const courseBookingRepository = require('../repositories/courseBookingRepository')

// 業務邏輯層：會員堂數相關；不寫 SQL，透過 repository 存取資料

/**
 * 剩餘堂數 ＝ Σ購買堂數 − 未取消報名數
 * db 預設為 pool，交易中可傳入 client
 * 回傳 { creditRemain, creditUsage }
 */
async function getCreditRemain(userId, db = pool) {
  const purchaseRes = await creditPurchaseRepository.sumCreditsByUserId(userId, db)
  const usageRes = await courseBookingRepository.countActiveByUserId(userId, db)
  const creditUsage = Number(usageRes.rows[0].used)
  const creditRemain = Number(purchaseRes.rows[0].total) - creditUsage
  return { creditRemain, creditUsage }
}

module.exports = { getCreditRemain }
