const express = require('express')

const coachRepository = require('../repositories/coachRepository')
const coachSkillRepository = require('../repositories/coachSkillRepository')
const courseRepository = require('../repositories/courseRepository')
const { isUuid, parseNonNegativeInt } = require('../utils/validators')
const { FIELD_ERROR, COACH_NOT_FOUND } = require('../utils/messages')

const router = express.Router()

// GET /api/coaches：教練分頁列表（公開，per 與 page 必填）
router.get('/', async (req, res, next) => {
  try {
    const per = parseNonNegativeInt(req.query.per)
    const page = parseNonNegativeInt(req.query.page)
    if (per === null || page === null) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const offset = Math.max(0, (page - 1) * per)
    const { rows } = await coachRepository.findPage(per, offset)

    res.status(200).json({
      status: 'success',
      data: rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/coaches/:coachId：單一教練詳情（公開）
router.get('/:coachId', async (req, res, next) => {
  try {
    const { coachId } = req.params
    if (!isUuid(coachId)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const { rows } = await coachRepository.findDetailById(coachId)
    if (rows.length === 0) {
      return res.status(400).json({ status: 'failed', message: COACH_NOT_FOUND })
    }
    const row = rows[0]

    const { rows: skillRows } = await coachSkillRepository.findSkillNamesByCoachId(coachId)

    res.status(200).json({
      status: 'success',
      data: {
        user: { name: row.user_name, role: row.user_role },
        coach: {
          id: row.id,
          user_id: row.user_id,
          experience_years: row.experience_years,
          description: row.description,
          profile_image_url: row.profile_image_url,
          created_at: row.created_at,
          updated_at: row.updated_at,
          skills: skillRows.map((s) => s.name),
        },
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/coaches/:coachId/courses：指定教練「未結束」的課程（end_at > now）
router.get('/:coachId/courses', async (req, res, next) => {
  try {
    const { coachId } = req.params
    if (!isUuid(coachId)) {
      return res.status(400).json({ status: 'failed', message: FIELD_ERROR })
    }

    const coachRes = await coachRepository.findIdById(coachId)
    if (coachRes.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: COACH_NOT_FOUND })
    }

    const { rows } = await courseRepository.findUpcomingByCoachId(coachId)

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

module.exports = router
