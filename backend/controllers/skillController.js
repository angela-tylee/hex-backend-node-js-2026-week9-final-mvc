const skillRepository = require('../repositories/skillRepository')
const { isUuid, isNonEmptyString } = require('../utils/validators')

// GET /api/coaches/skill：取得全部技能（不需登入）
async function list(req, res, next) {
  try {
    const { rows } = await skillRepository.findAll()
    res.status(200).json({ status: 'success', data: rows })
  } catch (err) {
    next(err)
  }
}

// POST /api/coaches/skill：新增技能（不需登入），名稱不可重複
async function create(req, res, next) {
  try {
    const { name } = req.body

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }

    const trimmed = name.trim()
    const dup = await skillRepository.findIdByName(trimmed)
    if (dup.rowCount > 0) {
      return res.status(409).json({ status: 'failed', message: '資料重複' })
    }

    const { rows } = await skillRepository.insert(trimmed)
    const skill = rows[0]
    res.status(200).json({
      status: 'success',
      data: { id: skill.id, name: skill.name, createdAt: skill.created_at },
    })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/coaches/skill/:skillId：依 id 刪除技能（不需登入）
async function remove(req, res, next) {
  try {
    const { skillId } = req.params

    if (!isUuid(skillId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const result = await skillRepository.deleteById(skillId)
    if (result.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    res.status(200).json({ status: 'success', data: { raw: [], affected: result.rowCount } })
  } catch (err) {
    next(err)
  }
}

module.exports = { list, create, remove }
