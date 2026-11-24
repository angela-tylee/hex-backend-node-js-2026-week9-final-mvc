const express = require('express')
const userController = require('../controllers/userController')
const { authenticate } = require('../middlewares/auth')

const router = express.Router()

// POST /api/users/signup：註冊新會員（role 固定 USER）
router.post('/signup', userController.signup)

// POST /api/users/login：登入，簽發 JWT（payload 含 id / role / exp）
router.post('/login', userController.login)

// GET /api/users/profile：取得本人的 name 與 email
router.get('/profile', authenticate, userController.getProfile)

// PUT /api/users/profile：更新本人的暱稱（不可與目前名稱相同）
router.put('/profile', authenticate, userController.updateProfile)

// PUT /api/users/password：用舊密碼換新密碼
router.put('/password', authenticate, userController.updatePassword)

// GET /api/users/credit-package：本人的購買方案紀錄（M5），data 直接是陣列
router.get('/credit-package', authenticate, userController.getCreditPackages)

// GET /api/users/courses：本人的課表與剩餘堂數（M5）
router.get('/courses', authenticate, userController.getCourses)

module.exports = router
