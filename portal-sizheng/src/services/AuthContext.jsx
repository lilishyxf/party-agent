import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getToken, setToken, clearToken, adminLogin, fetchAdminMe } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    try {
      const me = await fetchAdminMe()
      setUser(me)
    } catch { clearToken(); setUser(null) }
    setLoading(false)
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (username, password) => {
    const res = await adminLogin(username, password)
    if (res.status !== 'ok') return res.message || '登录失败'
    setToken(res.token)
    setUser(res.user)
    return null
  }

  const logout = () => { clearToken(); setUser(null) }
  const updateUser = (u) => setUser(u)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
