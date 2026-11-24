const { pool } = require('../db/pool')

// 資料存取層：只放 coach 資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 最後一個參數 db 預設為 pool，交易中可傳入 client

/** 教練後台：依 user_id 取出自己的教練資料 */
function findProfileByUserId(userId, db = pool) {
  return db.query(
    `SELECT id, experience_years, description, profile_image_url
         FROM coach WHERE user_id = $1`,
    [userId]
  )
}

function findIdByUserId(userId, db = pool) {
  return db.query('SELECT id FROM coach WHERE user_id = $1', [
    userId,
  ])
}

function updateProfile(coachId, experienceYears, description, profileImageUrl, db = pool) {
  return db.query(
    `UPDATE coach
          SET experience_years = $1,
              description = $2,
              profile_image_url = $3,
              updated_at = now()
        WHERE id = $4
        RETURNING id, experience_years, description, profile_image_url`,
    [experienceYears, description, profileImageUrl, coachId]
  )
}

/** 升級教練：建立 coach 資料 */
function insert(userId, experienceYears, description, profileImageUrl, db = pool) {
  return db.query(
    `INSERT INTO coach (user_id, experience_years, description, profile_image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, experience_years, description, profile_image_url, created_at, updated_at`,
    [userId, experienceYears, description, profileImageUrl]
  )
}

module.exports = { findProfileByUserId, findIdByUserId, updateProfile, insert }
