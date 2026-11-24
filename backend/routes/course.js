const express = require('express')

const courseController = require('../controllers/courseController')
const { authenticate } = require('../middlewares/auth')

const router = express.Router()

// GET /api/courses：全站「進行中」的課程（start_at <= now < end_at）
router.get('/', courseController.list)

// POST /api/courses/:courseId：報名課程（M5）
// 檢查順序：課程存在 → 已報名過（含已取消）→ 剩餘堂數 → 名額上限
router.post('/:courseId', authenticate, courseController.book)

// DELETE /api/courses/:courseId：取消報名（軟刪除，堂數自動歸還）
router.delete('/:courseId', authenticate, courseController.cancel)

module.exports = router
