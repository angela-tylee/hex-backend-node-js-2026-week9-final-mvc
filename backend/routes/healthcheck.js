const express = require('express')
const healthcheckController = require('../controllers/healthcheckController')

const router = express.Router()

// M0：確認後端服務啟動。資料庫就緒才回 200，否則回 503。
router.get('/healthcheck', healthcheckController.check)

module.exports = router
