const { pool } = require('../db/pool')

// 資料存取層：只放 course_booking 資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 最後一個參數 db 預設為 pool，交易中可傳入 client

/** 會員已使用堂數：未取消的報名數 */
function countActiveByUserId(userId, db = pool) {
  return db.query(
    'SELECT COUNT(*) AS used FROM course_booking WHERE user_id = $1 AND cancelled_at IS NULL',
    [userId]
  )
}

/** 會員課表（含已取消），附課程與教練名稱 */
function findScheduleByUserId(userId, db = pool) {
  return db.query(
    `SELECT b.course_id,
              c.name,
              c.start_at,
              c.end_at,
              c.meeting_url,
              u.name AS coach_name,
              b.cancelled_at
         FROM course_booking b
         JOIN course c ON c.id = b.course_id
         JOIN users u ON u.id = c.user_id
        WHERE b.user_id = $1
        ORDER BY c.start_at ASC`,
    [userId]
  )
}

module.exports = { countActiveByUserId, findScheduleByUserId }
