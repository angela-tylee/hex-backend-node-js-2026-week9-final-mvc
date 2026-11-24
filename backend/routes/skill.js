const express = require('express')
const skillController = require('../controllers/skillController')

const router = express.Router()

// GET /api/coaches/skill：取得全部技能（不需登入）
router.get('/', skillController.list)

// POST /api/coaches/skill：新增技能（不需登入），名稱不可重複
router.post('/', skillController.create)

// DELETE /api/coaches/skill/:skillId：依 id 刪除技能（不需登入）
router.delete('/:skillId', skillController.remove)

module.exports = router
