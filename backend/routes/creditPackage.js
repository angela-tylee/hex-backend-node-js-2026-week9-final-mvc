const express = require('express')
const creditPackageController = require('../controllers/creditPackageController')
const { authenticate } = require('../middlewares/auth')

const router = express.Router()

// GET /api/credit-package：取得全部購買方案（不需登入）
router.get('/', creditPackageController.list)

// POST /api/credit-package：新增方案（不需登入），名稱不可重複
router.post('/', creditPackageController.create)

// POST /api/credit-package/:creditPackageId：登入會員購買指定方案（M5）
router.post('/:creditPackageId', authenticate, creditPackageController.purchase)

// DELETE /api/credit-package/:creditPackageId：依 id 刪除方案（不需登入）
router.delete('/:creditPackageId', creditPackageController.remove)

module.exports = router
