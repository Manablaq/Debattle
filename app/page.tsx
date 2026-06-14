'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { readContract } from '@/lib/genlayer'
import { CONTRACT_ADDRESS, STARTING_POINTS, MIN_STAKE, MAX_STAKE, APPEAL_COST } from '@/lib/config'

interface Player {
  address: string; username: string; points: string
  wins: string; losses: string; draws: string
  win_streak: string; best_streak: string; total_debates: string
  points_earned: string; points_lost: string; registered: string
}
interface Debate {
  debate_id: string; creator: string; opponent: string
  topic: string; stake: string; status: string
  creator_argument: string; opponent_argument: string
  creator_score: string; opponent_score: string
  winner: string; reasoning: string
  creator_score_breakdown: string; opponent_score_breakdown: string
  appeal_grounds: string; appeal_verdict: string; appeal_reasoning: string
  claimed: string; created_at: string; category: string
}
type Tab = 'arena' | 'battles' | 'hall' | 'profile'
const CATEGORIES = ['General', 'Technology', 'Politics', 'Philosophy', 'Science', 'Sports', 'Entertainment', 'Economics']

const C = {
  bg: '#03020A',
  surface: '#0A0818',
  card: '#0D0B1A',
  cardHover: '#110E22',
  border: '#1C1832',
  borderGlow: '#3D2F8A',
  cyan: '#00D4FF',
  violet: '#7C3AED',
  pink: '#EC4899',
  green: '#10B981',
  red: '#EF4444',
  gold: '#F59E0B',
  orange: '#F97316',
  text: '#F0EEFF',
  muted: '#6B6494',
  dim: '#2D2850',
}

const STATUS: Record<string, { label: string; color: string; glow: string; icon: string }> = {
  OPEN:      { label: 'Open Challenge', color: C.green,  glow: C.green,  icon: '◉' },
  ACTIVE:    { label: 'Battle Active',  color: C.cyan,   glow: C.cyan,   icon: '⚡' },
  JUDGING:   { label: 'AI Judging',     color: C.gold,   glow: C.gold,   icon: '◈' },
  FINISHED:  { label: 'Verdict In',     color: C.violet, glow: C.violet, icon: '◆' },
  CLAIMED:   { label: 'Complete',       color: C.muted,  glow: C.muted,  icon: '✓' },
  FINAL:     { label: 'Final',          color: C.muted,  glow: C.muted,  icon: '✓' },
  CANCELLED: { label: 'Cancelled',      color: C.red,    glow: C.red,    icon: '✕' },
}

function addr(a: string) {
  if (!a || a === '0x0000000000000000000000000000000000000000') return '—'
  return `${a.slice(0,6)}…${a.slice(-4)}`
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.4)', border: `1px solid ${C.border}`,
  borderRadius: '10px', padding: '12px 16px', color: C.text, fontSize: '14px',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.2s',
}

// ── Animated orb background ───────────────────────────────────────────────────
function OrbBG() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: `radial-gradient(circle, ${C.violet}18 0%, transparent 70%)`, top: '-200px', left: '-100px', animation: 'orbFloat1 12s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${C.cyan}12 0%, transparent 70%)`, top: '30%', right: '-150px', animation: 'orbFloat2 15s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: `radial-gradient(circle, ${C.pink}0D 0%, transparent 70%)`, bottom: '10%', left: '30%', animation: 'orbFloat3 10s ease-in-out infinite' }} />
      <style>{`
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.05)} 66%{transform:translate(-30px,60px) scale(0.95)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-80px,40px) scale(1.08)} }
        @keyframes orbFloat3 { 0%,100%{transform:translate(0,0)} 40%{transform:translate(50px,-60px)} 80%{transform:translate(-40px,30px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px currentColor} 50%{box-shadow:0 0 40px currentColor, 0 0 80px currentColor} }
        @keyframes rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes scoreCount { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}

// ── Glowing border card ───────────────────────────────────────────────────────
function GlowCard({ children, color = C.violet, style, onClick }: {
  children: React.ReactNode; color?: string; style?: React.CSSProperties; onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', borderRadius: '16px', cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.2s', transform: hovered && onClick ? 'translateY(-2px)' : 'none', ...style }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '16px', padding: '1px', background: hovered ? `linear-gradient(135deg, ${color}88, ${color}22, ${color}66)` : `linear-gradient(135deg, ${color}44, transparent, ${color}22)`, transition: 'all 0.3s', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }} />
      <div style={{ position: 'relative', backgroundColor: C.card, borderRadius: '16px', overflow: 'hidden', boxShadow: hovered ? `0 0 40px ${color}22, inset 0 0 40px ${color}08` : `0 0 0px transparent` }}>
        {children}
      </div>
    </div>
  )
}

// ── Live dot indicator ────────────────────────────────────────────────────────
function LiveDot({ color = C.green }: { color?: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: color, opacity: 0.75, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <span style={{ borderRadius: '50%', backgroundColor: color, width: '8px', height: '8px', display: 'inline-block' }} />
    </span>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const pct = score / 100
  const color = score >= 70 ? C.green : score >= 50 ? C.gold : C.red
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${circ * pct} ${circ * (1-pct)}`}
          strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{score}</span>
        <span style={{ fontSize: size * 0.12, color: C.muted, lineHeight: 1 }}>/ 100</span>
      </div>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value, color = C.cyan }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: `${color}0A`, border: `1px solid ${color}22`, borderRadius: '12px', padding: '12px 16px' }}>
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '18px', fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      </div>
    </div>
  )
}

