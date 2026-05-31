const API_BASE = import.meta.env.VITE_API_URL ?? ''

// ── Token 管理 ──────────────────────────────────────

const TOKEN_KEY = 'admin_token'
export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

// Treat naive ISO strings as Beijing time (UTC+8) so new Date() and toLocaleString display correctly.
// Backend stores Beijing wall-clock time in TIMESTAMP WITHOUT TIME ZONE columns.
export function parseDate(isoStr) {
  if (!isoStr) return new Date()
  if (/[+-]\d{2}:\d{2}$/.test(isoStr) || isoStr.endsWith('Z')) return new Date(isoStr)
  return new Date(isoStr + '+08:00')
}

// ── AI 对话 ──────────────────────────────────────

export async function aiChat(query, conversationId = null) {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, openid: 'admin', conversation_id: conversationId }),
  })
  if (!resp.ok) throw new Error(`${resp.status}`)
  return resp.json()
}

export async function fetchChatHistory() {
  const resp = await fetch(`${API_BASE}/api/chat/history?openid=admin`)
  if (!resp.ok) return { conversations: [] }
  return resp.json()
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(`${API_BASE}${path}`, { headers, ...options })
  if (resp.status === 401) { clearToken(); throw new Error('401') }
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`)
  return resp.json()
}

// ── 学习材料 CRUD ──────────────────────────────────

export function uploadMaterial(formData) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API_BASE}/api/learning-materials/upload`, {
    method: 'POST',
    headers,
    body: formData,
  }).then(r => r.json())
}

export function fetchMaterials({ category = '', search = '', page = 1, page_size = 50 } = {}) {
  const params = new URLSearchParams({ page, page_size })
  if (category) params.set('category', category)
  if (search) params.set('search', search)
  return request(`/api/learning-materials?${params}`)
}

