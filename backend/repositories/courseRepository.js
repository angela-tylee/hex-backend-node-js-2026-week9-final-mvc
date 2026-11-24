const { pool } = require('../db/pool')

// 資料存取層：只放 course 資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 最後一個參數 db 預設為 pool，交易中可傳入 client

/** 教練後台：本人開設的全部課程，含依時間計算的狀態 */
function findAllByCoachUserId(userId, db = pool) {
  return db.query(
    `SELECT id, name, start_at, end_at, max_participants, meeting_url,
              CASE
                WHEN now() < start_at THEN '尚未開始'
                WHEN now() > end_at THEN '已結束'
                ELSE '進行中'
              END AS status
         FROM course
        WHERE user_id = $1
        ORDER BY created_at DESC`,
    [userId]
  )
}

/** 開課。欄位以物件傳入，避免 8 個位置參數排錯 */
function insert(
  { userId, skillId, name, description, startAt, endAt, maxParticipants, meetingUrl },
  db = pool
) {
  return db.query(
    `INSERT INTO course
         (user_id, skill_id, name, description, start_at, end_at, max_participants, meeting_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
    [userId, skillId, name, description, startAt, endAt, maxParticipants, meetingUrl]
  )
}

/** 教練後台：單一課程詳情（限本人課程），附技能名稱 */
function findDetailByIdAndUserId(courseId, userId, db = pool) {
  return db.query(
    `SELECT c.id, c.name, c.description, c.start_at, c.end_at,
              c.max_participants, c.meeting_url, c.skill_id, s.name AS skill_name
         FROM course c
         JOIN skill s ON s.id = c.skill_id
        WHERE c.id = $1 AND c.user_id = $2`,
    [courseId, userId]
  )
}

/** 擁有者檢查：課程存在且屬於該教練 */
function findIdByIdAndUserId(courseId, userId, db = pool) {
  return db.query(
    'SELECT id FROM course WHERE id = $1 AND user_id = $2',
    [courseId, userId]
  )
}

/** 更新課程（限本人課程）。欄位以物件傳入，避免 9 個位置參數排錯 */
function update(
  { courseId, userId, skillId, name, description, startAt, endAt, maxParticipants, meetingUrl },
  db = pool
) {
  return db.query(
    `UPDATE course
          SET skill_id = $1, name = $2, description = $3, start_at = $4,
              end_at = $5, max_participants = $6, meeting_url = $7, updated_at = now()
        WHERE id = $8 AND user_id = $9
        RETURNING *`,
    [skillId, name, description, startAt, endAt, maxParticipants, meetingUrl, courseId, userId]
  )
}

module.exports = {
  findAllByCoachUserId,
  insert,
  findDetailByIdAndUserId,
  findIdByIdAndUserId,
  update,
}