// ── Tag ───────────────────────────────────────────────────────────────────────
function Tag({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: '10px', fontWeight: 600, color, backgroundColor: `${color}15`, border: `1px solid ${color}33`, borderRadius: '6px', padding: '2px 8px', letterSpacing: '0.02em' }}>{children}</span>
}

export default function Home() {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('arena')
  const [debates, setDebates] = useState<Debate[]>([])
  const [player, setPlayer] = useState<Player | null>(null)
  const [leaderboard, setLeaderboard] = useState<Player[]>([])
  const [stats, setStats] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [activeDebate, setActiveDebate] = useState<Debate | null>(null)
  const [catFilter, setCatFilter] = useState('ALL')

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const dr = await readContract('get_all_debates')
      try { setDebates(JSON.parse(dr as string)) } catch {}
      await delay(700)
      const sr = await readContract('get_platform_stats')
      try { setStats(JSON.parse(sr as string)) } catch {}
      await delay(700)
      const lr = await readContract('get_leaderboard')
      try { setLeaderboard(JSON.parse(lr as string)) } catch {}
    } catch {}
    finally { setRefreshing(false) }
  }, [])

  const fetchPlayer = useCallback(async (a: string) => {
    try { setPlayer(JSON.parse(await readContract('get_player', [a]) as string)) } catch {}
  }, [])

  const fetchDetail = useCallback(async (id: string, viewer: string): Promise<Debate | null> => {
    try { return JSON.parse(await readContract('get_debate_for_participant', [id, viewer]) as string) } catch { return null }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { if (address) fetchPlayer(address) }, [address, fetchPlayer])

  const showMsg = (text: string, error = false) => {
    setMsg({ text, error })
    if (!error) setTimeout(() => setMsg(null), 12000)
  }

  async function callWrite(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet to continue.', true); return false }
    if (!player || player.registered !== 'true') { setShowRegister(true); return false }
    setLoading(true)
    showMsg(method === 'submit_argument' ? '⚡ Argument transmitted. 5 AI validators are deliberating — 1–3 minutes. Stay connected.' : `⚡ Processing ${method}…`)
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const r = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (r.success) { showMsg(`✓ ${method} confirmed on-chain.`); await fetchAll(); if (address) await fetchPlayer(address); return true }
      showMsg(`Transaction failed: ${r.error}`, true); return false
    } catch (e: any) { setLoading(false); showMsg(e?.message ?? String(e), true); return false }
  }

  async function callWriteNoCheck(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet first.', true); return false }
    setLoading(true); showMsg('⚡ Processing…')
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const r = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (r.success) { showMsg('✓ Done!'); await fetchAll(); if (address) await fetchPlayer(address); return true }
      showMsg(`Failed: ${r.error}`, true); return false
    } catch (e: any) { setLoading(false); showMsg(e?.message ?? String(e), true); return false }
  }

  const openDebates = debates.filter(d => d.status === 'OPEN' && (catFilter === 'ALL' || d.category === catFilter))
  const myDebates = debates.filter(d => d.creator === address || d.opponent === address)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, color: C.text, fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
      <OrbBG />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: `${C.bg}CC`, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', height: '62px', display: 'flex', alignItems: 'center', gap: '8px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginRight: '10px' }}>
            <div style={{ position: 'relative', width: '38px', height: '38px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, filter: 'blur(8px)', opacity: 0.7 }} />
              <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '10px', background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⚔️</div>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '17px', letterSpacing: '-0.03em', lineHeight: 1, background: `linear-gradient(135deg, #fff, ${C.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DeBattle</div>
              <div style={{ fontSize: '8px', color: C.muted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>On-Chain Arena</div>
            </div>
          </div>

          {/* Tabs */}
          <nav style={{ display: 'flex', gap: '2px', flex: 1, overflowX: 'auto' }}>
            {([['arena','🏟 Arena'],['battles','⚔️ My Battles'],['hall','🏆 Legends'],['profile','🛡 Profile']] as [Tab,string][]).map(([t,label]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: tab===t ? 700 : 400, background: tab===t ? `linear-gradient(135deg, ${C.violet}33, ${C.cyan}11)` : 'transparent', color: tab===t ? C.text : C.muted, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit', borderBottom: tab===t ? `2px solid ${C.cyan}` : '2px solid transparent', transition: 'all 0.2s' }}>
                {label}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {player?.registered === 'true' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `linear-gradient(135deg, ${C.violet}22, ${C.cyan}11)`, border: `1px solid ${C.cyan}33`, borderRadius: '20px', padding: '6px 14px' }}>
                <span style={{ fontSize: '14px', filter: `drop-shadow(0 0 6px ${C.gold})` }}>⚡</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: C.gold, letterSpacing: '-0.01em' }}>{player.points}</span>
                <span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>pts</span>
              </div>
            )}
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
          </div>
        </div>
      </header>

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {msg && (
        <div onClick={() => setMsg(null)} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: msg.error ? 'rgba(20,4,4,0.96)' : 'rgba(10,8,24,0.96)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${msg.error ? C.red : C.violet}55`, padding: '14px 20px', cursor: 'pointer' }}>
          <pre style={{ fontSize: '12px', fontFamily: 'monospace', color: msg.error ? '#FCA5A5' : C.cyan, whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</pre>
          <p style={{ fontSize: '10px', color: C.muted, marginTop: '4px' }}>Tap to dismiss</p>
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {showCreate && player && <CreateModal player={player} onClose={() => setShowCreate(false)} onSubmit={(t,s,c) => { callWrite('create_debate',[t,s,c]); setShowCreate(false) }} loading={loading} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onSubmit={u => { callWriteNoCheck('register',[u]); setShowRegister(false) }} loading={loading} />}
      {activeDebate && address && <BattleModal debate={activeDebate} address={address} player={player} onClose={() => setActiveDebate(null)} onAction={callWrite} fetchDetail={id => fetchDetail(id, address)} loading={loading} />}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 100px', position: 'relative', zIndex: 1 }}>

        {/* ════ ARENA ════════════════════════════════════════════════════════ */}
        {tab === 'arena' && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>

            {/* HERO */}
            <div style={{ padding: 'clamp(40px,6vw,80px) 0 40px', textAlign: 'center', position: 'relative' }}>
              {/* Live badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: `${C.green}12`, border: `1px solid ${C.green}33`, borderRadius: '20px', padding: '6px 16px', marginBottom: '28px' }}>
                <LiveDot color={C.green} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: C.green, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live on GenLayer Bradbury</span>
              </div>

              <h1 style={{ fontSize: 'clamp(40px,9vw,88px)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.04em', marginBottom: '20px' }}>
                <span style={{ display: 'block', background: `linear-gradient(135deg, ${C.text} 0%, ${C.muted} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Prove Your</span>
                <span style={{ display: 'block', background: `linear-gradient(135deg, ${C.cyan}, ${C.violet}, ${C.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 0 40px ${C.violet}66)` }}>Intellect.</span>
              </h1>

              <p style={{ color: C.muted, fontSize: 'clamp(15px,2.5vw,19px)', maxWidth: '500px', lineHeight: 1.65, margin: '0 auto 36px' }}>
                Stake points. Argue your case. Let <strong style={{ color: C.cyan }}>5 independent GenLayer validators</strong> judge the winner. On-chain. Permanent. Trustless.
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => player?.registered === 'true' ? setShowCreate(true) : setShowRegister(true)}
                  style={{ position: 'relative', background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px 32px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em', overflow: 'hidden' }}>
                  <span style={{ position: 'relative', zIndex: 1 }}>⚡ Create Battle</span>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.15), transparent)', borderRadius: '12px' }} />
                </button>
                {(!player || player.registered !== 'true') && (
                  <button onClick={() => setShowRegister(true)} style={{ background: 'transparent', color: C.cyan, border: `1px solid ${C.cyan}44`, borderRadius: '12px', padding: '14px 32px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Join Free
                  </button>
                )}
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '40px' }}>
                {[
                  { icon: '⚔️', label: 'Battles', value: stats.total_debates ?? '0', color: C.violet },
                  { icon: '🔥', label: 'Open', value: stats.open_debates ?? '0', color: C.cyan },
                  { icon: '🛡', label: 'Warriors', value: stats.total_players ?? '0', color: C.pink },
                  { icon: '✓', label: 'Completed', value: stats.completed_debates ?? '0', color: C.green },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: `${s.color}0A`, border: `1px solid ${s.color}22`, borderRadius: '12px', padding: '10px 18px' }}>
                    <span style={{ fontSize: '18px' }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* HOW IT WORKS */}
            <GlowCard color={C.violet} style={{ marginBottom: '32px' }}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ width: '3px', height: '20px', background: `linear-gradient(180deg, ${C.cyan}, ${C.violet})`, borderRadius: '2px' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: C.cyan, letterSpacing: '0.1em', textTransform: 'uppercase' }}>How It Works</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  {[
                    { step: '01', icon: '📌', title: 'Create', desc: 'Post topic, stake points. AI validates it\'s fair.', color: C.cyan },
                    { step: '02', icon: '🤝', title: 'Challenger Joins', desc: 'Opponent matches your stake to enter.', color: C.violet },
                    { step: '03', icon: '✍️', title: 'Submit Arguments', desc: 'Both argue in secret. No peeking.', color: C.pink },
                    { step: '04', icon: '🤖', title: 'AI Validates', desc: '5 GenLayer nodes reach consensus.', color: C.gold },
                    { step: '05', icon: '🏆', title: 'Claim Victory', desc: 'Winner takes both stakes on-chain.', color: C.green },
                  ].map((s, i) => (
                    <div key={i} style={{ background: `${s.color}07`, border: `1px solid ${s.color}18`, borderRadius: '12px', padding: '14px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '10px', fontWeight: 900, color: `${s.color}44`, letterSpacing: '0.05em' }}>{s.step}</div>
                      <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: C.text, marginBottom: '5px' }}>{s.title}</div>
                      <div style={{ fontSize: '11px', color: C.muted, lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </GlowCard>

            {/* FILTERS + LIST */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
              {['ALL', ...CATEGORIES].map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${catFilter===c ? C.cyan : C.border}`, background: catFilter===c ? `${C.cyan}18` : 'transparent', color: catFilter===c ? C.cyan : C.muted, fontSize: '12px', fontWeight: catFilter===c ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {c}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <button onClick={fetchAll} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {refreshing ? '↻ Loading…' : '↻ Refresh'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LiveDot color={openDebates.length > 0 ? C.green : C.muted} />
                <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>Open Battles</h2>
              </div>
              <span style={{ fontSize: '13px', color: C.muted }}>{openDebates.length} waiting for challengers</span>
            </div>

            {openDebates.length === 0 ? (
              <GlowCard color={C.violet} style={{ textAlign: 'center' }}>
                <div style={{ padding: '64px 20px' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px', filter: `drop-shadow(0 0 30px ${C.violet}88)` }}>⚔️</div>
                  <p style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>The arena awaits</p>
                  <p style={{ color: C.muted, fontSize: '15px', marginBottom: '24px' }}>No open battles — be the first to issue a challenge</p>
                  <button onClick={() => player?.registered === 'true' ? setShowCreate(true) : setShowRegister(true)}
                    style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '13px 28px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ⚡ Create First Battle
                  </button>
                </div>
              </GlowCard>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px,100%), 1fr))', gap: '12px' }}>
                {openDebates.map(d => <BattleCard key={d.debate_id} debate={d} address={address} onJoin={() => callWrite('join_debate',[d.debate_id])} onClick={() => setActiveDebate(d)} loading={loading} />)}
              </div>
            )}
          </div>
        )}

        {/* ════ MY BATTLES ═══════════════════════════════════════════════════ */}
        {tab === 'battles' && (
          <div style={{ paddingTop: '28px', animation: 'fadeUp 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>⚔️ My Battles</h2>
                <p style={{ color: C.muted, fontSize: '13px', marginTop: '3px' }}>{myDebates.length} battles in your record</p>
              </div>
              <button onClick={fetchAll} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>{refreshing ? '↻' : '↻ Refresh'}</button>
            </div>
            {!address ? <EmptyState icon="🔌" title="Connect your wallet" sub="Your battle history lives here" />
              : myDebates.length === 0 ? (
                <EmptyState icon="⚔️" title="No battles yet" sub="Step into the arena and prove your intellect">
                  <button onClick={() => setTab('arena')} style={{ marginTop: '16px', background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Browse Arena</button>
                </EmptyState>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myDebates.map(d => <BattleCard key={d.debate_id} debate={d} address={address} onJoin={() => {}} onClick={() => setActiveDebate(d)} loading={loading} detailed />)}
                </div>
              )}
          </div>
        )}

        {/* ════ HALL OF LEGENDS ══════════════════════════════════════════════ */}
        {tab === 'hall' && (
          <div style={{ paddingTop: '28px', animation: 'fadeUp 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>🏆 Hall of Legends</h2>
                <p style={{ color: C.muted, fontSize: '13px', marginTop: '3px' }}>The greatest minds in the arena</p>
              </div>
              <button onClick={fetchAll} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>{refreshing ? '↻' : '↻ Refresh'}</button>
            </div>
            {leaderboard.length === 0 ? <EmptyState icon="🏆" title="No legends yet" sub="Be the first to claim your place in history" />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {leaderboard.map((p, i) => {
                    const medals = ['🥇','🥈','🥉']
                    const colors = [C.gold, C.muted, '#CD7F32']
                    const isMe = p.address === address
                    return (
                      <GlowCard key={p.address} color={i === 0 ? C.gold : i === 1 ? C.violet : C.border}>
                        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: i < 3 ? `${colors[i]}18` : C.surface, border: `1px solid ${i < 3 ? colors[i]+'44' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i < 3 ? '22px' : '13px', fontWeight: 700, color: i < 3 ? colors[i] : C.muted, flexShrink: 0 }}>
                            {i < 3 ? medals[i] : `#${i+1}`}
                          </div>
                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.violet}44, ${C.cyan}22)`, border: `2px solid ${C.violet}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 900, color: C.cyan, flexShrink: 0 }}>
                            {p.username ? p.username[0].toUpperCase() : '?'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '15px', color: i === 0 ? C.gold : C.text }}>{p.username || addr(p.address)}</span>
                              {isMe && <Tag color={C.cyan}>YOU</Tag>}
                              {parseInt(p.win_streak) >= 3 && <Tag color={C.orange}>🔥 {p.win_streak}</Tag>}
                            </div>
                            <p style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace', marginTop: '2px' }}>{addr(p.address)}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                            {[{v:p.wins,l:'Wins',c:C.green},{v:p.losses,l:'Loss',c:C.red},{v:p.points,l:'Pts',c:C.gold},{v:p.best_streak,l:'Best',c:C.orange}].map(s => (
                              <div key={s.l} style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 800, color: s.c, fontSize: '17px', lineHeight: 1 }}>{s.v}</div>
                                <div style={{ fontSize: '9px', color: C.muted, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </GlowCard>
                    )
                  })}
                </div>
              )}
          </div>
        )}

        {/* ════ PROFILE ══════════════════════════════════════════════════════ */}
        {tab === 'profile' && (
          <div style={{ paddingTop: '28px', animation: 'fadeUp 0.4s ease' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '20px' }}>🛡 Profile</h2>
            {!address ? <EmptyState icon="🔌" title="Connect your wallet" sub="Your stats and record live here" />
              : !player || player.registered !== 'true' ? (
                <GlowCard color={C.violet} style={{ textAlign: 'center' }}>
                  <div style={{ padding: '56px 24px' }}>
                    <div style={{ fontSize: '64px', marginBottom: '16px', filter: `drop-shadow(0 0 30px ${C.violet}88)` }}>⚔️</div>
                    <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '10px', background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>You haven&apos;t entered yet</h3>
                    <p style={{ color: C.muted, fontSize: '15px', marginBottom: '28px' }}>Register to receive <strong style={{ color: C.gold }}>{STARTING_POINTS} free points</strong> and start battling</p>
                    <button onClick={() => setShowRegister(true)} style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px 32px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Join Free — {STARTING_POINTS} Points
                    </button>
                  </div>
                </GlowCard>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Profile hero */}
                  <GlowCard color={C.cyan}>
                    <div style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${C.violet}22 0%, transparent 70%)` }} />
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', position: 'relative' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: '-3px', borderRadius: '50%', background: `conic-gradient(${C.cyan}, ${C.violet}, ${C.pink}, ${C.cyan})`, animation: 'rotate 4s linear infinite' }} />
                          <div style={{ position: 'relative', width: '76px', height: '76px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.violet}44, ${C.cyan}22)`, border: `3px solid ${C.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900, color: C.cyan }}>
                            {player.username ? player.username[0].toUpperCase() : '?'}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '4px' }}>{player.username || 'Anonymous'}</h3>
                          <p style={{ color: C.muted, fontFamily: 'monospace', fontSize: '11px', marginBottom: '12px' }}>{address}</p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <Tag color={C.cyan}>⚡ {player.points} pts</Tag>
                            {parseInt(player.win_streak) >= 2 && <Tag color={C.orange}>🔥 {player.win_streak} streak</Tag>}
                            {parseInt(player.wins) >= 5 && <Tag color={C.gold}>⭐ Veteran</Tag>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlowCard>

                  {/* WLD row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[{v:player.wins,l:'Victories',c:C.green,i:'✅'},{v:player.losses,l:'Defeats',c:C.red,i:'❌'},{v:player.draws,l:'Draws',c:C.muted,i:'🤝'}].map(s => (
                      <GlowCard key={s.l} color={s.c} style={{ textAlign: 'center' }}>
                        <div style={{ padding: '20px 12px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.i}</div>
                          <div style={{ fontSize: '30px', fontWeight: 900, color: s.c, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.v}</div>
                          <div style={{ fontSize: '10px', color: C.muted, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.l}</div>
                        </div>
                      </GlowCard>
                    ))}
                  </div>

                  {/* More stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    {[{v:player.total_debates,l:'Battles',c:C.violet,i:'⚔️'},{v:player.best_streak,l:'Best Streak',c:C.orange,i:'🔥'},{v:player.points_earned,l:'Pts Earned',c:C.green,i:'📈'},{v:player.points_lost,l:'Pts Lost',c:C.red,i:'📉'}].map(s => (
                      <GlowCard key={s.l} color={s.c}>
                        <div style={{ padding: '16px', textAlign: 'center' }}>
                          <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.i}</div>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: s.c, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.v}</div>
                          <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
                        </div>
                      </GlowCard>
                    ))}
                  </div>

                  {/* Win rate */}
                  {parseInt(player.total_debates) > 0 && (
                    <GlowCard color={C.violet}>
                      <div style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>Win Rate</span>
                          <span style={{ fontSize: '14px', color: C.cyan, fontWeight: 800 }}>
                            {Math.round((parseInt(player.wins) / parseInt(player.total_debates)) * 100)}%
                          </span>
                        </div>
                        <div style={{ background: C.surface, borderRadius: '6px', height: '8px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
                          <div style={{ width: `${Math.round((parseInt(player.wins)/parseInt(player.total_debates))*100)}%`, height: '100%', background: `linear-gradient(90deg, ${C.violet}, ${C.cyan})`, borderRadius: '6px', boxShadow: `0 0 12px ${C.cyan}66`, transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    </GlowCard>
                  )}

                  {/* Contract */}
                  <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', fontFamily: 'monospace', fontSize: '11px', color: C.muted, lineHeight: 2 }}>
                    <div>Contract: <span style={{ color: C.text }}>{CONTRACT_ADDRESS}</span></div>
                    <div>Network: <span style={{ color: C.text }}>GenLayer Bradbury · Chain 4221</span></div>
                    <div><a href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener" style={{ color: C.cyan }}>View on Explorer ↗</a></div>
                  </div>
                </div>
              )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub, children }: { icon: string; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <GlowCard color={C.violet} style={{ textAlign: 'center' }}>
      <div style={{ padding: '64px 20px' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px', filter: `drop-shadow(0 0 20px ${C.violet}88)` }}>{icon}</div>
        <p style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</p>
        <p style={{ color: C.muted, fontSize: '14px' }}>{sub}</p>
        {children}
      </div>
    </GlowCard>
  )
}

// ─── Battle Card ──────────────────────────────────────────────────────────────
function BattleCard({ debate, address, onJoin, onClick, loading, detailed = false }: {
  debate: Debate; address?: string; onJoin: () => void; onClick: () => void; loading: boolean; detailed?: boolean
}) {
  const isCreator = debate.creator === address
  const isOpponent = debate.opponent === address
  const isWinner = debate.winner === address
  const isDraw = debate.winner === 'DRAW'
  const cfg = STATUS[debate.status] ?? { label: debate.status, color: C.muted, glow: C.muted, icon: '•' }

  return (
    <GlowCard color={isWinner ? C.gold : debate.status === 'ACTIVE' ? C.cyan : cfg.color} onClick={onClick}>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag color={C.muted}>{debate.category}</Tag>
              <Tag color={C.gold}>⚡ {debate.stake} pts each</Tag>
            </div>
            <p style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.3, color: C.text, letterSpacing: '-0.01em' }}>{debate.topic}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, background: `${cfg.color}12`, border: `1px solid ${cfg.color}33`, borderRadius: '20px', padding: '4px 10px' }}>
            <LiveDot color={debate.status === 'OPEN' || debate.status === 'ACTIVE' ? cfg.color : C.muted} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
          </div>
        </div>

        {/* Players */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px' }}>
            <span style={{ fontSize: '11px', color: C.muted }}>Creator</span>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isCreator ? C.cyan : C.text }}>{addr(debate.creator)}{isCreator ? ' (you)' : ''}</span>
          </div>
          {debate.opponent !== '0x0000000000000000000000000000000000000000' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px' }}>
              <span style={{ fontSize: '11px', color: C.muted }}>vs</span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isOpponent ? C.cyan : C.text }}>{addr(debate.opponent)}{isOpponent ? ' (you)' : ''}</span>
            </div>
          )}
        </div>

        {/* Verdict snippet */}
        {['FINISHED','CLAIMED','FINAL'].includes(debate.status) && debate.reasoning && (
          <div style={{ background: C.surface, border: `1px solid ${isWinner ? C.gold+'33' : C.border}`, borderRadius: '8px', padding: '10px 12px', borderLeft: `3px solid ${isWinner ? C.gold : isDraw ? C.muted : (isCreator||isOpponent) ? C.red : C.violet}` }}>
            <p style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: isWinner ? C.gold : isDraw ? C.muted : (isCreator||isOpponent) ? C.red : C.cyan }}>
              {isDraw ? '⚔️ Draw' : isWinner ? '🏆 Victory! ' + (debate.claimed !== 'true' ? '— Claim points →' : '✓ Claimed') : (isCreator||isOpponent) ? '❌ Defeat' : `Winner: ${addr(debate.winner)}`}
            </p>
            <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.5 }}>{debate.reasoning.slice(0,120)}{debate.reasoning.length>120?'…':''}</p>
          </div>
        )}

        {/* CTA */}
        {debate.status === 'OPEN' && !isCreator && address && (
          <button disabled={loading} onClick={e => { e.stopPropagation(); onJoin() }}
            style={{ width: '100%', background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit' }}>
            ⚡ Accept Challenge — Stake {debate.stake} pts
          </button>
        )}
        {debate.status !== 'OPEN' && <p style={{ fontSize: '11px', color: C.muted, textAlign: 'center' }}>Tap to open →</p>}
      </div>
    </GlowCard>
  )
}

// ─── Battle Modal ─────────────────────────────────────────────────────────────
function BattleModal({ debate: init, address, player, onClose, onAction, fetchDetail, loading }: {
  debate: Debate; address: string; player: Player | null
  onClose: () => void; onAction: (m: string, a: unknown[]) => Promise<boolean>
  fetchDetail: (id: string) => Promise<Debate | null>; loading: boolean
}) {
  const [debate, setDebate] = useState(init)
  const [arg, setArg] = useState('')
  const [showAppeal, setShowAppeal] = useState(false)
  const [appealText, setAppealText] = useState('')

  useEffect(() => {
    fetchDetail(init.debate_id).then(d => { if (d) setDebate(d) })
  }, [init.debate_id])

  const isCreator = debate.creator === address
  const isOpponent = debate.opponent === address
  const isParty = isCreator || isOpponent
  const isWinner = debate.winner === address
  const isDraw = debate.winner === 'DRAW'
  const hasMyArg = isCreator ? !!debate.creator_argument : !!debate.opponent_argument
  const cfg = STATUS[debate.status] ?? { label: debate.status, color: C.muted, glow: C.muted, icon: '•' }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,2,10,0.92)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(16px)', padding: '16px' }} onClick={onClose}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <GlowCard color={isWinner ? C.gold : cfg.color} style={{ width: '100%' }}>
          <div style={{ padding: '24px 22px 28px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ flex: 1, paddingRight: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: `${cfg.color}12`, border: `1px solid ${cfg.color}33`, borderRadius: '20px', padding: '4px 10px' }}>
                    <LiveDot color={['OPEN','ACTIVE'].includes(debate.status) ? cfg.color : C.muted} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <Tag color={C.muted}>{debate.category}</Tag>
                  <Tag color={C.gold}>⚡ {debate.stake} pts · Winner gets {parseInt(debate.stake)*2}</Tag>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1.3, letterSpacing: '-0.02em' }}>{debate.topic}</h2>
              </div>
              <button onClick={onClose} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: '16px', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}>✕</button>
            </div>

            {/* VS cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
              {[
                { label: 'Creator', addr: debate.creator, arg: debate.creator_argument, score: debate.creator_score, breakdown: debate.creator_score_breakdown, isMe: isCreator },
                { label: 'Opponent', addr: debate.opponent, arg: debate.opponent_argument, score: debate.opponent_score, breakdown: debate.opponent_score_breakdown, isMe: isOpponent },
              ].map((p, i) => (
                <React.Fragment key={i}>
                  {i === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ fontSize: '22px', filter: `drop-shadow(0 0 8px ${C.violet})` }}>⚔️</div>
                      <div style={{ fontSize: '10px', color: C.muted, fontWeight: 700 }}>VS</div>
                    </div>
                  )}
                  <div style={{ backgroundColor: C.surface, border: `1px solid ${debate.winner===p.addr&&!isDraw ? C.gold+'55' : C.border}`, borderRadius: '12px', padding: '14px', textAlign: 'center', boxShadow: debate.winner===p.addr&&!isDraw ? `0 0 24px ${C.gold}22` : 'none' }}>
                    <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: 700 }}>{p.label}</div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: p.isMe ? C.cyan : C.text, marginBottom: '10px' }}>{addr(p.addr)}{p.isMe ? ' (you)' : ''}</div>
                    {p.score ? (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                        <ScoreRing score={parseInt(p.score)} size={72} />
                      </div>
                    ) : (
                      debate.status === 'ACTIVE' && p.addr !== '0x0000000000000000000000000000000000000000' && (
                        <div style={{ fontSize: '11px', color: C.gold, marginBottom: '8px' }}>⏳ Awaiting…</div>
                      )
                    )}
                    {debate.winner === p.addr && !isDraw && <Tag color={C.gold}>🏆 Winner</Tag>}
                    {isDraw && p.addr !== '0x0000000000000000000000000000000000000000' && <Tag color={C.muted}>Draw</Tag>}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* AI Verdict */}
            {debate.reasoning && (
              <div style={{ background: `${C.violet}0A`, border: `1px solid ${C.violet}33`, borderRadius: '12px', padding: '16px', marginBottom: '16px', borderLeft: `3px solid ${C.violet}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '16px' }}>🤖</span>
                  <span style={{ fontSize: '11px', color: C.cyan, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>GenLayer AI Validator Verdict</span>
                </div>
                <p style={{ fontSize: '14px', color: C.text, lineHeight: 1.7 }}>{debate.reasoning}</p>
                {debate.creator_score_breakdown && isParty && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: '11px', color: C.muted, fontWeight: 600, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score Breakdown</p>
                    <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.6 }}>Creator: {debate.creator_score_breakdown}</p>
                    <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.6, marginTop: '4px' }}>Opponent: {debate.opponent_score_breakdown}</p>
                  </div>
                )}
                {debate.appeal_reasoning && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: '11px', color: C.gold, fontWeight: 700, marginBottom: '4px' }}>Appeal: {debate.appeal_verdict}</p>
                    <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.6 }}>{debate.appeal_reasoning}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {debate.status === 'OPEN' && !isCreator && (
                <button disabled={loading} onClick={() => { onAction('join_debate',[debate.debate_id]); onClose() }}
                  style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 800, cursor: loading?'not-allowed':'pointer', opacity: loading?0.5:1, fontFamily: 'inherit' }}>
                  ⚡ Accept Challenge — Stake {debate.stake} pts
                </button>
              )}

              {debate.status === 'ACTIVE' && isParty && !hasMyArg && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: `${C.cyan}0A`, border: `1px solid ${C.cyan}22`, borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: C.cyan, lineHeight: 1.6 }}>
                    ⚡ Both arguments go to 5 AI validators simultaneously. Judging takes 1–3 minutes after both submit.
                  </div>
                  <textarea value={arg} onChange={e => setArg(e.target.value)} placeholder="Build your argument. Validators score: Logic (35pts) · Evidence (25pts) · Persuasion (25pts) · Clarity (15pts)" style={{ ...inp, minHeight: '140px', resize: 'vertical', borderColor: arg.length>0?C.violet+'55':C.border }} />
                  <button disabled={loading||arg.trim().length<20} onClick={() => { onAction('submit_argument',[debate.debate_id,arg]); onClose() }}
                    style={{ background: arg.trim().length>=20 ? `linear-gradient(135deg, ${C.violet}, ${C.cyan})` : C.surface, color: arg.trim().length>=20?'#fff':C.muted, border: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: 800, cursor: arg.trim().length>=20?'pointer':'not-allowed', fontFamily: 'inherit' }}>
                    ⚡ Submit to Validators
                  </button>
                  <p style={{ fontSize: '11px', color: C.muted, textAlign: 'center' }}>{arg.length} chars · min 20</p>
                </div>
              )}

              {debate.status === 'ACTIVE' && isParty && hasMyArg && (
                <div style={{ background: `${C.green}0A`, border: `1px solid ${C.green}33`, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: C.green, fontWeight: 700 }}>✓ Argument submitted — waiting for opponent</p>
                </div>
              )}

              {(debate.status === 'FINISHED' || debate.status === 'FINAL') && isWinner && !isDraw && debate.claimed !== 'true' && (
                <button disabled={loading} onClick={() => { onAction('claim_winnings',[debate.debate_id]); onClose() }}
                  style={{ background: `linear-gradient(135deg, ${C.gold}, #D97706)`, color: '#000', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 900, cursor: loading?'not-allowed':'pointer', opacity: loading?0.5:1, fontFamily: 'inherit', boxShadow: `0 0 30px ${C.gold}44` }}>
                  🏆 Claim {parseInt(debate.stake)*2} Points
                </button>
              )}

              {debate.status === 'OPEN' && isCreator && (
                <button disabled={loading} onClick={() => { onAction('cancel_debate',[debate.debate_id]); onClose() }}
                  style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '11px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel (refunds stake)
                </button>
              )}

              {debate.status === 'FINISHED' && isParty && !isWinner && !isDraw && !debate.appeal_grounds && (
                !showAppeal ? (
                  <button onClick={() => setShowAppeal(true)} style={{ background: 'transparent', color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: '12px', padding: '11px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Appeal Verdict (costs {APPEAL_COST} pts)
                  </button>
                ) : (
                  <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}33`, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '12px', color: C.gold, fontWeight: 600 }}>Strict standard — only clear judging errors are overturned:</p>
                    <textarea value={appealText} onChange={e => setAppealText(e.target.value)} placeholder="What specific error did the validators make?" style={{ ...inp, minHeight: '80px', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button disabled={loading||!appealText.trim()} onClick={() => { onAction('appeal_verdict',[debate.debate_id,appealText]); setShowAppeal(false); onClose() }}
                        style={{ flex: 1, background: `linear-gradient(135deg, ${C.gold}, #D97706)`, color: '#000', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', opacity: appealText.trim()?1:0.5, fontFamily: 'inherit' }}>
                        Submit Appeal
                      </button>
                      <button onClick={() => setShowAppeal(false)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({ player, onClose, onSubmit, loading }: {
  player: Player; onClose: () => void; onSubmit: (t: string, s: string, c: string) => void; loading: boolean
}) {
  const [topic, setTopic] = useState('')
  const [stake, setStake] = useState('10')
  const [cat, setCat] = useState('General')
  const max = Math.min(MAX_STAKE, parseInt(player.points))
  const ok = topic.trim().length >= 10 && parseInt(stake) >= MIN_STAKE && parseInt(stake) <= max

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,2,10,0.92)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(16px)' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <GlowCard color={C.cyan}>
          <div style={{ padding: '24px 22px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>⚡ Create Battle</h2>
                <p style={{ fontSize: '12px', color: C.muted, marginTop: '3px' }}>Issue a challenge to the arena</p>
              </div>
              <button onClick={onClose} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: '16px', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ background: `${C.cyan}08`, border: `1px solid ${C.cyan}22`, borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: C.cyan, marginBottom: '20px', lineHeight: 1.6 }}>
              🤖 AI validators verify your topic is fair and debatable before it goes live.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: C.muted, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Battle Topic *</label>
                <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. AI will create more jobs than it destroys" style={{ ...inp, borderColor: topic.length>=10?C.cyan+'44':C.border }} />
                <p style={{ fontSize: '11px', color: C.muted, marginTop: '5px' }}>{topic.length} chars · minimum 10</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: C.muted, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stake <span style={{ color: C.gold }}>· {player.points} available</span></label>
                  <input type="number" min={MIN_STAKE} max={max} value={stake} onChange={e => setStake(e.target.value)} style={{ ...inp, borderColor: ok?C.violet+'44':C.border }} />
                  <p style={{ fontSize: '11px', color: C.muted, marginTop: '5px' }}>Winner gets {parseInt(stake||'0')*2} pts</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: C.muted, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</label>
                  <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button disabled={loading||!ok} onClick={() => onSubmit(topic,stake,cat)}
                style={{ background: ok?`linear-gradient(135deg, ${C.violet}, ${C.cyan})`:C.surface, color: ok?'#fff':C.muted, border: 'none', borderRadius: '12px', padding: '15px', fontSize: '15px', fontWeight: 800, cursor: ok?'pointer':'not-allowed', fontFamily: 'inherit' }}>
                ⚡ Launch Battle
              </button>
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  )
}

// ─── Register Modal ───────────────────────────────────────────────────────────
function RegisterModal({ onClose, onSubmit, loading }: {
  onClose: () => void; onSubmit: (u: string) => void; loading: boolean
}) {
  const [username, setUsername] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(3,2,10,0.94)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(20px)' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <GlowCard color={C.violet} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            {/* Animated icon */}
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 20px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(${C.violet}, ${C.cyan}, ${C.pink}, ${C.violet})`, animation: 'rotate 3s linear infinite' }} />
              <div style={{ position: 'absolute', inset: '3px', borderRadius: '50%', background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>⚔️</div>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '10px', background: `linear-gradient(135deg, ${C.text}, ${C.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Join the Arena
            </h2>
            <p style={{ color: C.muted, fontSize: '15px', lineHeight: 1.65, marginBottom: '28px' }}>
              Register and receive <strong style={{ color: C.gold }}>{STARTING_POINTS} free points</strong> to start your first battle.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: C.muted, marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Username <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. LogicMaster, DebateKing…" maxLength={20} style={inp} />
              </div>
              <button disabled={loading} onClick={() => onSubmit(username)}
                style={{ background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontSize: '15px', fontWeight: 800, cursor: loading?'not-allowed':'pointer', opacity: loading?0.5:1, fontFamily: 'inherit' }}>
                ⚡ Enter Arena — {STARTING_POINTS} Points Free
              </button>
              <p style={{ fontSize: '11px', color: C.muted, textAlign: 'center' }}>Signs a transaction on GenLayer Bradbury</p>
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  )
}