export function createMaterial(data) {
  return request('/api/learning-materials', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMaterial(id, data) {
  return request(`/api/learning-materials/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteMaterial(id) {
  return request(`/api/learning-materials/${id}`, { method: 'DELETE' })
}

// ── 题目管理 ──────────────────────────────────────

export function fetchQuestions({ category = '', page = 1, page_size = 50 } = {}) {
  const params = new URLSearchParams({ page, page_size })
  if (category) params.set('category', category)
  return request(`/api/questions?${params}`)
}

export function deleteQuestion(id) {
  return request(`/api/questions/${id}`, { method: 'DELETE' })
}

export function generateQuestions({ category, difficulty, count }) {
  return request('/api/questions/generate', { method: 'POST', body: JSON.stringify({ category, difficulty, count }) })
}

export function preGenerateAll(target_per_category = 40) {
  return request('/api/questions/pre-generate-all', { method: 'POST', body: JSON.stringify({ target_per_category }) })
}

// ── 党员管理 ──────────────────────────────────────

export function fetchMembers({ search = '', branch_id = 0, party_status = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (branch_id) params.set('branch_id', String(branch_id))
  if (party_status) params.set('party_status', party_status)
  return request(`/api/members?${params}`)
}
export function createMember(data) { return request('/api/members', { method: 'POST', body: JSON.stringify(data) }) }
export function updateMember(id, data) { return request(`/api/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteMember(id) { return request(`/api/members/${id}`, { method: 'DELETE' }) }
export function importMembers(formData) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API_BASE}/api/members/import`, {
    method: 'POST', headers, body: formData,
  }).then(r => r.json())
}

// ── 支部管理 ──────────────────────────────────────

export function fetchBranches() { return request('/api/branches') }
export function createBranch(data) { return request('/api/branches', { method: 'POST', body: JSON.stringify(data) }) }
export function updateBranch(id, data) { return request(`/api/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteBranch(id) { return request(`/api/branches/${id}`, { method: 'DELETE' }) }

// ── 专题学习 ──────────────────────────────────────

export function fetchTopics() {
  return request('/api/topics')
}

export function createTopic(data) {
  return request('/api/topics', { method: 'POST', body: JSON.stringify(data) })
}

export function updateTopic(id, data) {
  return request(`/api/topics/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteTopic(id) {
  return request(`/api/topics/${id}`, { method: 'DELETE' })
}

export function fetchTopicDetail(id) {
  return request(`/api/topics/${id}`)
}

export function addTopicItem(topicId, data) {
  return request(`/api/topics/${topicId}/items`, { method: 'POST', body: JSON.stringify(data) })
}

export function removeTopicItem(itemId) {
  return request(`/api/topics/items/${itemId}`, { method: 'DELETE' })
}

// ── 学习档案 ──────────────────────────────────────

export function fetchLearningRecords({ page = 1, page_size = 20, search = '' } = {}) {
  return request(`/api/learning-records?page=${page}&page_size=${page_size}&search=${search}`)
}

// ── 考试管理 ──────────────────────────────────────

export function fetchExams({ page = 1, page_size = 20 } = {}) {
  return request(`/api/exams?page=${page}&page_size=${page_size}`)
}

export function createExam(data) {
  return request('/api/exams', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fetchExamResults(examId) {
  return request(`/api/exams/${examId}/results`)
}

// ── 学习动态 ──────────────────────────────────────

export function fetchActivities({ page = 1, page_size = 30 } = {}) {
  return request(`/api/learning-activities?page=${page}&page_size=${page_size}`)
}

// ── 学习笔记 ──────────────────────────────────────

export function fetchNotes(materialId = null) {
  const params = materialId ? `?material_id=${materialId}` : ''
  return request(`/api/notes${params}`)
}

export function deleteNote(id) {
  return request(`/api/notes/${id}`, { method: 'DELETE' })
}

// ── 学习简报 ──────────────────────────────────────

export function fetchBriefing({ startDate = '', endDate = '' } = {}) {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  return request(`/api/learning-briefing?${params}`)
}

// ── 宣传中心 · 图片管理 ────────────────────────────

export async function fetchImageAlbums() {
  const resp = await fetch(`${API_BASE}/api/promotion/images/albums`)
  if (!resp.ok) throw new Error(`${resp.status}`)
  return resp.json()
}

export async function uploadImages(album, files) {
  const formData = new FormData()
  formData.append('album', album)
  files.forEach(f => formData.append('files', f))
  const resp = await fetch(`${API_BASE}/api/promotion/images/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!resp.ok) throw new Error(`${resp.status}`)
  return resp.json()
}

export async function deleteImage(album, filename) {
  const resp = await fetch(`${API_BASE}/api/promotion/images/delete?album=${encodeURIComponent(album)}&filename=${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })
  if (!resp.ok) throw new Error(`${resp.status}`)
  return resp.json()
}

// ── 活动中心 · 会议管理 ────────────────────────────

export function fetchMeetingStats() {
  return request('/api/meetings/stats')
}

export function fetchMeetings({ type = '', search = '', page = 1, page_size = 20 } = {}) {
  const params = new URLSearchParams({ page, page_size })
  if (type) params.set('type', type)
  if (search) params.set('search', search)
  return request(`/api/meetings?${params}`)
}

export function createMeeting(data) {
  return request('/api/meetings', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMeeting(id, data) {
  return request(`/api/meetings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteMeeting(id) {
  return request(`/api/meetings/${id}`, { method: 'DELETE' })
}

// ── 办公中心 ────────────────────────────────────────

export function fetchNotices({ search = '', status = '', page = 1, page_size = 20 } = {}) {
  const params = new URLSearchParams({ page, page_size })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  return request(`/api/notices?${params}`)
}
export function createNotice(data) { return request('/api/notices', { method: 'POST', body: JSON.stringify(data) }) }
export function updateNotice(id, data) { return request(`/api/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteNotice(id) { return request(`/api/notices/${id}`, { method: 'DELETE' }) }

export function fetchTodos({ search = '', status = '', page = 1, page_size = 20 } = {}) {
  const params = new URLSearchParams({ page, page_size })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  return request(`/api/todos?${params}`)
}
export function createTodo(data) { return request('/api/todos', { method: 'POST', body: JSON.stringify(data) }) }
export function updateTodo(id, data) { return request(`/api/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteTodo(id) { return request(`/api/todos/${id}`, { method: 'DELETE' }) }

export function fetchDocuments({ search = '', doc_type = '', status = '', page = 1, page_size = 20 } = {}) {
  const params = new URLSearchParams({ page, page_size })
  if (search) params.set('search', search)
  if (doc_type) params.set('doc_type', doc_type)
  if (status) params.set('status', status)
  return request(`/api/documents?${params}`)
}
export function createDocument(data) { return request('/api/documents', { method: 'POST', body: JSON.stringify(data) }) }
export function updateDocument(id, data) { return request(`/api/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteDocument(id) { return request(`/api/documents/${id}`, { method: 'DELETE' }) }

export function fetchSchedules({ search = '', event_type = '', page = 1, page_size = 20 } = {}) {
  const params = new URLSearchParams({ page, page_size })
  if (search) params.set('search', search)
  if (event_type) params.set('event_type', event_type)
  return request(`/api/schedules?${params}`)
}
export function createSchedule(data) { return request('/api/schedules', { method: 'POST', body: JSON.stringify(data) }) }
export function updateSchedule(id, data) { return request(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteSchedule(id) { return request(`/api/schedules/${id}`, { method: 'DELETE' }) }

// ── 发展党员 ──────────────────────────────────────

export function fetchDevelopment({ status = '', search = '' } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  return request(`/api/development?${params}`)
}

export function fetchDevelopmentHistory(memberId) {
  return request(`/api/development/${memberId}/history`)
}

export function advanceDevelopment(data) {
  return request('/api/development/advance', { method: 'POST', body: JSON.stringify(data) })
}

// ── 干部管理 ──────────────────────────────────────

export function fetchCadres({ search = '', branch_id = 0 } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (branch_id) params.set('branch_id', String(branch_id))
  return request(`/api/cadres?${params}`)
}

// ── 党员联系 ──────────────────────────────────────

export function fetchContacts({ search = '', member_id = 0 } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (member_id) params.set('member_id', String(member_id))
  return request(`/api/contacts?${params}`)
}
export function createContact(data) { return request('/api/contacts', { method: 'POST', body: JSON.stringify(data) }) }
export function updateContact(id, data) { return request(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteContact(id) { return request(`/api/contacts/${id}`, { method: 'DELETE' }) }

// ── 党费收缴 ──────────────────────────────────────

export function fetchDues({ year = 0, month = 0, search = '' } = {}) {
  const params = new URLSearchParams()
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  if (search) params.set('search', search)
  return request(`/api/dues?${params}`)
}
export function createDues(data) { return request('/api/dues', { method: 'POST', body: JSON.stringify(data) }) }
export function updateDues(id, data) { return request(`/api/dues/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteDues(id) { return request(`/api/dues/${id}`, { method: 'DELETE' }) }

// ── 困难党员帮扶 ──────────────────────────────────

export function fetchAssistance({ search = '' } = {}) {
  return request(`/api/assistance${search ? '?search=' + search : ''}`)
}
export function createAssistance(data) { return request('/api/assistance', { method: 'POST', body: JSON.stringify(data) }) }
export function updateAssistance(id, data) { return request(`/api/assistance/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteAssistance(id) { return request(`/api/assistance/${id}`, { method: 'DELETE' }) }

// ── 志愿服务记录 ──────────────────────────────────

export function fetchVolunteers({ search = '' } = {}) {
  return request(`/api/volunteers${search ? '?search=' + search : ''}`)
}
export function createVolunteer(data) { return request('/api/volunteers', { method: 'POST', body: JSON.stringify(data) }) }
export function updateVolunteer(id, data) { return request(`/api/volunteers/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteVolunteer(id) { return request(`/api/volunteers/${id}`, { method: 'DELETE' }) }

// ── 管理员鉴权 ──────────────────────────────────────

export async function adminLogin(username, password) {
  const resp = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!resp.ok) throw new Error(`${resp.status}`)
  return resp.json()
}

export function fetchAdminMe() { return request('/api/admin/me') }
export function changeAdminPassword(data) { return request('/api/admin/change-password', { method: 'POST', body: JSON.stringify(data) }) }

// ── 管理员用户管理 ──────────────────────────────────

export function fetchAdminUsers() { return request('/api/admin-users') }
export function createAdminUser(data) { return request('/api/admin-users', { method: 'POST', body: JSON.stringify(data) }) }
export function updateAdminUser(id, data) { return request(`/api/admin-users/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteAdminUser(id) { return request(`/api/admin-users/${id}`, { method: 'DELETE' }) }

// ── 操作日志 ────────────────────────────────────────

export function fetchOperationLogs(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
  return request(`/api/operation-logs?${qs}`)
}
export function fetchDashboardStats(year) { return request(`/api/dashboard/stats${year ? `?year=${year}` : ''}`) }
export function fetchUnreadCount() { return request('/api/operation-logs/unread-count') }
export function markLogRead(id) { return request(`/api/operation-logs/${id}/read`, { method: 'POST' }) }
export function markAllLogsRead() { return request('/api/operation-logs/read-all', { method: 'POST' }) }

// ── 系统配置 ────────────────────────────────────────

export function fetchSystemConfigs() { return request('/api/system-configs') }
export function saveSystemConfig(data) { return request('/api/system-configs', { method: 'POST', body: JSON.stringify(data) }) }
export function deleteSystemConfig(id) { return request(`/api/system-configs/${id}`, { method: 'DELETE' }) }

// ── 数据字典 ────────────────────────────────────────

export function fetchDataDicts(type = '') {
  const qs = type ? `?dict_type=${encodeURIComponent(type)}` : ''
  return request(`/api/data-dicts${qs}`)
}
export function createDataDict(data) { return request('/api/data-dicts', { method: 'POST', body: JSON.stringify(data) }) }
export function updateDataDict(id, data) { return request(`/api/data-dicts/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteDataDict(id) { return request(`/api/data-dicts/${id}`, { method: 'DELETE' }) }

// ── 监督中心 · 党风党纪学习 ──────────────────────────

export function fetchDisciplineStudy() { return request('/api/supervision/discipline-study') }
export function createDisciplineStudy(data) { return request('/api/supervision/discipline-study', { method: 'POST', body: JSON.stringify(data) }) }
export function updateDisciplineStudy(id, data) { return request(`/api/supervision/discipline-study/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteDisciplineStudy(id) { return request(`/api/supervision/discipline-study/${id}`, { method: 'DELETE' }) }

// ── 监督中心 · 廉政警示教育 ──────────────────────────

export function fetchWarningEdu() { return request('/api/supervision/warning-edu') }
export function createWarningEdu(data) { return request('/api/supervision/warning-edu', { method: 'POST', body: JSON.stringify(data) }) }
export function updateWarningEdu(id, data) { return request(`/api/supervision/warning-edu/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteWarningEdu(id) { return request(`/api/supervision/warning-edu/${id}`, { method: 'DELETE' }) }

// ── 监督中心 · 监督检查记录 ──────────────────────────

export function fetchInspections() { return request('/api/supervision/inspection') }
export function createInspection(data) { return request('/api/supervision/inspection', { method: 'POST', body: JSON.stringify(data) }) }
export function updateInspection(id, data) { return request(`/api/supervision/inspection/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteInspection(id) { return request(`/api/supervision/inspection/${id}`, { method: 'DELETE' }) }

// ── 任务管理 ──────────────────────────────────────

export function fetchAdminTasks() { return request('/api/admin/tasks') }
export function fetchAdminTask(id) { return request(`/api/admin/tasks/${id}`) }
export function createTask(data) { return request('/api/admin/tasks', { method: 'POST', body: JSON.stringify(data) }) }
export function updateTask(id, data) { return request(`/api/admin/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteTask(id) { return request(`/api/admin/tasks/${id}`, { method: 'DELETE' }) }
export function assignTask(id, memberIds) { return request(`/api/admin/tasks/${id}/assign`, { method: 'POST', body: JSON.stringify(memberIds) }) }

// ── 数据导出 ──────────────────────────────────────

function downloadBlob(path, filename) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API_BASE}${path}`, { headers })
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.blob() })
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    })
}

export function exportMembers() { return downloadBlob('/api/members/export', '党员信息.xlsx') }
export function exportLearningRecords() { return downloadBlob('/api/learning-records/export', '学习记录.xlsx') }

// ── 党费智能导入 ──────────────────────────────────

export function importDuesPreview(formData) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API_BASE}/api/dues/import`, { method: 'POST', headers, body: formData }).then(r => r.json())
}
export function confirmDuesImport(records) { return request('/api/dues/import/confirm', { method: 'POST', body: JSON.stringify({ records }) }) }

// ── 党小组管理 ──────────────────────────────────────

export function fetchPartyGroups() { return request('/api/party-groups') }
export function createPartyGroup(data) { return request('/api/party-groups', { method: 'POST', body: JSON.stringify(data) }) }
export function updatePartyGroup(id, data) { return request(`/api/party-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deletePartyGroup(id) { return request(`/api/party-groups/${id}`, { method: 'DELETE' }) }
export function fetchPartyGroupMembers(id) { return request(`/api/party-groups/${id}/members`) }

// ── 组织关系转接 ──────────────────────────────────────

export function fetchTransfers({ search = '', status = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  return request(`/api/transfers?${params}`)
}
export function createTransfer(data) { return request('/api/transfers', { method: 'POST', body: JSON.stringify(data) }) }
export function updateTransfer(id, data) { return request(`/api/transfers/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteTransfer(id) { return request(`/api/transfers/${id}`, { method: 'DELETE' }) }

// ── 流动党员管理 ──────────────────────────────────────

export function fetchFloatingMembers({ search = '', float_type = '', status = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (float_type) params.set('float_type', float_type)
  if (status) params.set('status', status)
  return request(`/api/floating-members?${params}`)
}
export function createFloatingMember(data) { return request('/api/floating-members', { method: 'POST', body: JSON.stringify(data) }) }
export function updateFloatingMember(id, data) { return request(`/api/floating-members/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteFloatingMember(id) { return request(`/api/floating-members/${id}`, { method: 'DELETE' }) }

// ── 制度汇编 ──────────────────────────────────────

export function fetchRegulations({ search = '', category = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (category) params.set('category', category)
  return request(`/api/regulations?${params}`)
}
export function createRegulation(data) { return request('/api/regulations', { method: 'POST', body: JSON.stringify(data) }) }
export function updateRegulation(id, data) { return request(`/api/regulations/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteRegulation(id) { return request(`/api/regulations/${id}`, { method: 'DELETE' }) }

// ── 归档管理 ──────────────────────────────────────

export function fetchArchives({ search = '', status = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  return request(`/api/archives?${params}`)
}
export function createArchive(data) { return request('/api/archives', { method: 'POST', body: JSON.stringify(data) }) }
export function updateArchive(id, data) { return request(`/api/archives/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteArchive(id) { return request(`/api/archives/${id}`, { method: 'DELETE' }) }

// ── 党费票据管理 ──────────────────────────────────────

export function fetchDuesReceipts({ search = '', year = 0, month = 0, status = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  if (status) params.set('status', status)
  return request(`/api/dues-receipts?${params}`)
}
export function createDuesReceipt(data) { return request('/api/dues-receipts', { method: 'POST', body: JSON.stringify(data) }) }
export function updateDuesReceipt(id, data) { return request(`/api/dues-receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteDuesReceipt(id) { return request(`/api/dues-receipts/${id}`, { method: 'DELETE' }) }

// ── 党费使用公示 ──────────────────────────────────────

export function fetchDuesPublic({ search = '', category = '', status = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (category) params.set('category', category)
  if (status) params.set('status', status)
  return request(`/api/dues-public?${params}`)
}
export function createDuesPublic(data) { return request('/api/dues-public', { method: 'POST', body: JSON.stringify(data) }) }
export function updateDuesPublic(id, data) { return request(`/api/dues-public/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteDuesPublic(id) { return request(`/api/dues-public/${id}`, { method: 'DELETE' }) }

// ── 任务考核 ──────────────────────────────────────

export function fetchTaskProgress(params) {
  const qs = new URLSearchParams(params || {}).toString()
  return request(`/api/task-progress${qs ? '?' + qs : ''}`)
}

export async function fetchIndicators(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/indicators${qs ? '?' + qs : ''}`)
}
export function createIndicator(data) { return request('/api/indicators', { method: 'POST', body: JSON.stringify(data) }) }
export function updateIndicator(id, data) { return request(`/api/indicators/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteIndicator(id) { return request(`/api/indicators/${id}`, { method: 'DELETE' }) }

export async function fetchEvaluations(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/evaluations${qs ? '?' + qs : ''}`)
}
export function createEvaluation(data) { return request('/api/evaluations', { method: 'POST', body: JSON.stringify(data) }) }
export function updateEvaluation(id, data) { return request(`/api/evaluations/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteEvaluation(id) { return request(`/api/evaluations/${id}`, { method: 'DELETE' }) }
