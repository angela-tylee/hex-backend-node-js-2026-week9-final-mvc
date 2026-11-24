const express = require('express')

const { pool } = require('../db/pool')
const coachRepository = require('../repositories/coachRepository')
const coachSkillRepository = require('../repositories/coachSkillRepository')
const courseRepository = require('../repositories/courseRepository')
const courseBookingRepository = require('../repositories/courseBookingRepository')
const creditPackageRepository = require('../repositories/creditPackageRepository')
const skillRepository = require('../repositories/skillRepository')
const userRepository = require('../repositories/userRepository')
const { authenticate, requireCoach } = require('../middlewares/auth')
const {
  isUuid,
  isNonEmptyString,
  isNonNegativeInteger,
  isHttpsUrl,
  validateCourseBody,
} = require('../utils/validators')
const { FIELD_ERROR } = require('../utils/messages')
const { serializeCourse } = require('../utils/serializers')

const router = express.Router()

/** 取出某教練綁定的技能 id 清單（uuid 字串陣列，未設定時為空陣列） */
async function getSkillIds(coachId) {
  const { rows } = await coachSkillRepository.findSkillIdsByCoachId(coachId)
  return rows.map((r) => r.skill_id)
}

// ============================================================
// 教練個人資料
// ============================================================

// GET /api/admin/coaches：教練查看自己的後台資料（含技能清單）
router.get('/', authenticate, requireCoach, async (req, res, next) => {
  try {
    const { rows } = await coachRepository.findProfileByUserId(req.user.id)
    if (rows.length === 0) {
      return res.status(404).json({ status: 'failed', message: '找不到教練資料' })
    }
    const coach = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: coach.id,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skill_ids: await getSkillIds(coach.id),
      },
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/admin/coaches：教練更新自己的後台資料（含整批更換技能）
router.put('/', authenticate, requireCoach, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const {
      experience_years: experienceYears,
      description,
      profile_image_url: profileImageUrl,
      skill_ids: skillIds,
    } = req.body

    if (
      !isNonNegativeInteger(experienceYears) ||
      !isNonEmptyString(description) ||
      !isHttpsUrl(profileImageUrl) ||
      !Array.isArray(skillIds) ||
      skillIds.length === 0 ||
      !skillIds.every((id) => isUuid(id))
    ) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const uniqueSkillIds = [...new Set(skillIds)]
    const skillCheck = await skillRepository.findIdsByIds(uniqueSkillIds, client)
    if (skillCheck.rowCount !== uniqueSkillIds.length) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const coachRes = await coachRepository.findIdByUserId(req.user.id, client)
    if (coachRes.rowCount === 0) {
      return res.status(404).json({ status: 'failed', message: '找不到教練資料' })
    }
    const coachId = coachRes.rows[0].id

    await client.query('BEGIN')
    const { rows } = await coachRepository.updateProfile(
      coachId,
      experienceYears,
      description.trim(),
      profileImageUrl.trim(),
      client
    )
    await coachSkillRepository.deleteByCoachId(coachId, client)
    await coachSkillRepository.insertMany(coachId, uniqueSkillIds, client)
    await client.query('COMMIT')

    const coach = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: coach.id,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skill_ids: await getSkillIds(coachId),
      },
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
  }
})

// ============================================================
// 課程管理（開課教練 = token 裡的本人）
// ============================================================

