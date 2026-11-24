const courseBookingRepository = require('../repositories/courseBookingRepository')
const creditPackageRepository = require('../repositories/creditPackageRepository')

// 業務邏輯層：月營收統計（M6）；不寫 SQL，透過 repository 存取資料

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/**
 * 計算某教練在伺服器當年第 monthIndex 月（0 起算）的營收
 * 回傳 { revenue, participants, bookingCount }
 */
async function getMonthlyRevenue(coachUserId, monthIndex) {
  const now = new Date()
  const rangeStart = new Date(now.getFullYear(), monthIndex, 1, 0, 0, 0, 0)
  const rangeEnd = new Date(now.getFullYear(), monthIndex + 1, 1, 0, 0, 0, 0)

  // 當月、未取消、且課程屬於本教練的報名
  const bookingRes = await courseBookingRepository.countActiveForCoachInRange(
    coachUserId,
    rangeStart,
    rangeEnd
  )
  const bookingCount = Number(bookingRes.rows[0].booking_count)
  const participants = Number(bookingRes.rows[0].participants)

  // 單堂均價：全部方案一起算
  const pkgRes = await creditPackageRepository.sumPriceAndCredits()
  const totalCredits = Number(pkgRes.rows[0].total_credits)
  const perCreditPrice =
    totalCredits > 0 ? Number(pkgRes.rows[0].total_price) / totalCredits : 0

  // floor 放在最後一步：先乘再無條件捨去
  const revenue = Math.floor(bookingCount * perCreditPrice)

  return { revenue, participants, bookingCount }
}

module.exports = { MONTH_NAMES, getMonthlyRevenue }
