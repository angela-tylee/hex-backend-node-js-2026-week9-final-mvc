const express = require('express')

const adminCoachController = require('../controllers/adminCoachController')
const { authenticate, requireCoach } = require('../middlewares/auth')

const router = express.Router()

// ============================================================
// 教練個人資料
// ============================================================

// GET /api/admin/coaches：教練查看自己的後台資料（含技能清單）
router.get('/', authenticate, requireCoach, adminCoachController.getProfile)

// PUT /api/admin/coaches：教練更新自己的後台資料（含整批更換技能）
router.put('/', authenticate, requireCoach, adminCoachController.updateProfile)

// ============================================================
// 課程管理（開課教練 = token 裡的本人）
// ============================================================

// GET /api/admin/coaches/courses：教練本人開設的全部課程
router.get('/courses', authenticate, requireCoach, adminCoachController.listCourses)

// POST /api/admin/coaches/courses：教練開設新課程
router.post('/courses', authenticate, requireCoach, adminCoachController.createCourse)

// GET /api/admin/coaches/courses/:courseId：單一課程詳情（owner-scoped，扁平物件）
router.get('/courses/:courseId', authenticate, adminCoachController.getCourse)

// PUT /api/admin/coaches/courses/:courseId：更新單一課程（owner-scoped，先驗欄位再驗擁有者）
router.put('/courses/:courseId', authenticate, adminCoachController.updateCourse)

// ============================================================
// 月營收統計（M6，挑戰）
// ============================================================

// GET /api/admin/coaches/revenue?month=<英文小寫月份名>
// 隱形語意：
//  ① 一筆報名算進哪個月，看 course_booking.created_at（報名建立時間），不是上課時間
//  ② 年份固定為伺服器當年；month 收英文小寫月份名（january ~ december）
//  ③ 單堂均價 = 全部方案 Σprice ÷ Σcredit_amount；revenue = floor(當月未取消報名數 × 均價)
router.get('/revenue', authenticate, requireCoach, adminCoachController.getRevenue)

// ============================================================
// 升級教練（public 端點，課程簡化：不需登入）
// 需排在所有 /courses 路由之後，避免把 "courses" 當成 userId
// ============================================================

// POST /api/admin/coaches/:userId：把一般會員升級成教練
router.post('/:userId', adminCoachController.upgradeToCoach)

module.exports = router
