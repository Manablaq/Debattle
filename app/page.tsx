'use client'
import React, { useState, useEffect, useCallback } from 'react'
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
type Tab = 'arena' | 'my-debates' | 'leaderboard' | 'profile'
const CATEGORIES = ['General', 'Technology', 'Politics', 'Philosophy', 'Science', 'Sports', 'Entertainment', 'Economics']

// Design tokens
const BG = '#04040A'
const SURFACE = '#0D0D18'
const CARD = '#0F0F1E'
const BORDER = '#1E1E3A'
const GLOW = '#6D28D9'
const ACCENT = '#8B5CF6'
const GOLD = '#F59E0B'
const TEXT = '#F1F0FF'
const MUTED = '#6B6A8A'
const SUCCESS = '#10B981'
const DANGER = '#EF4444'
const WARNING = '#F59E0B'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:      { label: 'Open',        color: SUCCESS,  bg: '#10B98118' },
  ACTIVE:    { label: 'Active',      color: '#60A5FA', bg: '#60A5FA18' },
  JUDGING:   { label: 'Judging…',   color: WARNING,  bg: '#F59E0B18' },
  FINISHED:  { label: 'Verdict In', color: ACCENT,   bg: '#8B5CF618' },
  CLAIMED:   { label: 'Complete',   color: MUTED,    bg: '#6B6A8A18' },
  FINAL:     { label: 'Final',      color: MUTED,    bg: '#6B6A8A18' },
  CANCELLED: { label: 'Cancelled',  color: DANGER,   bg: '#EF444418' },
}

function shortAddr(a: string) {
  if (!a || a === '0x0000000000000000000000000000000000000000') return '—'
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

const inp: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`,
  borderRadius: '10px', padding: '11px 14px', color: TEXT, fontSize: '14px',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
}

// ─── Glow divider ────────────────────────────────────────────────────────────
function GlowLine() {
  return <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${GLOW}55, transparent)`, margin: '0' }} />
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>{title}</h2>
        {sub && <p style={{ color: MUTED, fontSize: '13px', marginTop: '3px' }}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color = ACCENT }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px 20px', minWidth: '90px' }}>
      <span style={{ fontSize: '22px', fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '10px', color: MUTED, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
    </div>
  )
}

