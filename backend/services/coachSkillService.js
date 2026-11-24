const coachSkillRepository = require('../repositories/coachSkillRepository')

// 業務邏輯層：教練技能相關；不寫 SQL，透過 repository 存取資料

/** 取出某教練綁定的技能 id 清單（uuid 字串陣列，未設定時為空陣列） */
async function getSkillIds(coachId) {
  const { rows } = await coachSkillRepository.findSkillIdsByCoachId(coachId)
  return rows.map((r) => r.skill_id)
}

module.exports = { getSkillIds }
