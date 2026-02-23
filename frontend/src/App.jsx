/**
 * ConceptGraph — Full rewrite
 * Features: multi-topic graph, AI explain/suggest/quiz/chat, roadmap generator,
 *           resizable panel, locked-state prereqs, resource tracking, mark complete
 */

// AUTH CHANGE 1: added useMemo to imports
import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import ReactFlow, {
  Background, Controls, useNodesState, useEdgesState, MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import axios from 'axios'
import { useAuth } from './AuthContext'

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
// AUTH CHANGE 3: removed module-level API — now built inside App() with token

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  // backgrounds
  bg0:     '#060609',
  bg1:     '#0b0b12',
  bg2:     '#0f0f1a',
  bg3:     '#141424',

  // borders
  line1:   '#181828',
  line2:   '#20203a',
  line3:   '#2a2a48',

  // text
  tx0:     '#e8e8f8',
  tx1:     '#9090b8',
  tx2:     '#505070',
  tx3:     '#2c2c48',

  // accents
  gr:      '#00f0a8',   // green  — mastered
  grD:     '#001a10',
  grL:     '#003d28',

  bl:      '#4488ff',   // blue   — unlocked
  blD:     '#000a1a',
  blL:     '#001840',

  am:      '#ffaa00',   // amber  — frontier
  amD:     '#160e00',
  amL:     '#3d2800',

  rd:      '#ff3355',   // red    — locked / error
  rdD:     '#160008',
  rdL:     '#3d0018',

  pu:      '#9955ff',   // purple — AI
  puD:     '#0a0018',
  puL:     '#280048',

  cy:      '#00ccff',   // cyan   — generate
  cyD:     '#001520',
  cyL:     '#003040',
}

const MONO = "'IBM Plex Mono', 'Fira Code', 'Consolas', monospace"

// ─────────────────────────────────────────────────────────────
// GRAPH UTILITIES
// ─────────────────────────────────────────────────────────────
function conceptState(id, mastered, unlocked, frontier) {
  if (mastered.includes(id)) return 'mastered'
  if (unlocked.includes(id)) return 'unlocked'
  if (frontier.includes(id)) return 'frontier'
  return 'locked'
}

function stateColors(state) {
  switch (state) {
    case 'mastered': return { bg: T.grD, bd: T.gr,  tx: T.gr  }
    case 'unlocked': return { bg: T.blD, bd: T.bl,  tx: T.tx0 }
    case 'frontier': return { bg: T.amD, bd: T.am,  tx: T.am  }
    default:         return { bg: T.bg3, bd: T.line2, tx: T.tx3 }
  }
}

function makeNodeStyle(id, mastered, unlocked, frontier) {
  const s = conceptState(id, mastered, unlocked, frontier)
  const c = stateColors(s)
  return {
    background: c.bg,
    border: `1px solid ${c.bd}`,
    color: c.tx,
    borderRadius: '6px',
    fontSize: '11px',
    fontFamily: MONO,
    fontWeight: 500,
    width: 192,
    height: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    letterSpacing: '0.01em',
    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
    padding: '0 10px',
    lineHeight: 1.3,
    boxSizing: 'border-box',
  }
}

function buildHierarchicalLayout(path, edges) {
  const ids = path.map(c => c.id)
  const inDeg = {}, adj = {}
  ids.forEach(id => { inDeg[id] = 0; adj[id] = [] })
  edges.forEach(({ from, to }) => {
    if (adj[from] != null) adj[from].push(to)
    if (inDeg[to] != null) inDeg[to]++
  })

  // BFS layering (longest path from root)
  const layer = {}
  const queue = ids.filter(id => inDeg[id] === 0)
  queue.forEach(id => { layer[id] = 0 })
  let head = 0
  while (head < queue.length) {
    const n = queue[head++]
    for (const nb of (adj[n] || [])) {
      layer[nb] = Math.max(layer[nb] ?? 0, layer[n] + 1)
      if (!queue.includes(nb)) queue.push(nb)
    }
  }

  const byLayer = {}
  ids.forEach(id => {
    const l = layer[id] ?? 0
    ;(byLayer[l] = byLayer[l] || []).push(id)
  })

  const NW = 192, NH = 50, GX = 48, GY = 90
  const positions = {}
  for (const [l, lids] of Object.entries(byLayer)) {
    const span = lids.length * NW + (lids.length - 1) * GX
    lids.forEach((id, i) => {
      positions[id] = {
        x: i * (NW + GX) - span / 2 + NW / 2,
        y: Number(l) * (NH + GY),
      }
    })
  }

  return path.map(c => ({
    id: String(c.id),
    position: positions[c.id] ?? { x: 0, y: 0 },
    data: { label: c.name },
    type: 'default',
    style: makeNodeStyle(c.id, [], [], []),
  }))
}

function makeEdges(edgeList) {
  return edgeList.map(e => ({
    id: `e-${e.from}-${e.to}`,
    source: String(e.from),
    target: String(e.to),
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: T.line3,
      width: 12,
      height: 12,
    },
    style: { stroke: T.line3, strokeWidth: 1.5 },
  }))
}

function getBlockers(conceptId, rawEdges, learningPath, mastered) {
  return rawEdges
    .filter(e => e.to === conceptId && !mastered.includes(e.from))
    .map(e => ({
      id: e.from,
      name: learningPath.find(c => c.id === e.from)?.name ?? `Concept #${e.from}`,
    }))
}

// ─────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────
const Pill = memo(({ label, color, bg }) => (
  <span style={{
    fontSize: 8, color, background: bg,
    border: `1px solid ${color}50`,
    borderRadius: 3, padding: '2px 7px',
    letterSpacing: '0.12em', fontWeight: 700,
    fontFamily: MONO, whiteSpace: 'nowrap',
  }}>{label}</span>
))

function StatePill({ state }) {
  const map = {
    mastered: { label: 'MASTERED', color: T.gr,  bg: T.grD },
    unlocked: { label: 'UNLOCKED', color: T.bl,  bg: T.blD },
    frontier: { label: 'ALMOST',   color: T.am,  bg: T.amD },
    locked:   { label: 'LOCKED',   color: T.rd,  bg: T.rdD },
  }
  const p = map[state] ?? map.locked
  return <Pill {...p} />
}

