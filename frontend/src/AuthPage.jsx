import { useState } from 'react'
import { useAuth } from './AuthContext'

const T = {
  bg0:   '#060609',
  bg1:   '#0b0b12',
  bg2:   '#0f0f1a',
  bg3:   '#141424',
  line1: '#181828',
  line2: '#20203a',
  line3: '#2a2a48',
  tx0:   '#e8e8f8',
  tx1:   '#9090b8',
  tx2:   '#505070',
  tx3:   '#2c2c48',
  bl:    '#4488ff',
  blD:   '#000a1a',
  blL:   '#001840',
  rd:    '#ff3355',
  rdD:   '#160008',
  rdL:   '#3d0018',
}

const MONO = "'IBM Plex Mono', 'Fira Code', monospace"

// ── Field must be defined BEFORE AuthPage uses it ──
function Field({ label, type, value, onChange, placeholder, onEnter }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{
        fontSize: 9, color: T.tx2, letterSpacing: '0.12em',
        fontWeight: 700, display: 'block', marginBottom: 6,
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter()}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 13px', borderRadius: 6,
          border: `1px solid ${focused ? T.bl + '80' : T.line2}`,
          background: T.bg0, color: T.tx0, fontSize: 12,
          fontFamily: MONO, outline: 'none',
          transition: 'border-color 0.15s', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.'); return
    }
    if (mode === 'register') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.'); return
      }
      if (password !== confirm) {
        setError('Passwords do not match.'); return
      }
    }
    setLoading(true)
    try {
      if (mode === 'login')    await login(email.trim(), password)
      if (mode === 'register') await register(email.trim(), password)
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Something went wrong. Try again.')
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
    setPassword('')
    setConfirm('')
  }

  return (
    <div style={{
      height: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: T.bg0, fontFamily: MONO,
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(${T.line1} 1px, transparent 1px),
          linear-gradient(90deg, ${T.line1} 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px', opacity: 0.4,
      }} />

      {/* Glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.bl}08 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 420, background: T.bg1,
        border: `1px solid ${T.line2}`,
        borderRadius: 12, padding: '36px 40px',
        boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${T.bl}12`,
      }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: T.blD, border: `1px solid ${T.blL}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: T.bl, margin: '0 auto 16px',
          }}>⬡</div>
          <h1 style={{
            fontSize: 18, fontWeight: 700, color: T.tx0,
            margin: '0 0 6px', letterSpacing: '-0.01em', fontFamily: MONO,
          }}>ConceptGraph</h1>
          <p style={{ fontSize: 11, color: T.tx2, margin: 0, letterSpacing: '0.05em' }}>
            {mode === 'login' ? 'SIGN IN TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: T.bg0,
          border: `1px solid ${T.line2}`, borderRadius: 7,
          padding: 4, marginBottom: 24, gap: 4,
        }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setPassword(''); setConfirm('') }}
              style={{
                flex: 1, padding: '8px', borderRadius: 5, border: 'none',
                background: mode === m ? T.bg3 : 'transparent',
                color: mode === m ? T.tx0 : T.tx2,
                fontSize: 10, fontWeight: 700, fontFamily: MONO,
                cursor: 'pointer', letterSpacing: '0.1em', transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'SIGN IN' : 'REGISTER'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <Field
            label="EMAIL" type="email" value={email} onChange={setEmail}
            placeholder="you@example.com" onEnter={handleSubmit}
          />
          <Field
            label="PASSWORD" type="password" value={password} onChange={setPassword}
            placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            onEnter={handleSubmit}
          />
          {mode === 'register' && (
            <Field
              label="CONFIRM PASSWORD" type="password" value={confirm} onChange={setConfirm}
              placeholder="Repeat your password" onEnter={handleSubmit}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: T.rdD, border: `1px solid ${T.rdL}`,
            borderRadius: 6, padding: '10px 13px', marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, color: T.rd, margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', borderRadius: 7,
            border: `1px solid ${loading ? T.blL + '80' : T.blL}`,
            background: loading ? T.blD : T.bl + '22',
            color: loading ? T.tx2 : T.bl,
            fontSize: 12, fontWeight: 700, fontFamily: MONO,
            cursor: loading ? 'wait' : 'pointer',
            letterSpacing: '0.1em', transition: 'all 0.2s ease',
            marginBottom: 16,
          }}
        >
          {loading
            ? 'PLEASE WAIT...'
            : mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'
          }
        </button>

        {/* Switch mode */}
        <p style={{ textAlign: 'center', fontSize: 11, color: T.tx2, margin: 0 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={switchMode} style={{
            background: 'none', border: 'none', color: T.bl,
            fontSize: 11, fontFamily: MONO, cursor: 'pointer',
            textDecoration: 'underline', padding: 0,
          }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>

      </div>
    </div>
  )
}