// ─── Refresh button ───────────────────────────────────────────────────────────
function RefreshBtn({ refreshing, onClick }: { refreshing: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
      {refreshing ? '↻ Loading…' : '↻ Refresh'}
    </button>
  )
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

  const fetchPlayer = useCallback(async (addr: string) => {
    try { const r = await readContract('get_player', [addr]); setPlayer(JSON.parse(r as string)) } catch {}
  }, [])

  const fetchDebateDetail = useCallback(async (id: string, viewer: string): Promise<Debate | null> => {
    try { return JSON.parse(await readContract('get_debate_for_participant', [id, viewer]) as string) } catch { return null }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { if (address) fetchPlayer(address) }, [address, fetchPlayer])

  const showMsg = (text: string, error = false) => {
    setMsg({ text, error })
    if (!error) setTimeout(() => setMsg(null), 12000)
  }

  async function callWrite(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet first.', true); return false }
    if (!player || player.registered !== 'true') { setShowRegister(true); return false }
    setLoading(true)
    showMsg(method === 'submit_argument' ? '⚔️ Argument submitted. AI validators are judging — takes 1–3 min. Keep this tab open.' : `Processing ${method}…`)
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const result = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (result.success) {
        showMsg(`✓ ${method} succeeded!`)
        await fetchAll(); if (address) await fetchPlayer(address)
        return true
      }
      showMsg(`Failed: ${result.error}`, true); return false
    } catch (e: any) { setLoading(false); showMsg(e?.message ?? String(e), true); return false }
  }

  async function callWriteNoCheck(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet first.', true); return false }
    setLoading(true); showMsg(`Processing ${method}…`)
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const result = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (result.success) { showMsg(`✓ Done!`); await fetchAll(); if (address) await fetchPlayer(address); return true }
      showMsg(`Failed: ${result.error}`, true); return false
    } catch (e: any) { setLoading(false); showMsg(e?.message ?? String(e), true); return false }
  }

  const openDebates = debates.filter(d => d.status === 'OPEN' && (catFilter === 'ALL' || d.category === catFilter))
  const myDebates = debates.filter(d => d.creator === address || d.opponent === address)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: `${SURFACE}EE`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', height: '60px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginRight: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', boxShadow: `0 0 14px ${GLOW}55`, flexShrink: 0 }}>⚔️</div>
            <div style={{ display: 'none' }} className="logo-text">
              <div style={{ fontWeight: 900, fontSize: '15px', letterSpacing: '-0.02em', lineHeight: 1 }}>DeBattle</div>
              <div style={{ fontSize: '8px', color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>On-Chain Arena</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: '15px', letterSpacing: '-0.02em' }}>DeBattle</div>
          </div>

          {/* Tabs */}
          <nav style={{ display: 'flex', gap: '2px', flex: 1, overflowX: 'auto' }}>
            {([['arena', '🏟 Arena'], ['my-debates', '⚔️ My Debates'], ['leaderboard', '🏆 Leaderboard'], ['profile', '👤 Profile']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t ? 600 : 400, background: tab === t ? `${GLOW}22` : 'transparent', color: tab === t ? ACCENT : MUTED, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit', borderBottom: tab === t ? `2px solid ${ACCENT}` : '2px solid transparent' }}>
                {label}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {player?.registered === 'true' && (
              <div style={{ background: `linear-gradient(135deg, ${GLOW}33, ${ACCENT}22)`, border: `1px solid ${ACCENT}44`, borderRadius: '20px', padding: '5px 12px', fontSize: '13px', fontWeight: 700, color: GOLD, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span style={{ fontSize: '13px' }}>⚡</span>{player.points}
              </div>
            )}
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
          </div>
        </div>
        <GlowLine />
      </header>

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {msg && (
        <div onClick={() => setMsg(null)} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: msg.error ? '#1A0808' : '#080818', borderTop: `1px solid ${msg.error ? DANGER : ACCENT}55`, padding: '14px 24px', cursor: 'pointer' }}>
          <pre style={{ fontSize: '12px', fontFamily: 'monospace', color: msg.error ? '#FCA5A5' : ACCENT, whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</pre>
          <p style={{ fontSize: '10px', color: MUTED, marginTop: '4px' }}>Tap to dismiss</p>
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {showCreate && player && (
        <CreateModal player={player} onClose={() => setShowCreate(false)}
          onSubmit={(t, s, c) => { callWrite('create_debate', [t, s, c]); setShowCreate(false) }} loading={loading} />
      )}
      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)}
          onSubmit={u => { callWriteNoCheck('register', [u]); setShowRegister(false) }} loading={loading} />
      )}
      {activeDebate && address && (
        <DetailModal debate={activeDebate} address={address} player={player}
          onClose={() => setActiveDebate(null)} onAction={callWrite}
          fetchDetail={id => fetchDebateDetail(id, address)} loading={loading} />
      )}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 80px' }}>

        {/* ════ ARENA ════════════════════════════════════════════════════════ */}
        {tab === 'arena' && (
          <div>
            {/* Hero */}
            <div style={{ margin: '28px 0 24px', position: 'relative', borderRadius: '20px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 80% 50%, ${GLOW}22 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, ${ACCENT}11 0%, transparent 50%)` }} />
              <div style={{ position: 'relative', padding: 'clamp(28px,5vw,60px)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}33`, borderRadius: '20px', padding: '5px 14px', marginBottom: '20px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: SUCCESS, display: 'inline-block', boxShadow: `0 0 8px ${SUCCESS}` }} />
                  <span style={{ fontSize: '11px', color: ACCENT, fontWeight: 600, letterSpacing: '0.05em' }}>POWERED BY GENLAYER AI VALIDATORS</span>
                </div>
                <h1 style={{ fontSize: 'clamp(32px,7vw,64px)', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: '16px' }}>
                  The On-Chain<br />
                  <span style={{ background: `linear-gradient(135deg, #A78BFA, ${GLOW}, #7C3AED)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 0 30px ${GLOW}55)` }}>
                    Debate Arena
                  </span>
                </h1>
                <p style={{ color: MUTED, fontSize: 'clamp(14px,2vw,17px)', maxWidth: '520px', lineHeight: 1.7, marginBottom: '28px' }}>
                  Stake points, argue your side, and let 5 independent GenLayer validators judge the winner. No bias. No politics. Pure logic.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
                  <button onClick={() => player?.registered === 'true' ? setShowCreate(true) : setShowRegister(true)}
                    style={{ background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '13px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 0 24px ${GLOW}44`, letterSpacing: '-0.01em' }}>
                    ⚔️ Create Debate
                  </button>
                  {(!player || player.registered !== 'true') && (
                    <button onClick={() => setShowRegister(true)}
                      style={{ background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: '12px', padding: '13px 28px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Join Arena
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                  <StatPill label="Debates" value={stats.total_debates ?? '0'} color={ACCENT} />
                  <StatPill label="Open" value={stats.open_debates ?? '0'} color={SUCCESS} />
                  <StatPill label="Players" value={stats.total_players ?? '0'} color={GOLD} />
                  <StatPill label="Completed" value={stats.completed_debates ?? '0'} color={MUTED} />
                </div>
              </div>
            </div>

            {/* How it works */}
            <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <p style={{ fontSize: '11px', color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '20px' }}>How It Works</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1px', backgroundColor: BORDER }}>
                {[
                  { n: '01', icon: '📌', title: 'Create', desc: 'Post a topic, set your stake. AI validates fairness.' },
                  { n: '02', icon: '🤝', title: 'Opponent Joins', desc: 'Any player matches your stake to accept.' },
                  { n: '03', icon: '✍️', title: 'Both Argue', desc: 'Submit independently. Arguments stay hidden.' },
                  { n: '04', icon: '🤖', title: 'AI Judges', desc: '5 GenLayer validators score and reach consensus.' },
                  { n: '05', icon: '🏆', title: 'Claim Points', desc: 'Winner claims both stakes on-chain instantly.' },
                ].map((s, i) => (
                  <div key={i} style={{ backgroundColor: CARD, padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: GLOW, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{s.n}</span>
                      <span style={{ fontSize: '18px' }}>{s.icon}</span>
                    </div>
                    <p style={{ fontWeight: 700, fontSize: '13px', color: TEXT }}>{s.title}</p>
                    <p style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55 }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Category filters */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
              {['ALL', ...CATEGORIES].map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '6px 16px', borderRadius: '8px', border: `1px solid ${catFilter === c ? ACCENT : BORDER}`, background: catFilter === c ? `${ACCENT}18` : 'transparent', color: catFilter === c ? ACCENT : MUTED, fontSize: '12px', fontWeight: catFilter === c ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>
                  {c}
                </button>
              ))}
            </div>

            <SectionHeader
              title="Open Debates"
              sub={`${openDebates.length} waiting for an opponent`}
              action={<RefreshBtn refreshing={refreshing} onClick={fetchAll} />}
            />

            {openDebates.length === 0 ? (
              <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '64px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '52px', marginBottom: '16px', filter: `drop-shadow(0 0 20px ${GLOW}44)` }}>⚔️</div>
                <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>The arena is empty</p>
                <p style={{ color: MUTED, fontSize: '14px', marginBottom: '24px' }}>Be the first to issue a challenge</p>
                <button onClick={() => player?.registered === 'true' ? setShowCreate(true) : setShowRegister(true)}
                  style={{ background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ⚔️ Create Debate
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px,100%), 1fr))', gap: '14px' }}>
                {openDebates.map(d => (
                  <DebateCard key={d.debate_id} debate={d} address={address}
                    onJoin={() => callWrite('join_debate', [d.debate_id])}
                    onClick={() => setActiveDebate(d)} loading={loading} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ MY DEBATES ═══════════════════════════════════════════════════ */}
        {tab === 'my-debates' && (
          <div style={{ paddingTop: '28px' }}>
            <SectionHeader title="My Debates" sub={`${myDebates.length} debates`} action={<RefreshBtn refreshing={refreshing} onClick={fetchAll} />} />
            {!address ? (
              <EmptyState icon="👤" title="Connect your wallet" sub="See all your debates and pending verdicts" />
            ) : myDebates.length === 0 ? (
              <EmptyState icon="🎯" title="No debates yet" sub="Step into the arena and challenge someone">
                <button onClick={() => setTab('arena')} style={{ marginTop: '16px', background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Browse Arena</button>
              </EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myDebates.map(d => (
                  <DebateCard key={d.debate_id} debate={d} address={address}
                    onJoin={() => {}} onClick={() => setActiveDebate(d)} loading={loading} detailed />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ LEADERBOARD ══════════════════════════════════════════════════ */}
        {tab === 'leaderboard' && (
          <div style={{ paddingTop: '28px' }}>
            <SectionHeader title="🏆 Leaderboard" sub="Top debaters ranked by wins" action={<RefreshBtn refreshing={refreshing} onClick={fetchAll} />} />
            {leaderboard.length === 0 ? (
              <EmptyState icon="🏆" title="No players yet" sub="Register and be the first on the board" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leaderboard.map((p, i) => {
                  const medals = ['🥇', '🥈', '🥉']
                  const rankColors = [GOLD, '#9CA3AF', '#B45309']
                  const isTop3 = i < 3
                  return (
                    <div key={p.address} style={{ backgroundColor: CARD, border: `1px solid ${i === 0 ? GOLD + '44' : BORDER}`, borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: i === 0 ? `0 0 24px ${GOLD}18` : 'none' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isTop3 ? `${rankColors[i]}18` : `${GLOW}18`, border: `1px solid ${isTop3 ? rankColors[i] + '44' : GLOW + '33'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isTop3 ? '20px' : '13px', fontWeight: 800, color: isTop3 ? rankColors[i] : MUTED, flexShrink: 0 }}>
                        {isTop3 ? medals[i] : `#${i + 1}`}
                      </div>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: `linear-gradient(135deg, ${GLOW}44, ${ACCENT}22)`, border: `1px solid ${ACCENT}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: ACCENT, flexShrink: 0 }}>
                        {p.username ? p.username[0].toUpperCase() : '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: '14px', color: i === 0 ? GOLD : TEXT }}>{p.username || shortAddr(p.address)}{p.address === address ? ' (you)' : ''}</p>
                        <p style={{ fontSize: '11px', color: MUTED, fontFamily: 'monospace', marginTop: '2px' }}>{shortAddr(p.address)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'center' }}><p style={{ fontWeight: 700, color: SUCCESS, fontSize: '16px', lineHeight: 1 }}>{p.wins}</p><p style={{ fontSize: '10px', color: MUTED, marginTop: '3px' }}>Wins</p></div>
                        <div style={{ textAlign: 'center' }}><p style={{ fontWeight: 700, color: DANGER, fontSize: '16px', lineHeight: 1 }}>{p.losses}</p><p style={{ fontSize: '10px', color: MUTED, marginTop: '3px' }}>Loss</p></div>
                        <div style={{ textAlign: 'center' }}><p style={{ fontWeight: 700, color: GOLD, fontSize: '16px', lineHeight: 1 }}>{p.points}</p><p style={{ fontSize: '10px', color: MUTED, marginTop: '3px' }}>Pts</p></div>
                        <div style={{ textAlign: 'center' }}><p style={{ fontWeight: 700, color: WARNING, fontSize: '16px', lineHeight: 1 }}>{p.best_streak}</p><p style={{ fontSize: '10px', color: MUTED, marginTop: '3px' }}>Streak</p></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ PROFILE ══════════════════════════════════════════════════════ */}
        {tab === 'profile' && (
          <div style={{ paddingTop: '28px' }}>
            <SectionHeader title="My Profile" />
            {!address ? (
              <EmptyState icon="🔌" title="Connect your wallet" sub="Your profile and stats live here" />
            ) : !player || player.registered !== 'true' ? (
              <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '56px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px', filter: `drop-shadow(0 0 24px ${GLOW}55)` }}>⚔️</div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>You're not in the arena yet</h3>
                <p style={{ color: MUTED, fontSize: '15px', marginBottom: '24px' }}>Register to receive <strong style={{ color: GOLD }}>{STARTING_POINTS} free points</strong> and start competing</p>
                <button onClick={() => setShowRegister(true)} style={{ background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px 32px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 0 24px ${GLOW}44` }}>
                  Register — Get {STARTING_POINTS} Points Free
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Profile hero card */}
                <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 90% 50%, ${GLOW}18 0%, transparent 60%)` }} />
                  <div style={{ position: 'relative', padding: '28px', display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 0 32px ${GLOW}55` }}>
                      {player.username ? player.username[0].toUpperCase() : '⚔️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>{player.username || 'Anonymous'}</h3>
                      <p style={{ color: MUTED, fontFamily: 'monospace', fontSize: '12px', marginBottom: '14px' }}>{address}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}33`, borderRadius: '20px', padding: '4px 14px', fontSize: '13px', color: ACCENT, fontWeight: 700 }}>⚡ {player.points} pts</span>
                        {parseInt(player.win_streak) > 1 && <span style={{ background: `${WARNING}18`, border: `1px solid ${WARNING}33`, borderRadius: '20px', padding: '4px 14px', fontSize: '13px', color: WARNING, fontWeight: 700 }}>🔥 {player.win_streak} streak</span>}
                        {parseInt(player.wins) >= 5 && <span style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}33`, borderRadius: '20px', padding: '4px 14px', fontSize: '13px', color: GOLD, fontWeight: 700 }}>⭐ Veteran</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(120px,calc(50% - 5px)), 1fr))', gap: '10px' }}>
                  {[
                    { icon: '⚔️', label: 'Debates', value: player.total_debates, color: TEXT },
                    { icon: '✅', label: 'Wins', value: player.wins, color: SUCCESS },
                    { icon: '❌', label: 'Losses', value: player.losses, color: DANGER },
                    { icon: '🤝', label: 'Draws', value: player.draws, color: MUTED },
                    { icon: '🔥', label: 'Best Streak', value: player.best_streak, color: WARNING },
                    { icon: '📈', label: 'Pts Earned', value: player.points_earned, color: SUCCESS },
                    { icon: '📉', label: 'Pts Lost', value: player.points_lost, color: DANGER },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
                      <p style={{ fontSize: '24px', fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
                      <p style={{ fontSize: '10px', color: MUTED, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Win rate bar */}
                {parseInt(player.total_debates) > 0 && (
                  <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Win Rate</span>
                      <span style={{ fontSize: '13px', color: ACCENT, fontWeight: 700 }}>
                        {Math.round((parseInt(player.wins) / parseInt(player.total_debates)) * 100)}%
                      </span>
                    </div>
                    <div style={{ backgroundColor: '#1a1a2e', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((parseInt(player.wins) / parseInt(player.total_debates)) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${GLOW}, ${ACCENT})`, borderRadius: '6px', boxShadow: `0 0 12px ${GLOW}66`, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: MUTED }}>0%</span>
                      <span style={{ fontSize: '11px', color: MUTED }}>100%</span>
                    </div>
                  </div>
                )}

                {/* Contract info */}
                <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', fontFamily: 'monospace', fontSize: '11px', color: MUTED, lineHeight: 2 }}>
                  <div>Contract: <span style={{ color: TEXT }}>{CONTRACT_ADDRESS}</span></div>
                  <div>Network: <span style={{ color: TEXT }}>GenLayer Bradbury · Chain 4221</span></div>
                  <div><a href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener" style={{ color: ACCENT }}>View on Explorer ↗</a></div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub, children }: { icon: string; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '64px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '52px', marginBottom: '16px' }}>{icon}</div>
      <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{title}</p>
      <p style={{ color: MUTED, fontSize: '14px' }}>{sub}</p>
      {children}
    </div>
  )
}

// ─── Debate Card ──────────────────────────────────────────────────────────────
function DebateCard({ debate, address, onJoin, onClick, loading, detailed = false }: {
  debate: Debate; address?: string; onJoin: () => void; onClick: () => void; loading: boolean; detailed?: boolean
}) {
  const isCreator = debate.creator === address
  const isOpponent = debate.opponent === address
  const isWinner = debate.winner === address
  const isDraw = debate.winner === 'DRAW'
  const badge = STATUS_BADGE[debate.status] ?? { label: debate.status, color: MUTED, bg: '#6B6A8A18' }

  return (
    <div onClick={onClick} style={{ backgroundColor: CARD, border: `1px solid ${isWinner ? GOLD + '44' : BORDER}`, borderRadius: '16px', padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'border-color 0.2s', boxShadow: isWinner ? `0 0 20px ${GOLD}11` : 'none' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: MUTED, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '2px 8px', fontWeight: 500 }}>{debate.category}</span>
            <span style={{ fontSize: '10px', color: GOLD, background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>⚡ {debate.stake} pts each</span>
          </div>
          <p style={{ fontWeight: 700, fontSize: '15px', lineHeight: 1.35, color: TEXT }}>{debate.topic}</p>
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, color: badge.color, background: badge.bg, padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.03em' }}>
          {badge.label}
        </span>
      </div>

      {/* Players */}
      <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: MUTED, flexWrap: 'wrap' }}>
        <span style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '3px 8px' }}>
          🧑 <span style={{ color: isCreator ? ACCENT : TEXT, fontFamily: 'monospace' }}>{shortAddr(debate.creator)}{isCreator ? ' (you)' : ''}</span>
        </span>
        {debate.opponent !== '0x0000000000000000000000000000000000000000' && (
          <span style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '3px 8px' }}>
            ⚔️ <span style={{ color: isOpponent ? ACCENT : TEXT, fontFamily: 'monospace' }}>{shortAddr(debate.opponent)}{isOpponent ? ' (you)' : ''}</span>
          </span>
        )}
      </div>

      {/* Verdict snippet */}
      {['FINISHED', 'CLAIMED', 'FINAL'].includes(debate.status) && debate.reasoning && (
        <div style={{ background: `${GLOW}0A`, border: `1px solid ${GLOW}22`, borderRadius: '10px', padding: '10px 12px' }}>
          {isDraw ? <p style={{ fontSize: '12px', color: WARNING, fontWeight: 600 }}>🤝 Draw — stakes returned</p>
            : isWinner ? <p style={{ fontSize: '12px', color: SUCCESS, fontWeight: 600 }}>🏆 You won! {debate.claimed !== 'true' ? '— Claim your points →' : '✓ Claimed'}</p>
            : (isCreator || isOpponent) ? <p style={{ fontSize: '12px', color: DANGER, fontWeight: 600 }}>You lost this round</p>
            : <p style={{ fontSize: '12px', color: ACCENT, fontWeight: 600 }}>Winner: {shortAddr(debate.winner)}</p>}
          <p style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.55 }}>{debate.reasoning.slice(0, 120)}{debate.reasoning.length > 120 ? '…' : ''}</p>
        </div>
      )}

      {/* Join CTA */}
      {debate.status === 'OPEN' && !isCreator && address && (
        <button disabled={loading} onClick={e => { e.stopPropagation(); onJoin() }}
          style={{ width: '100%', background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit' }}>
          ⚔️ Accept Challenge — Stake {debate.stake} pts
        </button>
      )}

      {debate.status !== 'OPEN' && (
        <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>Tap to view full debate →</p>
      )}
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ debate: init, address, player, onClose, onAction, fetchDetail, loading }: {
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

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(4,4,10,0.90)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px' }} onClick={onClose}>
      <div style={{ backgroundColor: SURFACE, border: `1px solid ${ACCENT}33`, borderRadius: '20px', padding: '24px 20px 32px', width: '100%', maxWidth: '660px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1, paddingRight: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: MUTED, background: CARD, border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '2px 8px' }}>{debate.category}</span>
              <span style={{ fontSize: '10px', color: GOLD, background: `${GOLD}11`, border: `1px solid ${GOLD}33`, borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>⚡ {debate.stake} pts each · Winner gets {parseInt(debate.stake) * 2}</span>
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.01em' }}>{debate.topic}</h2>
          </div>
          <button onClick={onClose} style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED, fontSize: '18px', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Score cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Creator', addr: debate.creator, arg: debate.creator_argument, score: debate.creator_score, breakdown: debate.creator_score_breakdown, isMe: isCreator },
            { label: 'Opponent', addr: debate.opponent, arg: debate.opponent_argument, score: debate.opponent_score, breakdown: debate.opponent_score_breakdown, isMe: isOpponent },
          ].map((p, i) => (
            <div key={i} style={{ backgroundColor: CARD, border: `1px solid ${debate.winner === p.addr ? GOLD + '55' : BORDER}`, borderRadius: '12px', padding: '14px', boxShadow: debate.winner === p.addr ? `0 0 20px ${GOLD}18` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{p.label}</p>
                {debate.winner === p.addr && !isDraw && <span style={{ fontSize: '14px' }}>🏆</span>}
                {isDraw && p.addr !== '0x0000000000000000000000000000000000000000' && <span style={{ fontSize: '14px' }}>🤝</span>}
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: p.isMe ? ACCENT : TEXT, marginBottom: '6px' }}>{shortAddr(p.addr)}{p.isMe ? ' (you)' : ''}</p>
              {p.score && <p style={{ fontSize: '28px', fontWeight: 900, color: ACCENT, letterSpacing: '-0.02em', lineHeight: 1 }}>{p.score}<span style={{ fontSize: '14px', color: MUTED, fontWeight: 400 }}>/100</span></p>}
              {p.arg && isParty && <p style={{ fontSize: '11px', color: MUTED, marginTop: '8px', lineHeight: 1.55 }}>{p.arg.slice(0, 110)}{p.arg.length > 110 ? '…' : ''}</p>}
              {!p.arg && debate.status === 'ACTIVE' && <p style={{ fontSize: '11px', color: WARNING, marginTop: '8px' }}>⏳ Waiting…</p>}
            </div>
          ))}
        </div>

        {/* AI Verdict */}
        {debate.reasoning && (
          <div style={{ background: `${GLOW}0C`, border: `1px solid ${GLOW}22`, borderRadius: '14px', padding: '18px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>🤖</span>
              <p style={{ fontSize: '12px', color: ACCENT, fontWeight: 700, letterSpacing: '0.03em' }}>AI VALIDATOR VERDICT</p>
            </div>
            <p style={{ fontSize: '14px', color: TEXT, lineHeight: 1.7, marginBottom: debate.creator_score_breakdown && isParty ? '12px' : '0' }}>{debate.reasoning}</p>
            {debate.creator_score_breakdown && isParty && (
              <div style={{ paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: '11px', color: MUTED, marginBottom: '6px', fontWeight: 600 }}>Score Breakdown:</p>
                <p style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6 }}>Creator: {debate.creator_score_breakdown}</p>
                <p style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6, marginTop: '4px' }}>Opponent: {debate.opponent_score_breakdown}</p>
              </div>
            )}
            {debate.appeal_reasoning && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: '11px', color: WARNING, fontWeight: 700, marginBottom: '4px' }}>Appeal: {debate.appeal_verdict}</p>
                <p style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6 }}>{debate.appeal_reasoning}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {debate.status === 'OPEN' && !isCreator && (
            <button disabled={loading} onClick={() => { onAction('join_debate', [debate.debate_id]); onClose() }}
              style={{ background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit' }}>
              ⚔️ Accept Challenge — Stake {debate.stake} pts
            </button>
          )}

          {debate.status === 'ACTIVE' && isParty && !hasMyArg && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: `${ACCENT}0A`, border: `1px solid ${ACCENT}22`, borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: ACCENT, lineHeight: 1.6 }}>
                ⚡ After both players submit, AI validators judge automatically (1–3 min). Neither player sees the other argument until judging.
              </div>
              <textarea value={arg} onChange={e => setArg(e.target.value)}
                placeholder="Make your strongest argument. Score is based on logic (35pts), evidence (25pts), persuasiveness (25pts), and clarity (15pts)."
                style={{ ...inp, minHeight: '140px', resize: 'vertical' }} />
              <button disabled={loading || arg.trim().length < 20} onClick={() => { onAction('submit_argument', [debate.debate_id, arg]); onClose() }}
                style={{ background: arg.trim().length >= 20 ? `linear-gradient(135deg, ${GLOW}, ${ACCENT})` : CARD, color: arg.trim().length >= 20 ? '#fff' : MUTED, border: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: 700, cursor: arg.trim().length >= 20 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                ⚔️ Submit Argument — AI Judges Automatically
              </button>
              <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>{arg.length} chars · minimum 20</p>
            </div>
          )}

          {debate.status === 'ACTIVE' && isParty && hasMyArg && (
            <div style={{ background: `${SUCCESS}0A`, border: `1px solid ${SUCCESS}22`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: SUCCESS, fontWeight: 600 }}>✓ Argument submitted — waiting for opponent</p>
            </div>
          )}

          {debate.status === 'FINISHED' && isWinner && !isDraw && debate.claimed !== 'true' && (
            <button disabled={loading} onClick={() => { onAction('claim_winnings', [debate.debate_id]); onClose() }}
              style={{ background: `linear-gradient(135deg, ${GOLD}, #D97706)`, color: '#000', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit', boxShadow: `0 0 24px ${GOLD}44` }}>
              🏆 Claim {parseInt(debate.stake) * 2} Points
            </button>
          )}

          {debate.status === 'OPEN' && isCreator && (
            <button disabled={loading} onClick={() => { onAction('cancel_debate', [debate.debate_id]); onClose() }}
              style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel Debate (refunds stake)
            </button>
          )}

          {debate.status === 'FINISHED' && isParty && !isWinner && !isDraw && !debate.appeal_grounds && (
            !showAppeal ? (
              <button onClick={() => setShowAppeal(true)} style={{ background: 'transparent', color: WARNING, border: `1px solid ${WARNING}44`, borderRadius: '12px', padding: '12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Appeal Verdict (costs {APPEAL_COST} points)
              </button>
            ) : (
              <div style={{ background: `${WARNING}08`, border: `1px solid ${WARNING}33`, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: WARNING, fontWeight: 600 }}>Strict standard — appeal only on clear judging error:</p>
                <textarea value={appealText} onChange={e => setAppealText(e.target.value)} placeholder="What specific error did the validator make? Provide clear evidence." style={{ ...inp, minHeight: '80px', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={loading || !appealText.trim()} onClick={() => { onAction('appeal_verdict', [debate.debate_id, appealText]); setShowAppeal(false); onClose() }}
                    style={{ flex: 1, background: WARNING, color: '#000', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: appealText.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>
                    Submit Appeal
                  </button>
                  <button onClick={() => setShowAppeal(false)} style={{ background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Create Debate Modal ──────────────────────────────────────────────────────
function CreateModal({ player, onClose, onSubmit, loading }: {
  player: Player; onClose: () => void; onSubmit: (t: string, s: string, c: string) => void; loading: boolean
}) {
  const [topic, setTopic] = useState('')
  const [stake, setStake] = useState('10')
  const [cat, setCat] = useState('General')
  const max = Math.min(MAX_STAKE, parseInt(player.points))
  const ok = topic.trim().length >= 10 && parseInt(stake) >= MIN_STAKE && parseInt(stake) <= max

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(4,4,10,0.90)', zIndex: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderTop: `1px solid ${ACCENT}33`, borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '580px', maxHeight: '75vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: '40px', height: '4px', background: BORDER, borderRadius: '2px', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>⚔️ Create Debate</h2>
          <button onClick={onClose} style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED, fontSize: '18px', cursor: 'pointer', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}22`, borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: ACCENT, marginBottom: '20px', lineHeight: 1.6 }}>
          ℹ️ AI validators verify your topic is fair and arguable before the debate goes live.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debate Topic *</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Remote work is more productive than office work" style={inp} />
            <p style={{ fontSize: '11px', color: MUTED, marginTop: '5px' }}>{topic.length} chars · must be clearly arguable</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stake (pts) <span style={{ color: GOLD }}>· {player.points} available</span></label>
              <input type="number" min={MIN_STAKE} max={max} value={stake} onChange={e => setStake(e.target.value)} style={inp} />
              <p style={{ fontSize: '11px', color: MUTED, marginTop: '5px' }}>Winner gets {parseInt(stake || '0') * 2} pts</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</label>
              <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button disabled={loading || !ok} onClick={() => onSubmit(topic, stake, cat)}
            style={{ background: ok ? `linear-gradient(135deg, ${GLOW}, ${ACCENT})` : CARD, color: ok ? '#fff' : MUTED, border: 'none', borderRadius: '12px', padding: '15px', fontSize: '15px', fontWeight: 700, cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: ok ? `0 0 24px ${GLOW}33` : 'none' }}>
            ⚔️ Create Debate
          </button>
        </div>
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
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(4,4,10,0.92)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div style={{ backgroundColor: SURFACE, border: `1px solid ${ACCENT}44`, borderRadius: '24px', padding: '40px 32px', width: '100%', maxWidth: '420px', boxShadow: `0 0 60px ${GLOW}22` }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '56px', marginBottom: '14px', filter: `drop-shadow(0 0 28px ${GLOW}66)` }}>⚔️</div>
          <h2 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '10px' }}>Enter the Arena</h2>
          <p style={{ color: MUTED, fontSize: '15px', lineHeight: 1.65 }}>Register to receive <strong style={{ color: GOLD }}>{STARTING_POINTS} free points</strong> and start competing in on-chain debates.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Choose a Name <span style={{ color: MUTED, fontWeight: 400, textTransform: 'none' }}>(optional · max 20 chars)</span></label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. DebateMaster, LogicKing…" maxLength={20} style={inp} />
          </div>
          <button disabled={loading} onClick={() => onSubmit(username)}
            style={{ background: `linear-gradient(135deg, ${GLOW}, ${ACCENT})`, color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit', boxShadow: `0 0 24px ${GLOW}44`, letterSpacing: '-0.01em' }}>
            🚀 Register & Get {STARTING_POINTS} Points
          </button>
          <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>Signs a transaction on GenLayer Bradbury Testnet · Gas free</p>
        </div>
      </div>
    </div>
  )
}
