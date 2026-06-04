const API_BASE = import.meta.env.VITE_API_URL ?? ''

const TOKEN_KEY = 'admin_token'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(`${API_BASE}${path}`, { headers, ...options })
  if (resp.status === 401) { clearToken(); throw new Error('401') }
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`)
  return resp.json()
}

// ── Auth ──────────────────────────────────────────────

export async function adminLogin(username, password) {
  const resp = await fetch(`${API_BASE}/api/sizheng/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!resp.ok) throw new Error('登录失败')
  const data = await resp.json()
  if (data.token) setToken(data.token)
  return data
}

export async function fetchAdminMe() {
  return request('/api/sizheng/admin/me')
}

export async function changeAdminPassword(data) {
  return request('/api/sizheng/admin/change-password', { method: 'POST', body: JSON.stringify(data) })
}

// ── AI 视频引擎 ──────────────────────────────────────

export function suggestSizhengAngles(knowledgePoint) {
  return request('/api/video/suggest-angles', { method: 'POST', body: JSON.stringify({ knowledge_point: knowledgePoint }) })
}

export function createVideoProject(data) {
  return request('/api/video/projects', { method: 'POST', body: JSON.stringify(data) })
}

export function fetchVideoProjects(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/api/video/projects${qs ? '?' + qs : ''}`)
}

export function fetchVideoProject(id) {
  return request(`/api/video/projects/${id}`)
}

export function fetchVideoProjectStatus(id) {
  return request(`/api/video/projects/${id}/status`)
}

export function reviewScene(projectId, sceneId, data) {
  return request(`/api/video/projects/${projectId}/scenes/${sceneId}/review`, {
    method: 'POST', body: JSON.stringify(data)
  })
}

export function regenerateScene(projectId, sceneId, data) {
  return request(`/api/video/projects/${projectId}/scenes/${sceneId}/regenerate`, {
    method: 'POST', body: JSON.stringify(data)
  })
}

export function cancelVideoProject(id) {
  return request(`/api/video/projects/${id}/cancel`, { method: 'POST' })
}

export function deleteVideoProject(id) {
  return request(`/api/video/projects/${id}`, { method: 'DELETE' })
}

export function fetchStyleTracks() {
  return request('/api/video/style-tracks')
}

export function startImageGen(projectId) {
  return request(`/api/video/projects/${projectId}/start-image-gen`, { method: 'POST' })
}

export function startVideoGen(projectId) {
  return request(`/api/video/projects/${projectId}/start-video-gen`, { method: 'POST' })
}

export function fetchVideoBudgetSummary() {
  return request('/api/video/budget/summary')
}

export function getVideoDownloadUrl(projectId) {
  const token = getToken()
  return `${API_BASE}/api/video/projects/${projectId}/download?token=${encodeURIComponent(token || '')}`
}
