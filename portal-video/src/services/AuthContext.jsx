import { createContext, useContext, useState, useEffect } from 'react'
import { fetchAdminMe, clearToken, getToken } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    fetchAdminMe()
      .then(u => setUser(u.user || u))
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const login = (userData) => setUser(userData)
  const logout = () => { clearToken(); setUser(null) }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
