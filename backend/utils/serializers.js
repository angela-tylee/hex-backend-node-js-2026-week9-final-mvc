function serializeCourse(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    skill_id: row.skill_id,
    name: row.name,
    description: row.description,
    start_at: row.start_at,
    end_at: row.end_at,
    max_participants: row.max_participants,
    meeting_url: row.meeting_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

module.exports = { serializeCourse }
