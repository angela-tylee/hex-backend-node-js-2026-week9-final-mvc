const creditPackageRepository = require('../repositories/creditPackageRepository')
const creditPurchaseRepository = require('../repositories/creditPurchaseRepository')
const { isUuid, isNonEmptyString, isNonNegativeInteger } = require('../utils/validators')

// GET /api/credit-package：取得全部購買方案（不需登入）
async function list(req, res, next) {
  try {
    const { rows } = await creditPackageRepository.findAll()
    res.status(200).json({ status: 'success', data: rows })
  } catch (err) {
    next(err)
  }
}

// POST /api/credit-package：新增方案（不需登入），名稱不可重複
async function create(req, res, next) {
  try {
    const { name, credit_amount: creditAmount, price } = req.body

    if (
      !isNonEmptyString(name) ||
      !isNonNegativeInteger(creditAmount) ||
      !isNonNegativeInteger(price)
    ) {
      return res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
    }

    const trimmed = name.trim()
    const dup = await creditPackageRepository.findIdByName(trimmed)
    if (dup.rowCount > 0) {
      return res.status(409).json({ status: 'failed', message: '資料重複' })
    }

    const { rows } = await creditPackageRepository.insert(trimmed, creditAmount, price)
    const pkg = rows[0]
    res.status(200).json({
      status: 'success',
      data: {
        id: pkg.id,
        name: pkg.name,
        credit_amount: pkg.credit_amount,
        price: pkg.price,
        createdAt: pkg.created_at,
      },
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/credit-package/:creditPackageId：登入會員購買指定方案（M5）
// body 完全留空，堂數與金額由後端依方案帶入
async function purchase(req, res, next) {
  try {
    const { creditPackageId } = req.params

    if (!isUuid(creditPackageId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const { rows } = await creditPackageRepository.findCreditAndPriceById(creditPackageId)
    if (rows.length === 0) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const pkg = rows[0]
    await creditPurchaseRepository.insert(
      req.user.id,
      creditPackageId,
      pkg.credit_amount,
      pkg.price
    )

    res.status(200).json({ status: 'success', data: null })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/credit-package/:creditPackageId：依 id 刪除方案（不需登入）
async function remove(req, res, next) {
  try {
    const { creditPackageId } = req.params

    if (!isUuid(creditPackageId)) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    const result = await creditPackageRepository.deleteById(creditPackageId)
    if (result.rowCount === 0) {
      return res.status(400).json({ status: 'failed', message: 'ID錯誤' })
    }

    res.status(200).json({ status: 'success', data: { raw: [], affected: result.rowCount } })
  } catch (err) {
    next(err)
  }
}

module.exports = { list, create, purchase, remove }
