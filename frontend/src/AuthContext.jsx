import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)
const API = axios.create({ baseURL: 'http://localhost:8000' })

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('cg_token'))
  const [loading, setLoading] = useState(true)

  // Verify token on load
  useEffect(() => {
    if (!token) { setLoading(false); return }
    API.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => {
      setUser(r.data)
      setLoading(false)
    }).catch(() => {
      localStorage.removeItem('cg_token')
      setToken(null)
      setLoading(false)
    })
  }, [])

  const login = async (email, password) => {
    const r = await API.post('/auth/login', { email, password })
    localStorage.setItem('cg_token', r.data.token)
    setToken(r.data.token)
    setUser(r.data.user)
    return r.data
  }

  const register = async (email, password) => {
    const r = await API.post('/auth/register', { email, password })
    localStorage.setItem('cg_token', r.data.token)
    setToken(r.data.token)
    setUser(r.data.user)
    return r.data
  }

  const logout = () => {
    localStorage.removeItem('cg_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)