const { pool } = require('../db/pool')

// 資料存取層：只放 coach_skill（教練 ↔ 技能）資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 最後一個參數 db 預設為 pool，交易中可傳入 client

/** 某教練綁定的技能 id，依技能建立時間排序 */
function findSkillIdsByCoachId(coachId, db = pool) {
  return db.query(
    `SELECT cs.skill_id
       FROM coach_skill cs
       JOIN skill s ON s.id = cs.skill_id
      WHERE cs.coach_id = $1
      ORDER BY s.created_at ASC`,
    [coachId]
  )
}

function deleteByCoachId(coachId, db = pool) {
  return db.query('DELETE FROM coach_skill WHERE coach_id = $1', [coachId])
}

/** 一次寫入多筆技能（skillIds 為 uuid 陣列） */
function insertMany(coachId, skillIds, db = pool) {
  return db.query(
    `INSERT INTO coach_skill (coach_id, skill_id)
       SELECT $1, UNNEST($2::uuid[])`,
    [coachId, skillIds]
  )
}

/** 公開教練詳情用：某教練綁定的技能名稱，依技能建立時間排序 */
function findSkillNamesByCoachId(coachId, db = pool) {
  return db.query(
    `SELECT s.name
         FROM coach_skill cs
         JOIN skill s ON s.id = cs.skill_id
        WHERE cs.coach_id = $1
        ORDER BY s.created_at ASC`,
    [coachId]
  )
}

module.exports = { findSkillIdsByCoachId, deleteByCoachId, insertMany, findSkillNamesByCoachId }
