const { pool } = require('../db/pool')

// 資料存取層：只放 users 資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 最後一個參數 db 預設為 pool，交易中可傳入 client

/** 註冊時檢查 email 是否已被使用 */
function findIdByEmail(email, db = pool) {
  return db.query('SELECT id FROM users WHERE email = $1', [email])
}

function insert(name, email, passwordHash, db = pool) {
  return db.query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name',
    [name, email, passwordHash]
  )
}

/** 登入用：含密碼雜湊與 role */
function findForLoginByEmail(email, db = pool) {
  return db.query(
    'SELECT id, name, password, role FROM users WHERE email = $1',
    [email]
  )
}

function updateName(userId, name, db = pool) {
  return db.query(
    'UPDATE users SET name = $1, updated_at = now() WHERE id = $2',
    [name, userId]
  )
}

function findPasswordById(userId, db = pool) {
  return db.query('SELECT password FROM users WHERE id = $1', [userId])
}

function updatePassword(userId, passwordHash, db = pool) {
  return db.query(
    'UPDATE users SET password = $1, updated_at = now() WHERE id = $2',
    [passwordHash, userId]
  )
}

module.exports = {
  findIdByEmail,
  insert,
  findForLoginByEmail,
  updateName,
  findPasswordById,
  updatePassword,
}
