const { FIELD_ERROR } = require('./messages')

const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** 非空字串（不可為空字串或全空白） */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/** 0 以上的整數（數字型別，不接受字串、負數、小數） */
function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** 必須是非空字串且以 https:// 開頭 */
function isHttpsUrl(value) {
  return isNonEmptyString(value) && value.trim().startsWith('https://')
}

/** 密碼規則不符時的固定訊息 */
const PASSWORD_RULE_MESSAGE =
  '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'

/** 密碼規則：同時含英文大寫、小寫、數字，長度 8～16 字 */
function isValidPassword(value) {
  if (typeof value !== 'string') return false
  if (value.length < 8 || value.length > 16) return false
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
}

/** 驗證開課／改課共用的課程欄位，合法回 null，不合法回錯誤訊息 */
function validateCourseBody(body) {
  const {
    skill_id: skillId,
    name,
    description,
    start_at: startAt,
    end_at: endAt,
    max_participants: maxParticipants,
    meeting_url: meetingUrl,
  } = body

  if (
    !isUuid(skillId) ||
    !isNonEmptyString(name) ||
    !isNonEmptyString(description) ||
    !isNonEmptyString(startAt) ||
    !isNonEmptyString(endAt) ||
    !isNonNegativeInteger(maxParticipants) ||
    !isHttpsUrl(meetingUrl)
  ) {
    return FIELD_ERROR
  }
  if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt))) {
    return FIELD_ERROR
  }
  return null
}

/** 可轉成非負整數的字串（例如 "6"、"0"）；"test"、"-1"、"1.5"、空字串都不算 */
function parseNonNegativeInt(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  if (!/^\d+$/.test(value.trim())) return null
  return Number(value.trim())
}

module.exports = {
  isUuid,
  isNonEmptyString,
  isNonNegativeInteger,
  isHttpsUrl,
  isValidPassword,
  PASSWORD_RULE_MESSAGE,
  validateCourseBody,
  parseNonNegativeInt,
}
