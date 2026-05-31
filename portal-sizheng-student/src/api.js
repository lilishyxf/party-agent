const API_BASE = import.meta.env.VITE_API_URL ?? ''

// ── 本地 openid（持久化身份标识） ────────────────────

export function getOpenid() {
  let id = localStorage.getItem('sizheng_portal_openid')
  if (!id) {
    id = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('sizheng_portal_openid', id)
  }
  return id
}

// Treat naive ISO strings as Beijing time (UTC+8) so new Date() and toLocaleString display correctly.
// Backend stores Beijing wall-clock time in TIMESTAMP WITHOUT TIME ZONE columns.
export function parseDate(isoStr) {
  if (!isoStr) return new Date()
  if (/[+-]\d{2}:\d{2}$/.test(isoStr) || isoStr.endsWith('Z')) return new Date(isoStr)
  return new Date(isoStr + '+08:00')
}

export async function sendMessage(query, conversationId = null, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, openid: uid, conversation_id: conversationId }),
  })
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  const data = await resp.json()
  return { answer: data.answer || '抱歉，未能生成回答。', conversation_id: data.conversation_id }
}

export async function learnMaterial(materialId, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/learning-materials/${materialId}/learn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: uid }),
  })
  return resp.json()
}

export async function bindMember(openid, studentId, name) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/bind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: uid, student_id: studentId, name }),
  })
  return resp.json()
}

export async function unbindMember(openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/unbind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: uid }),
  })
  return resp.json()
}

export async function saveWritingDraft(openid, templateKey, userInput, aiDraft = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/writing/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: uid, template_key: templateKey, user_input: userInput, ai_draft: aiDraft }),
  })
  return resp.json()
}

export async function generateWriting(templateKey, userInput, openid = null) {
  const uid = openid || getOpenid()
  // 1. 提交任务
  const submitResp = await fetch(`${API_BASE}/api/sizheng/writing/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_key: templateKey, user_input: userInput, openid: uid }),
  })
  if (!submitResp.ok) throw new Error(`API error: ${submitResp.status}`)
  const submitData = await submitResp.json()
  if (submitData.status === 'error') throw new Error(submitData.message)

  const taskId = submitData.task_id

  // 2. 轮询等待结果
  for (let i = 0; i < 120; i++) { // 最多等 4 分钟
    await new Promise(r => setTimeout(r, 2000)) // 每 2 秒问一次
    const pollResp = await fetch(`${API_BASE}/api/sizheng/writing/task/${taskId}`)
    if (!pollResp.ok) continue
    const pollData = await pollResp.json()
    if (pollData.status === 'done') return pollData.draft
    if (pollData.status === 'error') throw new Error(pollData.message)
    // status === 'processing' → 继续等
  }
  throw new Error('生成超时，请重试')
}

export async function listWritingDrafts(openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/writing/list?openid=${uid}`)
  if (!resp.ok) return []
  return resp.json()
}

export async function getMyTasks(openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/tasks?openid=${uid}`)
  if (!resp.ok) return []
  return resp.json()
}

export async function signOffTask(assignmentId, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/tasks/${assignmentId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: uid }),
  })
  return resp.json()
}

export async function getMemberStats(openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/member/${uid}/stats`)
  if (!resp.ok) return null
  return resp.json()
}

export async function generateQuestions(category, difficulty, count = 5) {
  const resp = await fetch(`${API_BASE}/api/sizheng/questions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, difficulty, count }),
  })
  return resp.json()
}

export async function fetchQuestions(category = 'charter', count = 10) {
  const params = new URLSearchParams({ category, count: String(count) })
  const resp = await fetch(`${API_BASE}/api/sizheng/questions?${params}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function checkAnswer(questionId, userAnswer, openid = null, timeSpent = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/questions/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, user_answer: userAnswer, openid: uid, time_spent: timeSpent }),
  })
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  const data = await resp.json()
  if (!data || typeof data.is_correct === 'undefined') {
    throw new Error('返回数据格式异常')
  }
  return data
}

// ── 题库进度 API（自测练习 v2） ──────────────────────

export async function getQuizOverview(openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/quiz/overview?openid=${uid}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function getQuizQuestions(category, openid, offset = 0, limit = 10) {
  const uid = openid || getOpenid()
  const params = new URLSearchParams({ category, openid: uid, offset: String(offset), limit: String(limit) })
  const resp = await fetch(`${API_BASE}/api/sizheng/quiz/questions?${params}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function submitQuizAnswer(questionId, userAnswer, category, questionIndex, openid = null, timeSpent = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_id: questionId,
      user_answer: userAnswer,
      category,
      question_index: questionIndex,
      openid: uid,
      time_spent: timeSpent,
    }),
  })
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  const data = await resp.json()
  if (!data || typeof data.is_correct === 'undefined') {
    throw new Error('返回数据格式异常')
  }
  return data
}

export async function getWrongQuestions(openid = null, category = null) {
  const uid = openid || getOpenid()
  const params = new URLSearchParams({ openid: uid })
  if (category) params.set('category', category)
  const resp = await fetch(`${API_BASE}/api/sizheng/quiz/wrong?${params}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

// ── 考试（学生端） ──────────────────────────────────

export async function getExamDetail(examId, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/exams/${examId}?openid=${uid}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function submitExam(examId, answers, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/exams/${examId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: uid, answers }),
  })
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function getMyExamResult(examId, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/exams/${examId}/my-result?openid=${uid}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function getExamHistory(openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/exams/my-history?openid=${uid}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function getLearningRecords(openid = null, page = 1) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/member/${uid}/learning-records?page=${page}&page_size=20`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export async function fetchPortalNotices(page = 1) {
  const resp = await fetch(`${API_BASE}/api/sizheng/notices?status=published&page=${page}&page_size=20`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

// ── 专题学习（学生端） ──────────────────────────────

export async function fetchTopics() {
  const resp = await fetch(`${API_BASE}/api/sizheng/topics`)
  if (!resp.ok) return []
  return resp.json()
}

export async function fetchTopicDetail(topicId) {
  const resp = await fetch(`${API_BASE}/api/sizheng/topics/${topicId}`)
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

// ── 学习笔记（学生端） ──────────────────────────────

export async function fetchNotes(materialId, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/notes?material_id=${materialId}&openid=${uid}`)
  if (!resp.ok) return []
  return resp.json()
}

export async function createNote(materialId, content, openid = null) {
  const uid = openid || getOpenid()
  const resp = await fetch(`${API_BASE}/api/sizheng/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: uid, material_id: materialId, content }),
  })
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}