function DiffPill({ level }) {
  const map = {
    1: { label: 'BEGINNER',     color: T.gr, bg: T.grD },
    2: { label: 'EASY',         color: T.bl, bg: T.blD },
    3: { label: 'INTERMEDIATE', color: T.am, bg: T.amD },
    4: { label: 'HARD',         color: T.rd, bg: T.rdD },
    5: { label: 'ADVANCED',     color: T.rd, bg: T.rdD },
  }
  const p = map[level] ?? map[1]
  return <Pill {...p} />
}

function Btn({ children, onClick, disabled, color = T.tx1, bg = T.bg3, border = T.line3, style = {} }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && !disabled ? bg + 'dd' : bg,
        border: `1px solid ${hover && !disabled ? border + 'cc' : border}`,
        color: disabled ? T.tx2 : color,
        borderRadius: 6, padding: '9px 14px',
        fontSize: 11, fontWeight: 700, fontFamily: MONO,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '0.07em',
        transition: 'all 0.15s ease',
        outline: 'none',
        ...style,
      }}
    >{children}</button>
  )
}

function Tag({ label, val, color = T.tx1 }) {
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      background: T.bg2, border: `1px solid ${T.line2}`,
      borderRadius: 5, padding: '4px 10px',
    }}>
      <span style={{ fontSize: 9, color: T.tx2, letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontSize: 10, color, fontWeight: 700 }}>{val}</span>
    </div>
  )
}

function SectionHeader({ label, count, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.12em' }}>{label}</span>
      <span style={{
        fontSize: 9, color,
        background: color + '18',
        border: `1px solid ${color}35`,
        borderRadius: 3, padding: '1px 7px',
        fontWeight: 700,
      }}>{count}</span>
    </div>
  )
}

function ConceptChip({ name, color }) {
  return (
    <div style={{
      fontSize: 11, color,
      background: color + '0c',
      border: `1px solid ${color}22`,
      borderRadius: 4, padding: '5px 10px', marginBottom: 3,
      lineHeight: 1.4,
    }}>{name}</div>
  )
}

function EmptyHint({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 12px' }}>
      <div style={{ fontSize: 22, marginBottom: 10, color: T.tx2 }}>{icon}</div>
      <p style={{ fontSize: 11, color: T.tx2, lineHeight: 1.7, margin: 0 }}>{text}</p>
    </div>
  )
}

function LockedBanner() {
  return (
    <div style={{ background: T.rdD, border: `1px solid ${T.rdL}`, borderRadius: 7, padding: '12px 14px' }}>
      <p style={{ fontSize: 11, color: T.rd, margin: 0, lineHeight: 1.6 }}>
        🔒 Unlock this concept first before using AI features.
      </p>
    </div>
  )
}

