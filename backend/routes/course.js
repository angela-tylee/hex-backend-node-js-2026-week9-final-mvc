const express = require('express')

const { pool } = require('../db/pool')
const courseRepository = require('../repositories/courseRepository')
const courseBookingRepository = require('../repositories/courseBookingRepository')
const { getCreditRemain } = require('../services/creditService')
const { authenticate } = require('../middlewares/auth')
const { isUuid } = require('../utils/validators')

const router = express.Router()

// GET /api/courses：全站「進行中」的課程（start_at <= now < end_at）
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await courseRepository.findOngoing()

    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        start_at: row.start_at,
        end_at: row.end_at,
        max_participants: row.max_participants,
        coach_name: row.coach_name,
        skill_name: row.skill_name,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/courses/:courseId：報名課程（M5）
// 檢查順序：課程存在 → 已報名過（含已取消）→ 剩餘堂數 → 名額上限
router.post('/:courseId', authenticate, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { courseId } = req.params

    if (!isUuid(courseId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    await client.query('BEGIN')

    const courseRes = await courseRepository.findForUpdateById(courseId, client)
    if (courseRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    // ② 已有報名紀錄（包含已取消的）
    const bookedRes = await courseBookingRepository.findIdByUserIdAndCourseId(
      req.user.id,
      courseId,
      client
    )
    if (bookedRes.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ status: 'failed', message: '已經報名過此課程' })
    }

    // ③ 剩餘堂數 ＝ Σ購買堂數 − 未取消報名數
    const { creditRemain } = await getCreditRemain(req.user.id, client)
    if (creditRemain <= 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ status: 'failed', message: '已無可使用堂數' })
    }

    // ④ 名額上限（只算未取消的有效報名）
    const countRes = await courseBookingRepository.countActiveByCourseId(courseId, client)
    if (Number(countRes.rows[0].taken) >= courseRes.rows[0].max_participants) {
      await client.query('ROLLBACK')
      return res.status(400).json({ status: 'failed', message: '已達最大參加人數，無法參加' })
    }

    await courseBookingRepository.insert(req.user.id, courseId, client)
    await client.query('COMMIT')

    res.status(201).json({ status: 'success', data: null })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
  }
})

// DELETE /api/courses/:courseId：取消報名（軟刪除，堂數自動歸還）
router.delete('/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params

    if (!isUuid(courseId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const result = await courseBookingRepository.cancel(req.user.id, courseId)
    if (result.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    res.status(200).json({ status: 'success', data: null })
  } catch (err) {
    next(err)
  }
})

module.exports = router
