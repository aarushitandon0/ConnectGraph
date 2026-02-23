import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthPage from './AuthPage.jsx'
import { AuthProvider, useAuth } from './AuthContext.jsx'

function Root() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#060609',
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
      color: '#505070', letterSpacing: '0.1em',
    }}>
      LOADING...
    </div>
  )

  return user ? <App /> : <AuthPage />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>
)