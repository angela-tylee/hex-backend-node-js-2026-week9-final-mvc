const express = require('express')
const bcrypt = require('bcryptjs')

const userRepository = require('../repositories/userRepository')
const creditPurchaseRepository = require('../repositories/creditPurchaseRepository')
const courseBookingRepository = require('../repositories/courseBookingRepository')
const { signToken } = require('../utils/jwt')
const { authenticate } = require('../middlewares/auth')
const {
  isNonEmptyString,
  isValidPassword,
  PASSWORD_RULE_MESSAGE,
} = require('../utils/validators')

const router = express.Router()

const SALT_ROUNDS = 10

// POST /api/users/signup：註冊新會員（role 固定 USER）
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ status: 'failed', message: PASSWORD_RULE_MESSAGE })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const dup = await userRepository.findIdByEmail(normalizedEmail)
    if (dup.rowCount > 0) {
      return res.status(409).json({ status: 'failed', message: 'Email 已被使用' })
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    const { rows } = await userRepository.insert(name.trim(), normalizedEmail, hash)

    res.status(201).json({
      status: 'success',
      data: { user: { id: rows[0].id, name: rows[0].name } },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/users/login：登入，簽發 JWT（payload 含 id / role / exp）
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ status: 'failed', message: PASSWORD_RULE_MESSAGE })
    }

    const { rows } = await userRepository.findForLoginByEmail(email.trim().toLowerCase())

    const user = rows[0]
    const match = user ? await bcrypt.compare(password, user.password) : false
    if (!match) {
      return res.status(400).json({ status: 'failed', message: '使用者不存在或密碼輸入錯誤' })
    }

    const token = signToken({ id: user.id, role: user.role })
    res.status(201).json({
      status: 'success',
      data: { token, user: { name: user.name } },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/profile：取得本人的 name 與 email
router.get('/profile', authenticate, (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { user: { name: req.user.name, email: req.user.email } },
  })
})

// PUT /api/users/profile：更新本人的暱稱（不可與目前名稱相同）
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }

    const trimmed = name.trim()
    if (trimmed === req.user.name) {
      return res.status(400).json({ status: 'failed', message: '使用者名稱未變更' })
    }

    const result = await userRepository.updateName(req.user.id, trimmed)
    if (result.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: '更新使用者資料失敗' })
    }

    res.status(200).json({ status: 'success', data: { user: { name: trimmed } } })
  } catch (err) {
    next(err)
  }
})

// PUT /api/users/password：用舊密碼換新密碼
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const {
      password,
      new_password: newPassword,
      confirm_new_password: confirmNewPassword,
    } = req.body

    if (
      !isNonEmptyString(password) ||
      !isNonEmptyString(newPassword) ||
      !isNonEmptyString(confirmNewPassword)
    ) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }
    if (
      !isValidPassword(password) ||
      !isValidPassword(newPassword) ||
      !isValidPassword(confirmNewPassword)
    ) {
      return res.status(400).json({ status: 'failed', message: PASSWORD_RULE_MESSAGE })
    }
    if (password === newPassword) {
      return res.status(400).json({ status: 'failed', message: '新密碼不能與舊密碼相同' })
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ status: 'failed', message: '新密碼與驗證新密碼不一致' })
    }

    const { rows } = await userRepository.findPasswordById(req.user.id)
    const match = await bcrypt.compare(password, rows[0].password)
    if (!match) {
      return res.status(400).json({ status: 'failed', message: '密碼輸入錯誤' })
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await userRepository.updatePassword(req.user.id, hash)

    res.status(200).json({ status: 'success', data: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/credit-package：本人的購買方案紀錄（M5），data 直接是陣列
router.get('/credit-package', authenticate, async (req, res, next) => {
  try {
    const { rows } = await creditPurchaseRepository.findHistoryByUserId(req.user.id)

    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        name: row.name,
        purchased_credits: Number(row.purchased_credits),
        price_paid: Number(row.price_paid),
        purchase_at: row.purchase_at,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/users/courses：本人的課表與剩餘堂數（M5）
router.get('/courses', authenticate, async (req, res, next) => {
  try {
    const purchaseRes = await creditPurchaseRepository.sumCreditsByUserId(req.user.id)
    const usageRes = await courseBookingRepository.countActiveByUserId(req.user.id)
    const bookingRes = await courseBookingRepository.findScheduleByUserId(req.user.id)

    const creditUsage = Number(usageRes.rows[0].used)
    const creditRemain = Number(purchaseRes.rows[0].total) - creditUsage

    res.status(200).json({
      status: 'success',
      data: {
        credit_remain: creditRemain,
        credit_usage: creditUsage,
        course_booking: bookingRes.rows.map((row) => ({
          course_id: row.course_id,
          name: row.name,
          start_at: row.start_at,
          end_at: row.end_at,
          meeting_url: row.meeting_url,
          coach_name: row.coach_name,
          cancelled_at: row.cancelled_at,
        })),
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
