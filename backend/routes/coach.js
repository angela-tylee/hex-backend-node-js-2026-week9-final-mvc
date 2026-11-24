const express = require('express')

const coachController = require('../controllers/coachController')

const router = express.Router()

// GET /api/coaches：教練分頁列表（公開，per 與 page 必填）
router.get('/', coachController.list)

// GET /api/coaches/:coachId：單一教練詳情（公開）
router.get('/:coachId', coachController.getDetail)

// GET /api/coaches/:coachId/courses：指定教練「未結束」的課程（end_at > now）
router.get('/:coachId/courses', coachController.listCourses)

module.exports = router