function ConceptBadge({ name }) {
  return (
    <div style={{
      background: T.bg1, border: `1px solid ${T.line2}`,
      borderRadius: 6, padding: '9px 13px',
    }}>
      <p style={{ fontSize: 9, color: T.tx2, marginBottom: 4, letterSpacing: '0.1em' }}>SELECTED CONCEPT</p>
      <p style={{ fontSize: 13, color: T.tx0, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{name}</p>
    </div>
  )
}

function AiBox({ children, loading, loadingText = '✦ THINKING...' }) {
  if (loading) return (
    <div style={{
      background: T.puD, border: `1px solid ${T.puL}`,
      borderRadius: 7, padding: '18px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: T.pu, letterSpacing: '0.08em' }}>{loadingText}</div>
    </div>
  )
  if (!children) return null
  return (
    <div style={{
      background: T.puD, border: `1px solid ${T.puL}`,
      borderRadius: 7, padding: '14px 16px',
    }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// GENERATE MODAL
// ─────────────────────────────────────────────────────────────
function GenerateModal({ onClose, onGenerated, api }) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState('')
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  const run = () => {
    if (!input.trim() || loading) return
    setLoading(true); setError(''); setResult(null)
    api.post('/roadmap/generate', { topic: input.trim() })
      .then(r => { setResult(r.data); setLoading(false) })
      .catch(e => {
        setError(e.response?.data?.detail ?? 'Generation failed — please try again.')
        setLoading(false)
      })
  }

  const EXAMPLES = [
    'Machine Learning', 'Web Development', 'System Design',
    'DevOps', 'Computer Networks', 'Operating Systems',
    'Cybersecurity', 'Blockchain', 'Mobile Development',
  ]

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(6,6,9,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        fontFamily: MONO,
      }}
    >
      <div style={{
        width: 540, background: T.bg2,
        border: `1px solid ${T.line3}`,
        borderRadius: 12, padding: '30px 34px',
        boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px ${T.pu}18`,
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <span style={{ color: T.cy, fontSize: 15 }}>◈</span>
              <span style={{ fontSize: 10, color: T.cy, fontWeight: 700, letterSpacing: '0.14em' }}>AI ROADMAP GENERATOR</span>
            </div>
            <p style={{ fontSize: 11, color: T.tx1, margin: 0, lineHeight: 1.7, maxWidth: 380 }}>
              Type any subject — AI will design a validated learning graph with concepts, prerequisites, and difficulty levels.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: `1px solid ${T.line2}`,
            color: T.tx2, borderRadius: 5, padding: '4px 9px',
            cursor: 'pointer', fontSize: 12, fontFamily: MONO, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setResult(null); setError('') }}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="e.g. Machine Learning, Web Dev, Linux..."
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 6,
              border: `1px solid ${T.line3}`, background: T.bg1,
              color: T.tx0, fontSize: 12, fontFamily: MONO, outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = T.cy }}
            onBlur={e => { e.target.style.borderColor = T.line3 }}
          />
          <Btn
            onClick={run}
            disabled={loading || !input.trim()}
            color={T.cy} bg={T.cyD} border={T.cyL}
            style={{ whiteSpace: 'nowrap', padding: '11px 18px' }}
          >
            {loading ? '◈ BUILDING...' : '◈ GENERATE'}
          </Btn>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{
            background: T.puD, border: `1px solid ${T.puL}`,
            borderRadius: 8, padding: '22px', textAlign: 'center', marginBottom: 18,
          }}>
            <div style={{ fontSize: 20, color: T.pu, marginBottom: 10 }}>◈</div>
            <p style={{ fontSize: 11, color: '#9966cc', margin: 0, lineHeight: 1.8 }}>
              Groq is designing your roadmap...<br />
              <span style={{ fontSize: 10, color: T.tx2 }}>Generating concepts → building edges → validating DAG</span>
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: T.rdD, border: `1px solid ${T.rdL}`,
            borderRadius: 8, padding: '13px 16px', marginBottom: 16,
          }}>
            <p style={{ fontSize: 11, color: T.rd, margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* Success */}
        {result && !loading && (
          <div style={{
            background: T.grD, border: `1px solid ${T.grL}`,
            borderRadius: 8, padding: '18px 20px', marginBottom: 18,
          }}>
            <p style={{ fontSize: 9, color: T.gr, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 10 }}>✓ GENERATED & VALIDATED</p>
            <p style={{ fontSize: 14, color: T.tx0, fontWeight: 600, marginBottom: 14 }}>{result.topic_name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'CONCEPTS', val: result.concept_count, color: T.bl },
                { label: 'EDGES',    val: result.edge_count,    color: T.am },
                { label: 'DAG',      val: '✓ VALID',            color: T.gr },
              ].map(({ label, val, color }) => (
                <div key={label} style={{
                  background: T.bg1, border: `1px solid ${T.line2}`,
                  borderRadius: 6, padding: '10px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 3 }}>{val}</div>
                  <div style={{ fontSize: 8, color: T.tx2, letterSpacing: '0.1em' }}>{label}</div>
                </div>
              ))}
            </div>
            <Btn
              onClick={() => { onGenerated(result.topic_id, result.topic_name); onClose() }}
              color="#000" bg={T.gr} border={T.grL}
              style={{ width: '100%', justifyContent: 'center' }}
            >LOAD ROADMAP →</Btn>
          </div>
        )}

        {/* Examples */}
        {!result && !loading && (
          <div>
            <p style={{ fontSize: 9, color: T.tx2, letterSpacing: '0.1em', marginBottom: 9 }}>QUICK EXAMPLES</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setInput(ex)} style={{
                  background: T.bg1, border: `1px solid ${T.line2}`,
                  borderRadius: 4, padding: '5px 10px',
                  fontSize: 10, color: T.tx1,
                  cursor: 'pointer', fontFamily: MONO,
                  transition: 'all 0.12s',
                }}
                  onMouseEnter={e => { e.target.style.borderColor = T.cy; e.target.style.color = T.cy }}
                  onMouseLeave={e => { e.target.style.borderColor = T.line2; e.target.style.color = T.tx1 }}
                >{ex}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TOPIC DROPDOWN
// ─────────────────────────────────────────────────────────────
function TopicDropdown({ topics, currentId, onSwitch, onOpenGenerate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = topics.find(t => t.id === currentId)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 50 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.bg2, border: `1px solid ${T.line3}`,
          borderRadius: 6, padding: '7px 12px',
          color: T.tx0, fontSize: 11, fontFamily: MONO,
          cursor: 'pointer', transition: 'all 0.15s',
          maxWidth: 240,
        }}
      >
        <span style={{ color: T.bl, fontSize: 12 }}>⬡</span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.name ?? 'Select topic'}
        </span>
        <span style={{ color: T.tx2, fontSize: 9 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: 280, background: T.bg2,
          border: `1px solid ${T.line3}`, borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '6px', maxHeight: 260, overflowY: 'auto' }}>
            {topics.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 11, color: T.tx2 }}>No topics yet</div>
            )}
            {topics.map(t => (
              <button key={t.id} onClick={() => { onSwitch(t.id); setOpen(false) }} style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                background: t.id === currentId ? T.blD : 'transparent',
                border: `1px solid ${t.id === currentId ? T.blL : 'transparent'}`,
                borderRadius: 5, marginBottom: 2,
                color: t.id === currentId ? T.bl : T.tx0,
                fontSize: 11, fontFamily: MONO, cursor: 'pointer',
                transition: 'all 0.1s', display: 'block',
              }}
                onMouseEnter={e => { if (t.id !== currentId) { e.currentTarget.style.background = T.bg3; e.currentTarget.style.color = T.tx0 } }}
                onMouseLeave={e => { if (t.id !== currentId) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.tx0 } }}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${T.line2}`, padding: '6px' }}>
            <button onClick={() => { onOpenGenerate(); setOpen(false) }} style={{
              width: '100%', padding: '9px 12px',
              background: T.cyD, border: `1px solid ${T.cyL}`,
              borderRadius: 5, color: T.cy,
              fontSize: 11, fontFamily: MONO, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 9,
              transition: 'all 0.15s',
            }}>
              <span>◈</span>
              <span>Generate New Roadmap</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AI CHAT THREAD
// ─────────────────────────────────────────────────────────────
function ChatThread({ history, loading, input, onInput, onSend }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [history, loading])

  return (
    <div>
      {history.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: 280, overflowY: 'auto', marginBottom: 10,
          padding: '4px 0',
        }}>
          {history.map((msg, i) => (
            <div key={i} style={{
              padding: '8px 11px', borderRadius: 6,
              background: msg.role === 'user' ? T.blD : T.bg1,
              border: `1px solid ${msg.role === 'user' ? T.blL : T.line1}`,
              fontSize: 11, color: msg.role === 'user' ? T.bl : T.tx1,
              lineHeight: 1.75,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
            }}>{msg.content}</div>
          ))}
          {loading && (
            <div style={{
              padding: '8px 11px', borderRadius: 6,
              background: T.bg1, border: `1px solid ${T.line1}`,
              fontSize: 11, color: T.tx2,
            }}>✦ thinking...</div>
          )}
          <div ref={endRef} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder="Ask a follow-up question..."
          style={{
            flex: 1, padding: '8px 11px', borderRadius: 5,
            border: `1px solid ${T.line3}`, background: T.bg1,
            color: T.tx0, fontSize: 11, fontFamily: MONO, outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = T.pu }}
          onBlur={e => { e.target.style.borderColor = T.line3 }}
        />
        <button onClick={onSend} disabled={!input.trim() || loading} style={{
          padding: '8px 13px', borderRadius: 5,
          border: `1px solid ${T.puL}`,
          background: T.puD, color: T.pu,
          fontSize: 13, cursor: 'pointer', fontFamily: MONO,
          transition: 'all 0.15s', outline: 'none',
        }}>→</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  // ── AUTH CHANGE 4a: get user/token/logout from context ──
  const { user, token, logout } = useAuth()

  // ── AUTH CHANGE 4b: authenticated API instance ──
  const API = useMemo(() => {
    const instance = axios.create({ baseURL: 'http://localhost:8000' })
    instance.interceptors.request.use(config => {
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })
    return instance
  }, [token])

  // Graph state
  const [nodes,        setNodes,        onNodesChange] = useNodesState([])
  const [edges,        setEdges,        onEdgesChange] = useEdgesState([])
  const [learningPath, setLearningPath] = useState([])
  const [rawEdges,     setRawEdges]     = useState([])
  const [mastered,     setMastered]     = useState([])
  const [unlocked,     setUnlocked]     = useState([])
  const [frontier,     setFrontier]     = useState([])
  const [graphLoading, setGraphLoading] = useState(true)

  // Topics
  const [topics,         setTopics]        = useState([])
  const [currentTopicId, setCurrentTopicId]= useState(null)

  // Panel
  const [rightTab,    setRightTab]    = useState('progress')
  const [panelWidth,  setPanelWidth]  = useState(350)
  const isResizing = useRef(false)
  const resizeStart = useRef({ x: 0, w: 350 })

  // Modals
  const [showGenerate, setShowGenerate] = useState(false)

  // Selected concept
  const [selectedId,    setSelectedId]    = useState(null)
  const [conceptDetail, setConceptDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [checkedRes,    setCheckedRes]    = useState({})       // { conceptId: [url] }

  // AI — Suggest
  const [aiTab,          setAiTab]          = useState('suggest')
  const [suggestion,     setSuggestion]     = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)

  // AI — Explain + Chat
  const [explanation,    setExplanation]    = useState('')
  const [explainLoading, setExplainLoading] = useState(false)
  const [chatHistory,    setChatHistory]    = useState([])
  const [chatInput,      setChatInput]      = useState('')
  const [chatLoading,    setChatLoading]    = useState(false)

  // AI — Quiz
  const [quizData,      setQuizData]      = useState(null)
  const [quizLoading,   setQuizLoading]   = useState(false)
  const [quizAnswer,    setQuizAnswer]    = useState(null)
  const [prevQuestions, setPrevQuestions] = useState([])

  // ── Resize ──
  useEffect(() => {
    const onMove = e => {
      if (!isResizing.current) return
      const delta = resizeStart.current.x - e.clientX
      setPanelWidth(Math.min(660, Math.max(280, resizeStart.current.w + delta)))
    }
    const onUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const startResize = e => {
    isResizing.current = true
    resizeStart.current = { x: e.clientX, w: panelWidth }
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  // ── Data helpers ──
  const getName = useCallback(id => learningPath.find(c => c.id === id)?.name ?? '', [learningPath])

  const loadTopics = useCallback(() =>
    API.get('/roadmap/').then(r => {
      const t = r.data.topics
      setTopics(t)
      return t
    }), [API])

  const loadTopic = useCallback(topicId => {
    setGraphLoading(true)
    setSelectedId(null); setConceptDetail(null)
    setMastered([]); setUnlocked([]); setFrontier([])
    setCurrentTopicId(topicId)

    return Promise.all([
      API.get(`/topics/${topicId}/path`),
      API.get(`/topics/${topicId}/edges`),
      API.get(`/progress/${topicId}`),        // AUTH CHANGE 4c: load saved progress
    ]).then(([pr, er, pgr]) => {
      const path     = pr.data.learning_path
      const edgeList = er.data.edges
      setLearningPath(path)
      setRawEdges(edgeList)
      setNodes(buildHierarchicalLayout(path, edgeList))
      setEdges(makeEdges(edgeList))
      setMastered(pgr.data.mastered_ids)      // AUTH CHANGE 4d: restore saved progress
      setGraphLoading(false)
    })
  }, [API])

  // Initial bootstrap
  useEffect(() => {
    loadTopics().then(t => {
      if (t.length > 0) {
        // Load the oldest created topic first (the user's original DSA topic)
        const first = [...t].sort((a, b) => a.id - b.id)[0]
        loadTopic(first.id)
      } else {
        setGraphLoading(false)
        setShowGenerate(true)
      }
    })
  }, [API])

  // Progress refresh
  const refreshProgress = useCallback((m, tid) => {
    const topicId = tid ?? currentTopicId
    if (!topicId) return
    Promise.all([
      API.post(`/topics/${topicId}/unlocked`, { mastered_ids: m }),
      API.post(`/topics/${topicId}/frontier`, { mastered_ids: m }),
    ]).then(([u, f]) => {
      setUnlocked(u.data.unlocked.map(c => c.id))
      setFrontier(f.data.frontier.map(c => c.id))
    })
  }, [API, currentTopicId])

  useEffect(() => {
    if (learningPath.length > 0) refreshProgress(mastered)
  }, [mastered, learningPath])

  // Update node styles live
  useEffect(() => {
    setNodes(ns => ns.map(n => ({
      ...n,
      style: makeNodeStyle(Number(n.id), mastered, unlocked, frontier),
    })))
  }, [mastered, unlocked, frontier])

  // ── Node click ──
  const onNodeClick = useCallback((_, node) => {
    const id = Number(node.id)
    setSelectedId(id)
    setDetailLoading(true)
    setConceptDetail(null)
    // Reset AI state for new concept
    setExplanation('')
    setChatHistory([])
    setChatInput('')
    setQuizData(null)
    setQuizAnswer(null)
    setPrevQuestions([])
    setRightTab('progress')

    API.get(`/topics/concept/${id}`).then(r => {
      setConceptDetail(r.data)
      setDetailLoading(false)
    })
  }, [API])

  // ── Mastered toggle — AUTH CHANGE 4e: saves to DB ──
  const toggleMastered = id => {
    const nowMastered = !mastered.includes(id)
    setMastered(prev => nowMastered ? [...prev, id] : prev.filter(m => m !== id))
    API.post('/progress/toggle', { concept_id: id, mastered: nowMastered })
  }

  // ── Resource toggle ──
  const toggleRes = (conceptId, url) =>
    setCheckedRes(prev => {
      const cur = prev[conceptId] ?? []
      return {
        ...prev,
        [conceptId]: cur.includes(url) ? cur.filter(u => u !== url) : [...cur, url],
      }
    })

  // ── AI handlers ──
  const runSuggest = () => {
    setSuggestLoading(true); setSuggestion('')
    API.post('/ai/suggest', {
      mastered_names: mastered.map(getName),
      unlocked_names: unlocked.map(getName),
      frontier_names: frontier.map(getName),
    }).then(r => { setSuggestion(r.data.suggestion); setSuggestLoading(false) })
  }

  const runExplain = () => {
    if (!conceptDetail) return
    setExplainLoading(true); setExplanation(''); setChatHistory([])
    API.post('/ai/explain', {
      concept_name:        conceptDetail.name,
      concept_description: conceptDetail.description ?? '',
      mastered_names:      mastered.map(getName),
    }).then(r => { setExplanation(r.data.explanation); setExplainLoading(false) })
  }

  const runQuiz = (reset = false) => {
    if (!conceptDetail) return
    const prevQ = reset ? [] : (quizData?.question ? [...prevQuestions, quizData.question] : prevQuestions)
    setPrevQuestions(reset ? [] : prevQ)
    setQuizLoading(true); setQuizData(null); setQuizAnswer(null)
    API.post('/ai/quiz', {
      concept_name:       conceptDetail.name,
      mastered_names:     mastered.map(getName),
      previous_questions: prevQ,
    }).then(r => { setQuizData(r.data); setQuizLoading(false) })
  }

  const runChat = () => {
    if (!chatInput.trim() || !explanation) return
    const userMsg    = { role: 'user', content: chatInput.trim() }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory); setChatInput(''); setChatLoading(true)
    API.post('/ai/chat', {
      concept_name:   conceptDetail.name,
      explanation,
      question:       userMsg.content,
      mastered_names: mastered.map(getName),
      history:        chatHistory,
    }).then(r => {
      setChatHistory(h => [...h, { role: 'assistant', content: r.data.answer }])
      setChatLoading(false)
    })
  }

  const handleGenerated = (topicId) => {
    loadTopics().then(() => loadTopic(topicId))
  }

  // ── Derived state ──
  const pct = learningPath.length
    ? Math.round((mastered.length / learningPath.length) * 100) : 0

  const selectedState = selectedId
    ? conceptState(selectedId, mastered, unlocked, frontier) : null

  const isLocked = selectedState === 'locked'
  const blockers = selectedId
    ? getBlockers(selectedId, rawEdges, learningPath, mastered) : []

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: T.bg0, fontFamily: MONO, color: T.tx0,
    }}>

      {/* GENERATE MODAL */}
      {showGenerate && (
        <GenerateModal
          api={API}
          onClose={() => setShowGenerate(false)}
          onGenerated={handleGenerated}
        />
      )}

      {/* ══ ICON RAIL ══ */}
      <div style={{
        width: 58, flexShrink: 0,
        background: T.bg1, borderRight: `1px solid ${T.line1}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 0', gap: 4,
      }}>
        {/* Logo */}
        <div style={{
          width: 32, height: 32, borderRadius: 7,
          background: T.blD, border: `1px solid ${T.blL}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14, fontSize: 14, color: T.bl,
        }}>⬡</div>

        {/* Nav */}
        {[
          { icon: '⊞', tab: 'progress', tip: 'Progress' },
          { icon: '✦', tab: 'ai',       tip: 'AI Assistant' },
        ].map(({ icon, tab, tip }) => (
          <button key={tab} title={tip} onClick={() => setRightTab(tab)} style={{
            width: 36, height: 36, borderRadius: 7, border: 'none',
            background: rightTab === tab ? T.blD : 'transparent',
            color: rightTab === tab ? T.bl : T.tx2,
            fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { if (rightTab !== tab) e.currentTarget.style.color = T.tx1 }}
            onMouseLeave={e => { if (rightTab !== tab) e.currentTarget.style.color = T.tx2 }}
          >{icon}</button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Generate button */}
        <button title="Generate Roadmap" onClick={() => setShowGenerate(true)} style={{
          width: 36, height: 36, borderRadius: 7,
          border: `1px solid ${T.cyL}`,
          background: T.cyD, color: T.cy,
          fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = T.cy + '22' }}
          onMouseLeave={e => { e.currentTarget.style.background = T.cyD }}
        >◈</button>

        {/* AUTH CHANGE 4f: logout button */}
        <button
          title={`Sign out (${user?.email})`}
          onClick={logout}
          style={{
            width: 36, height: 36, borderRadius: 7,
            border: `1px solid ${T.rdL}`,
            background: T.rdD, color: T.rd,
            fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', marginTop: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.rd + '22' }}
          onMouseLeave={e => { e.currentTarget.style.background = T.rdD }}
        >⏻</button>

        {/* Progress % */}
        <div style={{ textAlign: 'center', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.line1}`, width: '100%' }}>
          <div style={{ fontSize: 10, color: T.gr, fontWeight: 700 }}>{pct}%</div>
          <div style={{ fontSize: 7, color: T.tx2, letterSpacing: '0.06em', marginTop: 1 }}>DONE</div>
        </div>
      </div>

      {/* ══ GRAPH CANVAS ══ */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: `linear-gradient(180deg, ${T.bg0}f0 55%, transparent)`,
          pointerEvents: 'none',
        }}>
          <div style={{ pointerEvents: 'all' }}>
            <TopicDropdown
              topics={topics}
              currentId={currentTopicId}
              onSwitch={loadTopic}
              onOpenGenerate={() => setShowGenerate(true)}
            />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6, pointerEvents: 'all' }}>
            <Tag label="V" val={learningPath.length} />
            <Tag label="E" val={rawEdges.length} />
            <Tag label="DAG" val="✓" color={T.gr} />
          </div>
        </div>

        {/* Graph / states */}
        {graphLoading ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: 22, color: T.pu }}>◈</span>
            <span style={{ fontSize: 11, color: T.tx2, letterSpacing: '0.1em' }}>LOADING...</span>
          </div>
        ) : learningPath.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 28, color: T.tx2 }}>⬡</span>
            <p style={{ fontSize: 12, color: T.tx2 }}>No topics yet</p>
            <Btn onClick={() => setShowGenerate(true)} color={T.cy} bg={T.cyD} border={T.cyL}>
              ◈ GENERATE YOUR FIRST ROADMAP
            </Btn>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView fitViewOptions={{ padding: 0.18 }}
            minZoom={0.1} maxZoom={2.5}
          >
            <Background
              color={T.line1} gap={28} size={1}
              style={{ background: T.bg0 }}
            />
            <Controls style={{
              background: T.bg2, border: `1px solid ${T.line2}`,
              borderRadius: 6, boxShadow: 'none', bottom: 54,
            }} />
          </ReactFlow>
        )}

        {/* Legend */}
        {!graphLoading && learningPath.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 14, left: 14,
            display: 'flex', gap: 14,
            background: T.bg2, border: `1px solid ${T.line2}`,
            borderRadius: 6, padding: '7px 14px',
          }}>
            {[
              { c: T.gr, l: 'Mastered' },
              { c: T.bl, l: 'Unlocked' },
              { c: T.am, l: 'One away' },
              { c: T.tx2, l: 'Locked'  },
            ].map(({ c, l }) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: T.tx2 }}>{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ RESIZE HANDLE ══ */}
      <div
        onMouseDown={startResize}
        style={{
          width: 4, flexShrink: 0, cursor: 'ew-resize',
          background: 'transparent',
          borderLeft: `1px solid ${T.line1}`,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = T.bl + '44' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      />

      {/* ══ RIGHT PANEL ══ */}
      <div style={{
        width: panelWidth, flexShrink: 0,
        background: T.bg1,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Main tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.line1}`, flexShrink: 0 }}>
          {[
            { tab: 'progress', label: '⊞  PROGRESS'     },
            { tab: 'ai',       label: '✦  AI ASSISTANT' },
          ].map(({ tab, label }) => (
            <button key={tab} onClick={() => setRightTab(tab)} style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'transparent',
              borderBottom: rightTab === tab ? `2px solid ${T.bl}` : '2px solid transparent',
              color: rightTab === tab ? T.bl : T.tx2,
              fontSize: 10, fontWeight: 700, fontFamily: MONO,
              letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* ── PROGRESS TAB ── */}
        {rightTab === 'progress' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Progress bar */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.line1}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 9, color: T.tx2, letterSpacing: '0.1em' }}>PROGRESS</span>
                <span style={{ fontSize: 10, color: T.gr, fontWeight: 700 }}>{mastered.length} / {learningPath.length}</span>
              </div>
              <div style={{ height: 3, background: T.line1, borderRadius: 2 }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg, ${T.gr}, ${T.bl})`,
                  borderRadius: 2, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
                <span style={{ fontSize: 9, color: T.tx2 }}>{pct}% complete</span>
                <span style={{ fontSize: 9, color: T.tx2 }}>{learningPath.length - mastered.length} remaining</span>
              </div>
            </div>

            {/* Concept detail card */}
            {selectedId && (
              <div style={{ borderBottom: `1px solid ${T.line1}`, flexShrink: 0 }}>
                {detailLoading ? (
                  <div style={{ padding: '14px 18px', fontSize: 10, color: T.tx2 }}>LOADING...</div>
                ) : conceptDetail ? (
                  <div style={{ padding: '16px 18px' }}>

                    {/* Concept header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ flex: 1, marginRight: 8 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                          <span style={{ fontSize: 9, color: T.tx2 }}>#{conceptDetail.id}</span>
                          <StatePill state={selectedState} />
                          <DiffPill level={conceptDetail.difficulty_level} />
                        </div>
                        <h3 style={{
                          fontSize: 14, fontWeight: 600, margin: 0,
                          color: isLocked ? T.tx3 : T.tx0, lineHeight: 1.35,
                        }}>
                          {conceptDetail.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => { setSelectedId(null); setConceptDetail(null) }}
                        style={{
                          background: 'none', border: `1px solid ${T.line2}`,
                          color: T.tx2, borderRadius: 4, padding: '3px 8px',
                          cursor: 'pointer', fontSize: 11, fontFamily: MONO, flexShrink: 0,
                        }}
                      >✕</button>
                    </div>

                    {/* Locked */}
                    {isLocked && blockers.length > 0 ? (
                      <div style={{
                        background: T.rdD, border: `1px solid ${T.rdL}`,
                        borderRadius: 7, padding: '11px 13px',
                      }}>
                        <p style={{ fontSize: 9, color: T.rd, fontWeight: 700, marginBottom: 8, letterSpacing: '0.09em' }}>
                          🔒 LOCKED — complete these first:
                        </p>
                        {blockers.map(p => (
                          <div
                            key={p.id}
                            onClick={() => onNodeClick(null, { id: String(p.id) })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '5px 9px', marginBottom: 3,
                              background: '#1e0008', borderRadius: 5,
                              border: `1px solid ${T.rd}18`, cursor: 'pointer',
                              transition: 'all 0.12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#280010' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#1e0008' }}
                          >
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: T.rd, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: '#cc4455', flex: 1 }}>{p.name}</span>
                            <span style={{ fontSize: 9, color: T.tx2 }}>→</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Description */}
                        {conceptDetail.description && (
                          <p style={{ fontSize: 11, color: T.tx1, lineHeight: 1.75, marginBottom: 13 }}>
                            {conceptDetail.description.split('\n').filter(Boolean)[0]}
                          </p>
                        )}

                        {/* Mark complete */}
                        <button
                          onClick={() => toggleMastered(selectedId)}
                          style={{
                            width: '100%', padding: '9px', marginBottom: 12,
                            borderRadius: 6,
                            border: `1px solid ${mastered.includes(selectedId) ? T.grL : T.line3}`,
                            background: mastered.includes(selectedId) ? T.grD : T.bg3,
                            color: mastered.includes(selectedId) ? T.gr : T.tx1,
                            fontSize: 11, fontWeight: 700, fontFamily: MONO,
                            cursor: 'pointer', letterSpacing: '0.07em',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {mastered.includes(selectedId) ? '✓  COMPLETED' : '○  MARK AS COMPLETE'}
                        </button>

                        {/* Resources */}
                        {conceptDetail.resources?.length > 0 && (
                          <>
                            <p style={{ fontSize: 9, color: T.tx2, letterSpacing: '0.1em', marginBottom: 8 }}>RESOURCES</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {conceptDetail.resources.map((url, i) => {
                                let hostname = url
                                try { hostname = new URL(url).hostname.replace('www.', '') } catch (_) {}
                                const checked = (checkedRes[selectedId] ?? []).includes(url)
                                return (
                                  <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 9,
                                    padding: '7px 10px',
                                    background: checked ? T.grD : T.bg0,
                                    border: `1px solid ${checked ? T.grL : T.line2}`,
                                    borderRadius: 5, transition: 'all 0.15s',
                                  }}>
                                    {/* Checkbox */}
                                    <div
                                      onClick={() => toggleRes(selectedId, url)}
                                      style={{
                                        width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                                        border: `1px solid ${checked ? T.gr : T.tx2}`,
                                        background: checked ? T.gr : 'transparent',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.15s',
                                      }}
                                    >
                                      {checked && <span style={{ fontSize: 9, color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                                    </div>
                                    <a
                                      href={url} target="_blank" rel="noopener noreferrer"
                                      style={{
                                        flex: 1, fontSize: 11,
                                        color: checked ? T.gr : T.bl,
                                        textDecoration: 'none',
                                        opacity: checked ? 0.5 : 1,
                                        textDecorationLine: checked ? 'line-through' : 'none',
                                        transition: 'all 0.15s',
                                      }}
                                    >{hostname}</a>
                                    <span style={{ fontSize: 10, color: T.tx2 }}>↗</span>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Progress lists */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
              {!selectedId && (
                <p style={{ fontSize: 10, color: T.tx2, lineHeight: 1.75, marginBottom: 16 }}>
                  Click any concept node on the graph to view details, mark it complete, and access resources.
                </p>
              )}

              {/* Unlocked */}
              <div style={{ marginBottom: 20 }}>
                <SectionHeader label="READY TO LEARN" count={unlocked.length} color={T.bl} />
                {unlocked.length === 0
                  ? <p style={{ fontSize: 10, color: T.tx3, fontStyle: 'italic' }}>None yet</p>
                  : unlocked.map(id => <ConceptChip key={id} name={getName(id)} color={T.bl} />)}
              </div>

              {/* Frontier */}
              <div style={{ marginBottom: 20 }}>
                <SectionHeader label="ONE STEP AWAY" count={frontier.length} color={T.am} />
                {frontier.length === 0
                  ? <p style={{ fontSize: 10, color: T.tx3, fontStyle: 'italic' }}>None yet</p>
                  : frontier.map(id => <ConceptChip key={id} name={getName(id)} color={T.am} />)}
              </div>

              {/* Mastered */}
              <div style={{ marginBottom: 20 }}>
                <SectionHeader label="MASTERED" count={mastered.length} color={T.gr} />
                {mastered.length === 0
                  ? <p style={{ fontSize: 10, color: T.tx3, fontStyle: 'italic' }}>None yet — click a node to start</p>
                  : mastered.map(id => <ConceptChip key={id} name={getName(id)} color={T.gr} />)}
              </div>
            </div>
          </div>
        )}

        {/* ── AI TAB ── */}
        {rightTab === 'ai' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* AI sub-tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.line1}`, flexShrink: 0 }}>
              {[
                { tab: 'suggest', label: '✦ SUGGEST' },
                { tab: 'explain', label: '◎ EXPLAIN' },
                { tab: 'quiz',    label: '⊡ QUIZ'    },
              ].map(({ tab, label }) => (
                <button key={tab} onClick={() => setAiTab(tab)} style={{
                  flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
                  borderBottom: aiTab === tab ? `2px solid ${T.pu}` : '2px solid transparent',
                  color: aiTab === tab ? T.pu : T.tx2,
                  fontSize: 9, fontWeight: 700, fontFamily: MONO,
                  letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>

              {/* ─── SUGGEST ─── */}
              {aiTab === 'suggest' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 11, color: T.tx1, lineHeight: 1.75, margin: 0 }}>
                    Get a personalised recommendation based on your current progress.
                  </p>

                  <Btn
                    onClick={runSuggest}
                    disabled={suggestLoading}
                    color={T.pu} bg={T.puD} border={T.puL}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {suggestLoading ? '✦ THINKING...' : '✦ WHAT SHOULD I LEARN NEXT?'}
                  </Btn>

                  {(suggestLoading || suggestion) && (
                    <AiBox loading={suggestLoading}>
                      {suggestion && (
                        <>
                          <p style={{ fontSize: 9, color: T.pu, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>✦ AI RECOMMENDATION</p>
                          <p style={{ fontSize: 12, color: '#a090cc', lineHeight: 1.85, margin: 0 }}>{suggestion}</p>
                          <button onClick={runSuggest} style={{
                            marginTop: 12, background: 'none', border: `1px solid ${T.line2}`,
                            color: T.tx2, borderRadius: 4, padding: '4px 10px',
                            fontSize: 9, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.08em',
                          }}>↺ REGENERATE</button>
                        </>
                      )}
                    </AiBox>
                  )}

                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'MASTERED',  val: mastered.length,                       color: T.gr },
                      { label: 'UNLOCKED',  val: unlocked.length,                       color: T.bl },
                      { label: 'REMAINING', val: learningPath.length - mastered.length, color: T.tx1 },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{
                        background: T.bg0, border: `1px solid ${T.line2}`,
                        borderRadius: 7, padding: '11px 8px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 4 }}>{val}</div>
                        <div style={{ fontSize: 8, color: T.tx2, letterSpacing: '0.09em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── EXPLAIN ─── */}
              {aiTab === 'explain' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!conceptDetail
                    ? <EmptyHint icon="◎" text="Click a concept node on the graph, then return here for an AI explanation." />
                    : isLocked
                    ? <LockedBanner />
                    : (
                      <>
                        <ConceptBadge name={conceptDetail.name} />

                        <Btn
                          onClick={runExplain}
                          disabled={explainLoading}
                          color={T.pu} bg={T.puD} border={T.puL}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {explainLoading ? '◎ GENERATING...' : explanation ? '↺ RE-EXPLAIN' : '◎ EXPLAIN THIS CONCEPT'}
                        </Btn>

                        {(explainLoading || explanation) && (
                          <AiBox loading={explainLoading} loadingText="◎ GENERATING EXPLANATION...">
                            {explanation && (
                              <>
                                <p style={{ fontSize: 9, color: T.pu, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>◎ EXPLANATION</p>
                                <p style={{ fontSize: 12, color: '#a090cc', lineHeight: 1.85, margin: 0 }}>{explanation}</p>
                              </>
                            )}
                          </AiBox>
                        )}

                        {explanation && (
                          <>
                            <div style={{ height: 1, background: T.line1 }} />
                            <p style={{ fontSize: 9, color: T.tx2, letterSpacing: '0.1em', fontWeight: 700, margin: 0 }}>FOLLOW-UP QUESTIONS</p>
                            <ChatThread
                              history={chatHistory}
                              loading={chatLoading}
                              input={chatInput}
                              onInput={setChatInput}
                              onSend={runChat}
                            />
                          </>
                        )}
                      </>
                    )
                  }
                </div>
              )}

              {/* ─── QUIZ ─── */}
              {aiTab === 'quiz' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!conceptDetail
                    ? <EmptyHint icon="⊡" text="Click a concept node on the graph, then test your knowledge here." />
                    : isLocked
                    ? <LockedBanner />
                    : (
                      <>
                        <ConceptBadge name={conceptDetail.name} />

                        {!quizData && !quizLoading && (
                          <Btn
                            onClick={() => runQuiz(true)}
                            color={T.pu} bg={T.puD} border={T.puL}
                            style={{ width: '100%', justifyContent: 'center' }}
                          >⊡ START QUIZ</Btn>
                        )}

                        {quizLoading && (
                          <AiBox loading loadingText="⊡ GENERATING QUESTION..." />
                        )}

                        {quizData && !quizLoading && (
                          <>
                            {/* Question */}
                            <div style={{
                              background: T.bg0, border: `1px solid ${T.line2}`,
                              borderRadius: 7, padding: '12px 14px',
                            }}>
                              <p style={{ fontSize: 9, color: T.tx2, letterSpacing: '0.09em', marginBottom: 7 }}>
                                QUESTION {prevQuestions.length + 1}
                              </p>
                              <p style={{ fontSize: 12, color: T.tx0, lineHeight: 1.7, fontWeight: 500, margin: 0 }}>
                                {quizData.question}
                              </p>
                            </div>

                            {/* Options */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                              {Object.entries(quizData.options).map(([letter, text]) => {
                                const isSel  = quizAnswer === letter
                                const isCorr = quizData.answer === letter
                                const rev    = quizAnswer !== null
                                let bg = T.bg0, bd = T.line2, col = T.tx1
                                if (rev && isCorr)      { bg = T.grD; bd = T.gr; col = T.gr }
                                else if (rev && isSel)  { bg = T.rdD; bd = T.rd; col = T.rd }
                                else if (!rev && isSel) { bg = T.blD; bd = T.bl; col = T.bl }
                                return (
                                  <div
                                    key={letter}
                                    onClick={() => !quizAnswer && setQuizAnswer(letter)}
                                    style={{
                                      display: 'flex', alignItems: 'flex-start', gap: 11,
                                      padding: '10px 13px', borderRadius: 6,
                                      border: `1px solid ${bd}`, background: bg, color: col,
                                      cursor: quizAnswer ? 'default' : 'pointer',
                                      fontSize: 11, lineHeight: 1.55, transition: 'all 0.15s',
                                    }}
                                  >
                                    <span style={{ fontWeight: 800, flexShrink: 0 }}>{letter}</span>
                                    <span style={{ flex: 1 }}>{text}</span>
                                    {rev && isCorr && <span style={{ flexShrink: 0 }}>✓</span>}
                                    {rev && isSel && !isCorr && <span style={{ flexShrink: 0 }}>✗</span>}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Post-answer */}
                            {quizAnswer && (
                              <>
                                <div style={{
                                  background: T.bg0, border: `1px solid ${T.line2}`,
                                  borderRadius: 7, padding: '10px 13px',
                                }}>
                                  <p style={{ fontSize: 9, color: T.tx2, letterSpacing: '0.09em', marginBottom: 6 }}>EXPLANATION</p>
                                  <p style={{ fontSize: 11, color: T.tx1, lineHeight: 1.75, margin: 0 }}>{quizData.explanation}</p>
                                </div>
                                <Btn
                                  onClick={() => runQuiz(false)}
                                  disabled={quizLoading}
                                  color={T.pu} bg={T.puD} border={T.puL}
                                  style={{ width: '100%', justifyContent: 'center' }}
                                >
                                  {quizLoading ? 'GENERATING...' : '↺ NEXT QUESTION'}
                                </Btn>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )
                  }
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  )
}