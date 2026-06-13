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

const PURPLE = '#7C3AED', DARK = '#09090B', CARD = '#18181B', BORDER = '#27272A'
const TEXT = '#FAFAFA', MUTED = '#71717A', SUCCESS = '#22c55e', DANGER = '#ef4444'
const WARNING = '#f59e0b', GOLD = '#F59E0B'

const CATEGORIES = ['General', 'Technology', 'Politics', 'Philosophy', 'Science', 'Sports', 'Entertainment', 'Economics']

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#22c55e', ACTIVE: '#60a5fa', JUDGING: WARNING,
  FINISHED: PURPLE, CLAIMED: MUTED, FINAL: MUTED, CANCELLED: DANGER,
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open', ACTIVE: 'Active', JUDGING: 'Judging…',
  FINISHED: 'Verdict In', CLAIMED: 'Complete', FINAL: 'Final', CANCELLED: 'Cancelled',
}

function shortAddr(a: string) {
  if (!a || a === '0x0000000000000000000000000000000000000000') return '—'
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', backgroundColor: '#09090B', border: `1px solid ${BORDER}`,
  borderRadius: '8px', padding: '10px 12px', color: TEXT, fontSize: '13px',
  boxSizing: 'border-box', outline: 'none',
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedDebate, setSelectedDebate] = useState<Debate | null>(null)
  const [catFilter, setCatFilter] = useState('ALL')

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const debatesRaw = await readContract('get_all_debates')
      try { setDebates(JSON.parse(debatesRaw as string)) } catch {}
      await delay(700)
      const statsRaw = await readContract('get_platform_stats')
      try { setStats(JSON.parse(statsRaw as string)) } catch {}
      await delay(700)
      const lbRaw = await readContract('get_leaderboard')
      try { setLeaderboard(JSON.parse(lbRaw as string)) } catch {}
    } catch (e) { console.error(e) }
    finally { setRefreshing(false) }
  }, [])

  const fetchPlayer = useCallback(async (addr: string) => {
    try {
      const raw = await readContract('get_player', [addr])
      setPlayer(JSON.parse(raw as string))
    } catch {}
  }, [])

  const fetchDebateDetail = useCallback(async (debateId: string, viewer: string) => {
    try {
      const raw = await readContract('get_debate_for_participant', [debateId, viewer])
      return JSON.parse(raw as string) as Debate
    } catch { return null }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { if (address) fetchPlayer(address) }, [address, fetchPlayer])

  const showMsg = (text: string, error = false) => {
    setMsg({ text, error })
    if (!error) setTimeout(() => setMsg(null), 12000)
  }

  async function callWrite(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet first.', true); return false }
    if (!player || player.registered !== 'true') {
      setShowRegisterModal(true); return false
    }
    setLoading(true)
    const isJudging = method === 'submit_argument'
    showMsg(`${isJudging ? '⚔️ Submitting argument… AI validators will judge automatically. This takes 1–3 minutes.' : `Processing ${method}…`} Do not close this tab.`)
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const result = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (result.success) {
        showMsg(`✓ ${method} succeeded!`)
        await fetchAll()
        if (address) await fetchPlayer(address)
        return true
      } else {
        showMsg(`Failed: ${result.error}`, true)
        return false
      }
    } catch (e: any) {
      setLoading(false); showMsg(e?.message ?? String(e), true); return false
    }
  }

  async function callWriteNoCheck(method: string, args: unknown[]) {
    if (!address) { showMsg('Connect your wallet first.', true); return false }
    setLoading(true)
    showMsg(`Processing ${method}…`)
    try {
      const { writeContractWithWallet } = await import('@/lib/genlayer')
      const result = await writeContractWithWallet(address, method, args)
      setLoading(false)
      if (result.success) {
        showMsg(`✓ ${method} succeeded!`)
        await fetchAll()
        if (address) await fetchPlayer(address)
        return true
      } else {
        showMsg(`Failed: ${result.error}`, true)
        return false
      }
    } catch (e: any) {
      setLoading(false); showMsg(e?.message ?? String(e), true); return false
    }
  }

  const openDebates = debates.filter(d => d.status === 'OPEN' && (catFilter === 'ALL' || d.category === catFilter))
  const myDebates = debates.filter(d => d.creator === address || d.opponent === address)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: DARK, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#0C0C0E', borderBottom: `1px solid ${BORDER}`, padding: '0 20px', display: 'flex', alignItems: 'center', height: '58px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginRight: '8px' }}>
          <div style={{ width: '32px', height: '32px', background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚔️</div>
          <span style={{ fontWeight: 800, fontSize: '18px', background: `linear-gradient(135deg, #A855F7, #7C3AED)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DeBattle</span>
        </div>
        <div style={{ display: 'flex', gap: '2px', flex: 1, overflowX: 'auto' }}>
          {([['arena', '🏟️ Arena'], ['my-debates', '⚔️ My Debates'], ['leaderboard', '🏆 Leaderboard'], ['profile', '👤 Profile']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t ? 600 : 400, backgroundColor: tab === t ? '#27272A' : 'transparent', color: tab === t ? TEXT : MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {player && player.registered === 'true' && (
            <div style={{ backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '4px 12px', fontSize: '13px', fontWeight: 600, color: GOLD }}>
              ⚡ {player.points} pts
            </div>
          )}
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
        </div>
      </nav>

      {/* MSG */}
      {msg && (
        <div onClick={() => setMsg(null)} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, backgroundColor: msg.error ? '#1a0505' : '#0a051a', border: `1px solid ${msg.error ? DANGER : PURPLE}`, borderRadius: '12px 12px 0 0', padding: '14px 20px', cursor: 'pointer' }}>
          <pre style={{ fontSize: '12px', fontFamily: 'monospace', color: msg.error ? '#f87171' : '#A855F7', whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</pre>
          <p style={{ fontSize: '10px', color: MUTED, marginTop: '4px' }}>Tap to dismiss</p>
        </div>
      )}

      {/* MODALS */}
      {showCreateModal && player && (
        <CreateDebateModal
          player={player} onClose={() => setShowCreateModal(false)}
          onSubmit={(topic, stake, category) => { callWrite('create_debate', [topic, stake, category]); setShowCreateModal(false) }}
          loading={loading}
        />
      )}
      {showRegisterModal && (
        <RegisterModal
          onClose={() => setShowRegisterModal(false)}
          onSubmit={(username) => { callWriteNoCheck('register', [username]); setShowRegisterModal(false) }}
          loading={loading}
        />
      )}
      {selectedDebate && address && (
        <DebateDetailModal
          debate={selectedDebate}
          address={address}
          player={player}
          onClose={() => setSelectedDebate(null)}
          onAction={callWrite}
          fetchDetail={(id) => fetchDebateDetail(id, address)}
          loading={loading}
        />
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>

        {/* ═══ ARENA TAB ═══ */}
        {tab === 'arena' && (
          <div>
            {/* Hero */}
            <div style={{ margin: '20px 0', background: 'linear-gradient(135deg, #0C0C0E 0%, #1a0a2e 50%, #0C0C0E 100%)', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: 'clamp(24px,4vw,56px)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '200px', height: '200px', background: `radial-gradient(circle, ${PURPLE}33 0%, transparent 70%)` }} />
              <div style={{ fontSize: '12px', color: PURPLE, fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: PURPLE, borderRadius: '50%', display: 'inline-block' }} />
                Powered by GenLayer AI Validators
              </div>
              <h1 style={{ fontSize: 'clamp(28px,6vw,56px)', fontWeight: 800, lineHeight: 1.05, marginBottom: '14px' }}>
                The On-Chain<br />
                <span style={{ background: `linear-gradient(135deg, #A855F7, #7C3AED)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Debate Arena</span>
              </h1>
              <p style={{ color: MUTED, fontSize: 'clamp(13px,2vw,16px)', maxWidth: '480px', lineHeight: 1.7, marginBottom: '24px' }}>
                Stake points, argue your side, and let 5 independent AI validators judge the winner. No bias. No politics. Pure logic.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: PURPLE }}>{stats.total_debates ?? '0'}</p>
                  <p style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>Total Debates</p>
                </div>
                <div style={{ backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: SUCCESS }}>{stats.open_debates ?? '0'}</p>
                  <p style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>Open Debates</p>
                </div>
                <div style={{ backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: GOLD }}>{stats.total_players ?? '0'}</p>
                  <p style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>Players</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => player?.registered === 'true' ? setShowCreateModal(true) : setShowRegisterModal(true)}
                  style={{ background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
                  ⚔️ Create Debate
                </button>
                {(!player || player.registered !== 'true') && (
                  <button onClick={() => setShowRegisterModal(true)}
                    style={{ backgroundColor: 'transparent', color: PURPLE, border: `1px solid ${PURPLE}`, borderRadius: '10px', padding: '12px 24px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                    Join DeBattle
                  </button>
                )}
              </div>
            </div>

            {/* How it works */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '24px' }}>
              {[
                { icon: '1️⃣', title: 'Create', desc: 'Pick a topic, stake points' },
                { icon: '2️⃣', title: 'Opponent Joins', desc: 'Matches your stake' },
                { icon: '3️⃣', title: 'Both Argue', desc: 'Submit your best argument' },
                { icon: '4️⃣', title: 'AI Judges', desc: '5 validators score both sides' },
                { icon: '5️⃣', title: 'Claim Points', desc: 'Winner takes both stakes' },
              ].map(s => (
                <div key={s.title} style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
                  <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '3px' }}>{s.title}</p>
                  <p style={{ color: MUTED, fontSize: '11px' }}>{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Category filters */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
              {['ALL', ...CATEGORIES].map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  style={{ padding: '5px 14px', borderRadius: '20px', border: `1px solid ${catFilter === c ? PURPLE : BORDER}`, backgroundColor: catFilter === c ? PURPLE : 'transparent', color: catFilter === c ? '#fff' : MUTED, fontSize: '12px', fontWeight: catFilter === c ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {c}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Open Debates</h2>
                <p style={{ color: MUTED, fontSize: '13px', marginTop: '2px' }}>{openDebates.length} waiting for an opponent</p>
              </div>
              <button onClick={fetchAll} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
                {refreshing ? '↻ Loading…' : '↻ Refresh'}
              </button>
            </div>

            {openDebates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: '48px', marginBottom: '14px' }}>⚔️</div>
                <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No open debates</p>
                <p style={{ color: MUTED, fontSize: '14px', marginBottom: '20px' }}>Be the first to create a debate and challenge the arena</p>
                <button onClick={() => player?.registered === 'true' ? setShowCreateModal(true) : setShowRegisterModal(true)}
                  style={{ background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                  ⚔️ Create Debate
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px,100%), 1fr))', gap: '14px', paddingBottom: '48px' }}>
                {openDebates.map(d => (
                  <DebateCard key={d.debate_id} debate={d} address={address} player={player}
                    onJoin={() => callWrite('join_debate', [d.debate_id])}
                    onClick={() => setSelectedDebate(d)}
                    loading={loading} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ MY DEBATES TAB ═══ */}
        {tab === 'my-debates' && (
          <div style={{ paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>My Debates</h2>
                <p style={{ color: MUTED, fontSize: '13px', marginTop: '2px' }}>{myDebates.length} total</p>
              </div>
              <button onClick={fetchAll} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
                {refreshing ? '↻ Loading…' : '↻ Refresh'}
              </button>
            </div>
            {!address ? (
              <div style={{ textAlign: 'center', padding: '60px', backgroundColor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>Connect your wallet to see your debates</p>
              </div>
            ) : myDebates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', backgroundColor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: '48px', marginBottom: '14px' }}>🎯</div>
                <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No debates yet</p>
                <button onClick={() => setTab('arena')} style={{ background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Browse Arena</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myDebates.map(d => (
                  <DebateCard key={d.debate_id} debate={d} address={address} player={player}
                    onJoin={() => {}}
                    onClick={() => setSelectedDebate(d)}
                    loading={loading} detailed />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ LEADERBOARD TAB ═══ */}
        {tab === 'leaderboard' && (
          <div style={{ paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>🏆 Leaderboard</h2>
                <p style={{ color: MUTED, fontSize: '13px', marginTop: '2px' }}>Top debaters by wins</p>
              </div>
              <button onClick={fetchAll} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
                {refreshing ? '↻ Loading…' : '↻ Refresh'}
              </button>
            </div>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', backgroundColor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏆</div>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>No players yet — be the first!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {leaderboard.map((p, i) => (
                  <div key={p.address} style={{ backgroundColor: CARD, border: `1px solid ${i < 3 ? GOLD + '44' : BORDER}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: i === 0 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : i === 1 ? 'linear-gradient(135deg, #9CA3AF, #6B7280)' : i === 2 ? 'linear-gradient(135deg, #B45309, #92400E)' : '#27272A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i < 3 ? '16px' : '13px', fontWeight: 700, color: i < 3 ? '#fff' : MUTED, flexShrink: 0 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '14px' }}>{p.username || shortAddr(p.address)}</p>
                      <p style={{ fontSize: '11px', color: MUTED, fontFamily: 'monospace' }}>{shortAddr(p.address)}{p.address === address ? ' (you)' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', textAlign: 'center' }}>
                      <div><p style={{ fontWeight: 700, color: SUCCESS }}>{p.wins}</p><p style={{ fontSize: '10px', color: MUTED }}>Wins</p></div>
                      <div><p style={{ fontWeight: 700, color: DANGER }}>{p.losses}</p><p style={{ fontSize: '10px', color: MUTED }}>Losses</p></div>
                      <div><p style={{ fontWeight: 700, color: GOLD }}>{p.points}</p><p style={{ fontSize: '10px', color: MUTED }}>Points</p></div>
                      <div><p style={{ fontWeight: 700, color: PURPLE }}>{p.best_streak}</p><p style={{ fontSize: '10px', color: MUTED }}>Best Streak</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ PROFILE TAB ═══ */}
        {tab === 'profile' && (
          <div style={{ paddingTop: '24px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>My Profile</h2>
            {!address ? (
              <div style={{ textAlign: 'center', padding: '60px', backgroundColor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: '16px', fontWeight: 600 }}>Connect your wallet to view your profile</p>
              </div>
            ) : !player || player.registered !== 'true' ? (
              <div style={{ textAlign: 'center', padding: '60px', backgroundColor: CARD, borderRadius: '12px', border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: '48px', marginBottom: '14px' }}>👤</div>
                <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>You're not registered yet</p>
                <p style={{ color: MUTED, fontSize: '14px', marginBottom: '20px' }}>Register to get {STARTING_POINTS} free starting points and start debating</p>
                <button onClick={() => setShowRegisterModal(true)} style={{ background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
                  Register Now — Get {STARTING_POINTS} Points Free
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Profile card */}
                <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '24px', background: 'linear-gradient(135deg, #18181B 0%, #1a0a2e 100%)' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
                      {player.username ? player.username[0].toUpperCase() : '⚔️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 800, fontSize: '22px' }}>{player.username || 'Anonymous'}</p>
                      <p style={{ color: MUTED, fontFamily: 'monospace', fontSize: '12px', marginTop: '2px' }}>{address}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: PURPLE + '22', border: `1px solid ${PURPLE}44`, borderRadius: '20px', padding: '3px 12px', fontSize: '12px', color: PURPLE, fontWeight: 600 }}>
                          ⚡ {player.points} pts
                        </span>
                        {parseInt(player.win_streak) > 0 && (
                          <span style={{ backgroundColor: WARNING + '22', border: `1px solid ${WARNING}44`, borderRadius: '20px', padding: '3px 12px', fontSize: '12px', color: WARNING, fontWeight: 600 }}>
                            🔥 {player.win_streak} streak
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  {[
                    { label: 'Total Debates', value: player.total_debates, color: TEXT, icon: '⚔️' },
                    { label: 'Wins', value: player.wins, color: SUCCESS, icon: '✅' },
                    { label: 'Losses', value: player.losses, color: DANGER, icon: '❌' },
                    { label: 'Draws', value: player.draws, color: MUTED, icon: '🤝' },
                    { label: 'Best Streak', value: player.best_streak, color: WARNING, icon: '🔥' },
                    { label: 'Points Earned', value: player.points_earned, color: SUCCESS, icon: '📈' },
                    { label: 'Points Lost', value: player.points_lost, color: DANGER, icon: '📉' },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
                      <p style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</p>
                      <p style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Win rate */}
                {parseInt(player.total_debates) > 0 && (
                  <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: MUTED }}>Win Rate</span>
                      <span style={{ fontSize: '13px', color: PURPLE, fontWeight: 600 }}>
                        {Math.round((parseInt(player.wins) / parseInt(player.total_debates)) * 100)}%
                      </span>
                    </div>
                    <div style={{ backgroundColor: '#27272A', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((parseInt(player.wins) / parseInt(player.total_debates)) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${PURPLE}, #A855F7)`, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )}

                {/* Contract info */}
                <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px 16px', fontFamily: 'monospace', fontSize: '11px', color: MUTED, lineHeight: 1.8 }}>
                  <p>Contract: {CONTRACT_ADDRESS}</p>
                  <p>Network: GenLayer Bradbury Testnet · Chain ID: 4221</p>
                  <p><a href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener" style={{ color: PURPLE, textDecoration: 'underline' }}>View on Explorer →</a></p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DEBATE CARD ──────────────────────────────────────────────────────────────
function DebateCard({ debate, address, player, onJoin, onClick, loading, detailed = false }: {
  debate: Debate; address?: string; player: Player | null
  onJoin: () => void; onClick: () => void; loading: boolean; detailed?: boolean
}) {
  const isCreator = debate.creator === address
  const isOpponent = debate.opponent === address
  const isParty = isCreator || isOpponent
  const isWinner = debate.winner === address
  const isDraw = debate.winner === 'DRAW'
  const statusColor = STATUS_COLOR[debate.status] ?? MUTED

  return (
    <div onClick={onClick} style={{ backgroundColor: CARD, border: `1px solid ${isWinner ? '#7C3AED55' : BORDER}`, borderRadius: '14px', padding: '18px', cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: MUTED, backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '2px 7px' }}>{debate.category}</span>
            <span style={{ fontSize: '10px', color: GOLD, backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>⚡ {debate.stake} pts each</span>
          </div>
          <p style={{ fontWeight: 700, fontSize: '15px', lineHeight: 1.3, color: TEXT }}>{debate.topic}</p>
        </div>
        <span style={{ fontSize: '10px', fontWeight: 600, color: statusColor, backgroundColor: `${statusColor}18`, padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {STATUS_LABEL[debate.status] ?? debate.status}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: MUTED, flexWrap: 'wrap', gap: '6px' }}>
        <span>Creator: <span style={{ fontFamily: 'monospace', color: isCreator ? PURPLE : MUTED }}>{shortAddr(debate.creator)}{isCreator ? ' (you)' : ''}</span></span>
        {debate.opponent !== '0x0000000000000000000000000000000000000000' && (
          <span>Opponent: <span style={{ fontFamily: 'monospace', color: isOpponent ? PURPLE : MUTED }}>{shortAddr(debate.opponent)}{isOpponent ? ' (you)' : ''}</span></span>
        )}
      </div>

      {/* Verdict result for finished debates */}
      {(debate.status === 'FINISHED' || debate.status === 'CLAIMED' || debate.status === 'FINAL') && debate.reasoning && (
        <div style={{ backgroundColor: '#0a0514', border: `1px solid ${PURPLE}33`, borderRadius: '8px', padding: '10px' }}>
          {isDraw ? (
            <p style={{ fontSize: '12px', color: WARNING, fontWeight: 600 }}>🤝 Draw — both players keep their stake</p>
          ) : isWinner ? (
            <p style={{ fontSize: '12px', color: SUCCESS, fontWeight: 600 }}>🏆 You won! {debate.claimed !== 'true' ? 'Claim your points →' : 'Points claimed ✓'}</p>
          ) : isParty ? (
            <p style={{ fontSize: '12px', color: DANGER, fontWeight: 600 }}>You lost this debate</p>
          ) : (
            <p style={{ fontSize: '12px', color: PURPLE, fontWeight: 600 }}>Winner: {shortAddr(debate.winner)}</p>
          )}
          <p style={{ fontSize: '11px', color: MUTED, marginTop: '4px', lineHeight: 1.5 }}>{debate.reasoning.slice(0, 120)}{debate.reasoning.length > 120 ? '…' : ''}</p>
        </div>
      )}

      {/* Join button for open debates */}
      {debate.status === 'OPEN' && !isCreator && address && (
        <button disabled={loading} onClick={e => { e.stopPropagation(); onJoin() }}
          style={{ width: '100%', background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
          ⚔️ Accept Debate — Stake {debate.stake} pts
        </button>
      )}

      {/* Click hint */}
      {debate.status !== 'OPEN' && (
        <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>Click to view details →</p>
      )}
    </div>
  )
}

// ─── DEBATE DETAIL MODAL ──────────────────────────────────────────────────────
function DebateDetailModal({ debate: initialDebate, address, player, onClose, onAction, fetchDetail, loading }: {
  debate: Debate; address: string; player: Player | null
  onClose: () => void; onAction: (m: string, a: unknown[]) => Promise<boolean>
  fetchDetail: (id: string) => Promise<Debate | null>; loading: boolean
}) {
  const [debate, setDebate] = useState(initialDebate)
  const [argument, setArgument] = useState('')
  const [showAppeal, setShowAppeal] = useState(false)
  const [appealGrounds, setAppealGrounds] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    setLoadingDetail(true)
    fetchDetail(initialDebate.debate_id).then(d => {
      if (d) setDebate(d)
      setLoadingDetail(false)
    })
  }, [initialDebate.debate_id])

  const isCreator = debate.creator === address
  const isOpponent = debate.opponent === address
  const isParty = isCreator || isOpponent
  const isWinner = debate.winner === address
  const isDraw = debate.winner === 'DRAW'
  const hasMyArgument = isCreator ? !!debate.creator_argument : !!debate.opponent_argument
  const bothSubmitted = !!debate.creator_argument && !!debate.opponent_argument

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ backgroundColor: '#0C0C0E', border: `1px solid ${BORDER}`, borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: MUTED, backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '2px 7px' }}>{debate.category}</span>
              <span style={{ fontSize: '10px', color: GOLD, backgroundColor: '#27272A', border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>⚡ {debate.stake} pts each · Winner gets {parseInt(debate.stake) * 2} pts</span>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.3 }}>{debate.topic}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MUTED, fontSize: '22px', cursor: 'pointer', flexShrink: 0, marginLeft: '10px' }}>✕</button>
        </div>

        {/* Players */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[{ label: 'Creator', addr: debate.creator, arg: debate.creator_argument, score: debate.creator_score, breakdown: debate.creator_score_breakdown },
            { label: 'Opponent', addr: debate.opponent, arg: debate.opponent_argument, score: debate.opponent_score, breakdown: debate.opponent_score_breakdown }].map((p, i) => (
            <div key={i} style={{ backgroundColor: CARD, border: `1px solid ${debate.winner === p.addr ? PURPLE + '66' : BORDER}`, borderRadius: '10px', padding: '12px' }}>
              <p style={{ fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{p.label}</p>
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: (i === 0 ? isCreator : isOpponent) ? PURPLE : TEXT }}>{shortAddr(p.addr)}{(i === 0 ? isCreator : isOpponent) ? ' (you)' : ''}</p>
              {p.score && <p style={{ fontSize: '20px', fontWeight: 800, color: PURPLE, marginTop: '6px' }}>{p.score}<span style={{ fontSize: '12px', color: MUTED }}>/100</span></p>}
              {p.arg && isParty && <p style={{ fontSize: '11px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>{p.arg.slice(0, 100)}{p.arg.length > 100 ? '…' : ''}</p>}
              {!p.arg && debate.status === 'ACTIVE' && <p style={{ fontSize: '11px', color: WARNING, marginTop: '6px' }}>⏳ Waiting for argument…</p>}
              {!p.arg && debate.status !== 'ACTIVE' && p.addr !== '0x0000000000000000000000000000000000000000' && <p style={{ fontSize: '11px', color: MUTED, marginTop: '6px' }}>No argument yet</p>}
              {debate.winner === p.addr && <p style={{ fontSize: '11px', color: SUCCESS, fontWeight: 600, marginTop: '6px' }}>🏆 Winner</p>}
              {isDraw && p.addr !== '0x0000000000000000000000000000000000000000' && <p style={{ fontSize: '11px', color: WARNING, fontWeight: 600, marginTop: '6px' }}>🤝 Draw</p>}
            </div>
          ))}
        </div>

        {/* AI Verdict */}
        {debate.reasoning && (
          <div style={{ backgroundColor: '#0a0514', border: `1px solid ${PURPLE}44`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', color: PURPLE, fontWeight: 600, marginBottom: '8px' }}>🤖 AI Validator Verdict</p>
            <p style={{ fontSize: '13px', color: TEXT, lineHeight: 1.6, marginBottom: '12px' }}>{debate.reasoning}</p>
            {debate.creator_score_breakdown && isParty && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: '11px', color: MUTED, fontWeight: 500 }}>Score Breakdown:</p>
                <p style={{ fontSize: '11px', color: MUTED }}>Creator: {debate.creator_score_breakdown}</p>
                <p style={{ fontSize: '11px', color: MUTED }}>Opponent: {debate.opponent_score_breakdown}</p>
              </div>
            )}
            {debate.appeal_reasoning && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: '11px', color: WARNING, fontWeight: 600, marginBottom: '4px' }}>Appeal Decision: {debate.appeal_verdict}</p>
                <p style={{ fontSize: '11px', color: MUTED }}>{debate.appeal_reasoning}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Join debate */}
          {debate.status === 'OPEN' && !isCreator && (
            <button disabled={loading} onClick={() => { onAction('join_debate', [debate.debate_id]); onClose() }}
              style={{ background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
              ⚔️ Accept Debate — Stake {debate.stake} pts
            </button>
          )}

          {/* Submit argument */}
          {debate.status === 'ACTIVE' && isParty && !hasMyArgument && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ backgroundColor: '#0a0514', border: `1px solid ${PURPLE}33`, borderRadius: '8px', padding: '10px', fontSize: '12px', color: PURPLE }}>
                ⚡ Submit your argument. When both players submit, AI validators judge automatically (1–3 min).
              </div>
              <textarea value={argument} onChange={e => setArgument(e.target.value)}
                placeholder="Make your strongest argument. Be logical, use evidence, and be persuasive. The AI judges on logic (35pts), evidence (25pts), persuasiveness (25pts), and clarity (15pts)."
                style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }} />
              <button disabled={loading || argument.trim().length < 20} onClick={() => { onAction('submit_argument', [debate.debate_id, argument]); onClose() }}
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: argument.trim().length >= 20 ? 'pointer' : 'not-allowed', opacity: argument.trim().length >= 20 ? 1 : 0.5 }}>
                ⚔️ Submit Argument (AI Judges Automatically)
              </button>
              <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>Minimum 20 characters · {argument.length} characters typed</p>
            </div>
          )}

          {/* Already submitted */}
          {debate.status === 'ACTIVE' && isParty && hasMyArgument && (
            <div style={{ backgroundColor: '#051a0a', border: `1px solid ${SUCCESS}33`, borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: SUCCESS, fontWeight: 600 }}>✓ Argument submitted — waiting for opponent</p>
            </div>
          )}

          {/* Claim winnings */}
          {debate.status === 'FINISHED' && isWinner && !isDraw && debate.claimed !== 'true' && (
            <button disabled={loading} onClick={() => { onAction('claim_winnings', [debate.debate_id]); onClose() }}
              style={{ background: `linear-gradient(135deg, #F59E0B, #D97706)`, color: '#000', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
              🏆 Claim {parseInt(debate.stake) * 2} Points
            </button>
          )}

          {/* Cancel debate */}
          {debate.status === 'OPEN' && isCreator && (
            <button disabled={loading} onClick={() => { onAction('cancel_debate', [debate.debate_id]); onClose() }}
              style={{ backgroundColor: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}>
              Cancel Debate (refunds stake)
            </button>
          )}

          {/* Appeal */}
          {debate.status === 'FINISHED' && isParty && !isWinner && !isDraw && !debate.appeal_grounds && (
            <div>
              {!showAppeal ? (
                <button onClick={() => setShowAppeal(true)}
                  style={{ width: '100%', backgroundColor: 'transparent', color: WARNING, border: `1px solid ${WARNING}44`, borderRadius: '10px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}>
                  Appeal Verdict (costs {APPEAL_COST} points)
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#14100a', border: `1px solid ${WARNING}33`, borderRadius: '10px', padding: '12px' }}>
                  <p style={{ fontSize: '12px', color: WARNING }}>Explain why the verdict was wrong (strict standard — clear error only):</p>
                  <textarea value={appealGrounds} onChange={e => setAppealGrounds(e.target.value)}
                    placeholder="What specific error did the AI make? Provide clear evidence." style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button disabled={loading || !appealGrounds.trim()} onClick={() => { onAction('appeal_verdict', [debate.debate_id, appealGrounds]); setShowAppeal(false); onClose() }}
                      style={{ flex: 1, backgroundColor: WARNING, color: '#000', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: appealGrounds.trim() ? 1 : 0.5 }}>
                      Submit Appeal
                    </button>
                    <button onClick={() => setShowAppeal(false)} style={{ backgroundColor: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {loadingDetail && (
          <p style={{ textAlign: 'center', color: MUTED, fontSize: '12px', marginTop: '10px' }}>Loading debate details…</p>
        )}
      </div>
    </div>
  )
}

// ─── CREATE DEBATE MODAL ──────────────────────────────────────────────────────
function CreateDebateModal({ player, onClose, onSubmit, loading }: {
  player: Player; onClose: () => void; onSubmit: (topic: string, stake: string, category: string) => void; loading: boolean
}) {
  const [topic, setTopic] = useState('')
  const [stake, setStake] = useState('10')
  const [category, setCategory] = useState('General')
  const canSubmit = topic.trim().length >= 10 && parseInt(stake) >= MIN_STAKE && parseInt(stake) <= Math.min(MAX_STAKE, parseInt(player.points))

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ backgroundColor: '#0C0C0E', border: `1px solid ${BORDER}`, borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>⚔️ Create Debate</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MUTED, fontSize: '22px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ backgroundColor: '#0a0514', border: `1px solid ${PURPLE}33`, borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: PURPLE, marginBottom: '18px', lineHeight: 1.5 }}>
          ℹ️ AI validators will validate your topic first, then judge the debate after both players submit arguments.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '5px' }}>Debate Topic * <span style={{ color: PURPLE }}>(must be clearly arguable)</span></label>
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Remote work is more productive than office work" style={inputStyle} />
            <p style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>{topic.length} characters · minimum 10</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '5px' }}>Stake (pts) * <span style={{ color: GOLD }}>You have {player.points}</span></label>
              <input type="number" min={MIN_STAKE} max={Math.min(MAX_STAKE, parseInt(player.points))} value={stake} onChange={e => setStake(e.target.value)} style={inputStyle} />
              <p style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>Winner gets {parseInt(stake || '0') * 2} pts total</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '5px' }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button disabled={loading || !canSubmit} onClick={() => onSubmit(topic, stake, category)}
            style={{ background: canSubmit ? `linear-gradient(135deg, ${PURPLE}, #A855F7)` : '#27272A', color: canSubmit ? '#fff' : MUTED, border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            ⚔️ Create Debate
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── REGISTER MODAL ───────────────────────────────────────────────────────────
function RegisterModal({ onClose, onSubmit, loading }: {
  onClose: () => void; onSubmit: (username: string) => void; loading: boolean
}) {
  const [username, setUsername] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.88)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: '#0C0C0E', border: `1px solid ${PURPLE}44`, borderRadius: '20px', padding: '32px 28px', width: '100%', maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚔️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Join DeBattle</h2>
          <p style={{ color: MUTED, fontSize: '14px', lineHeight: 1.6 }}>
            Register to get <strong style={{ color: GOLD }}>{STARTING_POINTS} free points</strong> and start competing in on-chain debates.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: MUTED, marginBottom: '5px' }}>Choose a Username (optional, max 20 chars)</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. DebateMaster, LogicKing…" maxLength={20} style={inputStyle} />
          </div>
          <button disabled={loading} onClick={() => onSubmit(username)}
            style={{ background: `linear-gradient(135deg, ${PURPLE}, #A855F7)`, color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
            🚀 Register & Get {STARTING_POINTS} Points
          </button>
          <p style={{ fontSize: '11px', color: MUTED, textAlign: 'center' }}>This signs a transaction on GenLayer Bradbury Testnet</p>
        </div>
      </div>
    </div>
  )
}
