const { pool } = require('../db/pool')

// M0：確認後端服務啟動。資料庫就緒才回 200，否則回 503。
// SELECT 1 屬於基礎設施探測（不是業務資料），所以直接使用 pool，不經 repository
async function check(req, res) {
  try {
    await pool.query('SELECT 1')
    res.status(200).type('text/plain').send('OK')
  } catch (err) {
    res.status(503).type('text/plain').send('database not ready')
  }
}

module.exports = { check }