// GET /api/admin/coaches/courses：教練本人開設的全部課程
router.get('/courses', authenticate, requireCoach, async (req, res, next) => {
  try {
    const { rows } = await courseRepository.findAllByCoachUserId(req.user.id)
    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        start_at: row.start_at,
        end_at: row.end_at,
        max_participants: row.max_participants,
        meeting_url: row.meeting_url,
        participants: 0,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/coaches/courses：教練開設新課程
router.post('/courses', authenticate, requireCoach, async (req, res, next) => {
  try {
    const invalid = validateCourseBody(req.body)
    if (invalid) {
      return res.status(400).json({ status: 'failed', message: invalid })
    }

    const {
      skill_id: skillId,
      name,
      description,
      start_at: startAt,
      end_at: endAt,
      max_participants: maxParticipants,
      meeting_url: meetingUrl,
    } = req.body

    const skillCheck = await skillRepository.findIdById(skillId)
    if (skillCheck.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const { rows } = await courseRepository.insert({
      userId: req.user.id,
      skillId,
      name: name.trim(),
      description: description.trim(),
      startAt,
      endAt,
      maxParticipants,
      meetingUrl: meetingUrl.trim(),
    })

    res.status(201).json({
      status: 'success',
      data: { course: serializeCourse(rows[0]) },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/coaches/courses/:courseId：單一課程詳情（owner-scoped，扁平物件）
router.get('/courses/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params
    if (!isUuid(courseId)) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const { rows } = await courseRepository.findDetailByIdAndUserId(courseId, req.user.id)
    if (rows.length === 0) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const row = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        start_at: row.start_at,
        end_at: row.end_at,
        max_participants: row.max_participants,
        skill_name: row.skill_name,
        skill_id: row.skill_id,
        meeting_url: row.meeting_url,
      },
    })
  } catch (err) {
    next(err)
  }
})

// PUT /api/admin/coaches/courses/:courseId：更新單一課程（owner-scoped，先驗欄位再驗擁有者）
router.put('/courses/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params

    const invalid = validateCourseBody(req.body)
    if (invalid) {
      return res.status(400).json({ status: 'failed', message: invalid })
    }
    if (!isUuid(courseId)) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const {
      skill_id: skillId,
      name,
      description,
      start_at: startAt,
      end_at: endAt,
      max_participants: maxParticipants,
      meeting_url: meetingUrl,
    } = req.body

    const owned = await courseRepository.findIdByIdAndUserId(courseId, req.user.id)
    if (owned.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: '課程不存在' })
    }

    const skillCheck = await skillRepository.findIdById(skillId)
    if (skillCheck.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const { rows } = await courseRepository.update({
      courseId,
      userId: req.user.id,
      skillId,
      name: name.trim(),
      description: description.trim(),
      startAt,
      endAt,
      maxParticipants,
      meetingUrl: meetingUrl.trim(),
    })

    res.status(200).json({
      status: 'success',
      data: { course: serializeCourse(rows[0]) },
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// 月營收統計（M6，挑戰）
// ============================================================

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

// GET /api/admin/coaches/revenue?month=<英文小寫月份名>
// 隱形語意：
//  ① 一筆報名算進哪個月，看 course_booking.created_at（報名建立時間），不是上課時間
//  ② 年份固定為伺服器當年；month 收英文小寫月份名（january ~ december）
//  ③ 單堂均價 = 全部方案 Σprice ÷ Σcredit_amount；revenue = floor(當月未取消報名數 × 均價)
router.get('/revenue', authenticate, requireCoach, async (req, res, next) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month.toLowerCase() : ''
    const monthIndex = MONTH_NAMES.indexOf(month)
    if (monthIndex === -1) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const now = new Date()
    const rangeStart = new Date(now.getFullYear(), monthIndex, 1, 0, 0, 0, 0)
    const rangeEnd = new Date(now.getFullYear(), monthIndex + 1, 1, 0, 0, 0, 0)

    // 當月、未取消、且課程屬於本教練的報名
    const bookingRes = await courseBookingRepository.countActiveForCoachInRange(
      req.user.id,
      rangeStart,
      rangeEnd
    )
    const bookingCount = Number(bookingRes.rows[0].booking_count)
    const participants = Number(bookingRes.rows[0].participants)

    // 單堂均價：全部方案一起算
    const pkgRes = await creditPackageRepository.sumPriceAndCredits()
    const totalCredits = Number(pkgRes.rows[0].total_credits)
    const perCreditPrice =
      totalCredits > 0 ? Number(pkgRes.rows[0].total_price) / totalCredits : 0

    // floor 放在最後一步：先乘再無條件捨去
    const revenue = Math.floor(bookingCount * perCreditPrice)

    res.status(200).json({
      status: 'success',
      data: {
        total: {
          revenue,
          participants,
          course_count: bookingCount,
        },
      },
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// 升級教練（public 端點，課程簡化：不需登入）
// 需排在所有 /courses 路由之後，避免把 "courses" 當成 userId
// ============================================================

// POST /api/admin/coaches/:userId：把一般會員升級成教練
router.post('/:userId', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { userId } = req.params
    const {
      experience_years: experienceYears,
      description,
      profile_image_url: profileImageUrl,
    } = req.body

    if (!isNonNegativeInteger(experienceYears) || !isNonEmptyString(description)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }
    const hasImage = profileImageUrl !== undefined && profileImageUrl !== null && profileImageUrl !== ''
    if (hasImage && !isHttpsUrl(profileImageUrl)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }
    if (!isUuid(userId)) {
      return res.status(400).json({ status: 'failed', message: '使用者不存在' })
    }

    const userRes = await userRepository.findRoleById(userId, client)
    if (userRes.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: '使用者不存在' })
    }
    const user = userRes.rows[0]
    if (user.role === 'COACH') {
      return res.status(409).json({ status: 'failed', message: '使用者已經是教練' })
    }

    await client.query('BEGIN')
    const coachRes = await coachRepository.insert(
      userId,
      experienceYears,
      description.trim(),
      hasImage ? profileImageUrl.trim() : null,
      client
    )
    await userRepository.updateRoleToCoach(userId, client)
    await client.query('COMMIT')

    res.status(201).json({
      status: 'success',
      data: {
        user: { name: user.name, role: 'COACH' },
        coach: coachRes.rows[0],
      },
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
  }
})

module.exports = router
