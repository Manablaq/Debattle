'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWalletClient } from 'wagmi'
import { readContract } from '@/lib/genlayer'
import { CONTRACT_ADDRESS, STARTING_POINTS, MIN_STAKE, MAX_STAKE, APPEAL_COST } from '@/lib/config'

interface Player {
  address: string; username: string; points: string; wins: string; losses: string
  draws: string; win_streak: string; best_streak: string; total_debates: string
  points_earned: string; points_lost: string; registered: string
}
interface Debate {
  debate_id: string; creator: string; opponent: string; topic: string; stake: string
  status: string; creator_argument: string; opponent_argument: string
  creator_score: string; opponent_score: string; winner: string; reasoning: string
  creator_score_breakdown: string; opponent_score_breakdown: string
  appeal_grounds: string; appeal_verdict: string; appeal_reasoning: string
  claimed: string; created_at: string; category: string
}
interface Notif { id: string; type: 'success'|'error'|'info'|'warning'; title: string; message: string; timestamp: number; read: boolean }
type Tab = 'arena'|'battles'|'rankings'|'profile'
const CATS = ['General','Technology','Politics','Philosophy','Science','Sports','Entertainment','Economics']
const ZERO = '0x0000000000000000000000000000000000000000'
const sa = (a: string) => !a||a===ZERO ? '-' : `${a.slice(0,6)}...${a.slice(-4)}`
const ago = (ts: number) => { const s=Math.floor((Date.now()-ts)/1000); return s<60?`${s}s`:s<3600?`${Math.floor(s/60)}m`:`${Math.floor(s/3600)}h` }

// LIQUID GLASS DESIGN SYSTEM
const G = {
  bg: '#08080F',
  bgGrad: 'radial-gradient(ellipse at 20% 20%, #0D0A1E 0%, #08080F 40%, #0A0D12 100%)',
  // Glass layers
  glass0: 'rgba(255,255,255,0.03)',
  glass1: 'rgba(255,255,255,0.06)',
  glass2: 'rgba(255,255,255,0.09)',
  glass3: 'rgba(255,255,255,0.13)',
  glassHover: 'rgba(255,255,255,0.10)',
  // Borders
  border0: 'rgba(255,255,255,0.06)',
  border1: 'rgba(255,255,255,0.10)',
  border2: 'rgba(255,255,255,0.18)',
  // Iridescent accent colors
  violet: '#7C5CFC',
  teal: '#2DD4BF',
  pink: '#F472B6',
  blue: '#60A5FA',
  // Text
  text: '#F0EFFF',
  textSub: 'rgba(240,239,255,0.55)',
  textDim: 'rgba(240,239,255,0.28)',
  // Status
  green: '#4ADE80',
  red: '#F87171',
  amber: '#FBBF24',
  purple: '#C084FC',
  // Glow
  glowV: 'rgba(124,92,252,0.4)',
  glowT: 'rgba(45,212,191,0.4)',
  glowP: 'rgba(244,114,182,0.3)',
  glowB: 'rgba(96,165,250,0.3)',
}

const STATUS: Record<string,{label:string;color:string;glow:string}> = {
  OPEN:      {label:'Open',      color:G.green,  glow:'rgba(74,222,128,0.4)'},
  ACTIVE:    {label:'Active',    color:G.blue,   glow:'rgba(96,165,250,0.4)'},
  JUDGING:   {label:'Judging',   color:G.amber,  glow:'rgba(251,191,36,0.4)'},
  FINISHED:  {label:'Verdict',   color:G.purple, glow:'rgba(192,132,252,0.4)'},
  CLAIMED:   {label:'Done',      color:G.textDim,glow:'transparent'},
  FINAL:     {label:'Final',     color:G.textDim,glow:'transparent'},
  CANCELLED: {label:'Void',      color:G.red,    glow:'rgba(248,113,113,0.4)'},
}

// LIQUID GLASS CSS
const STYLES = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{color-scheme:dark}
  body{background:#08080F;overflow-x:hidden}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}
  input,textarea,select{color-scheme:dark;outline:none}
  input::placeholder,textarea::placeholder{color:rgba(240,239,255,0.25)}
  select option{background:#1A1525}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes scaleIn{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-6px)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes iridescent{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(124,92,252,0.3)}50%{box-shadow:0 0 40px rgba(124,92,252,0.6),0 0 80px rgba(124,92,252,0.2)}}
  @keyframes slideNotif{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
  .lg-card{
    background:rgba(255,255,255,0.06);
    backdrop-filter:blur(24px) saturate(180%);
    -webkit-backdrop-filter:blur(24px) saturate(180%);
    border:1px solid rgba(255,255,255,0.10);
    border-radius:20px;
    position:relative;
    overflow:hidden;
    transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  }
  .lg-card::before{
    content:'';position:absolute;inset:0;border-radius:20px;
    background:linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%,rgba(255,255,255,0.02) 100%);
    pointer-events:none;
  }
  .lg-card::after{
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);
    pointer-events:none;
  }
  .lg-card:hover{
    background:rgba(255,255,255,0.09);
    border-color:rgba(255,255,255,0.16);
    transform:translateY(-2px);
    box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.08);
  }
  .lg-card-glow:hover{
    box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 30px rgba(124,92,252,0.2),0 0 0 1px rgba(124,92,252,0.2);
    border-color:rgba(124,92,252,0.3)!important;
  }
  .lg-btn-primary{
    background:linear-gradient(135deg,#7C5CFC,#5B3FE4);
    border:none;border-radius:14px;color:#fff;font-weight:700;cursor:pointer;
    font-family:inherit;letter-spacing:-0.01em;
    box-shadow:0 4px 20px rgba(124,92,252,0.4),inset 0 1px 0 rgba(255,255,255,0.2);
    transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1);
    position:relative;overflow:hidden;
  }
  .lg-btn-primary::before{
    content:'';position:absolute;inset:0;
    background:linear-gradient(135deg,rgba(255,255,255,0.15),transparent);
    border-radius:14px;pointer-events:none;
  }
  .lg-btn-primary:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 8px 32px rgba(124,92,252,0.6),inset 0 1px 0 rgba(255,255,255,0.25)}
  .lg-btn-primary:active{transform:translateY(0) scale(0.98)}
  .lg-btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}
  .lg-btn-secondary{
    background:rgba(255,255,255,0.07);
    border:1px solid rgba(255,255,255,0.12);border-radius:12px;
    color:rgba(240,239,255,0.8);font-weight:500;cursor:pointer;
    font-family:inherit;backdrop-filter:blur(8px);
    transition:all 0.2s ease;
  }
  .lg-btn-secondary:hover{background:rgba(255,255,255,0.11);border-color:rgba(255,255,255,0.2);transform:translateY(-1px)}
  .lg-btn-ghost{background:transparent;border:none;color:rgba(240,239,255,0.5);cursor:pointer;font-family:inherit;transition:color 0.15s}
  .lg-btn-ghost:hover{color:rgba(240,239,255,0.9)}
  .lg-btn-success{
    background:linear-gradient(135deg,#22C55E,#16A34A);border:none;border-radius:14px;
    color:#fff;font-weight:800;cursor:pointer;font-family:inherit;
    box-shadow:0 4px 20px rgba(34,197,94,0.4),inset 0 1px 0 rgba(255,255,255,0.2);
    transition:all 0.2s ease;
  }
  .lg-btn-success:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(34,197,94,0.5)}
  .lg-btn-success:disabled{opacity:0.4;cursor:not-allowed;transform:none}
  .lg-input{
    width:100%;background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.10);border-radius:12px;
    padding:12px 16px;color:#F0EFFF;font-size:14px;
    font-family:inherit;backdrop-filter:blur(8px);
    transition:all 0.2s ease;box-sizing:border-box;
  }
  .lg-input:focus{
    background:rgba(255,255,255,0.08);
    border-color:rgba(124,92,252,0.5);
    box-shadow:0 0 0 3px rgba(124,92,252,0.12),0 0 20px rgba(124,92,252,0.1);
  }
  .lg-pill{
    display:inline-flex;align-items:center;gap:5px;
    border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;
    backdrop-filter:blur(8px);border:1px solid;letter-spacing:0.02em;
    white-space:nowrap;
  }
  .orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0;filter:blur(80px);opacity:0.35}
  .tab-active{
    background:rgba(124,92,252,0.15)!important;
    color:#C4B5FD!important;
    border-bottom:2px solid #7C5CFC!important;
  }
  @media(max-width:768px){.hide-mobile{display:none!important}.show-mobile{display:flex!important}}
  @media(min-width:769px){.show-mobile{display:none!important}}
`

// Liquid glass card wrapper
function Card({children,style,className='',onClick,glow=false}:{
  children:React.ReactNode;style?:React.CSSProperties;className?:string;onClick?:()=>void;glow?:boolean
}) {
  return (
    <div onClick={onClick} className={`lg-card${glow?' lg-card-glow':''} ${className}`}
      style={{cursor:onClick?'pointer':'default',...style}}>
      {children}
    </div>
  )
}

// Iridescent gradient card (for hero/special sections)
function IriCard({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return (
    <div style={{
      position:'relative',borderRadius:'24px',overflow:'hidden',
      background:'linear-gradient(135deg,rgba(124,92,252,0.15) 0%,rgba(45,212,191,0.10) 30%,rgba(244,114,182,0.10) 60%,rgba(96,165,250,0.12) 100%)',
      border:'1px solid rgba(255,255,255,0.12)',
      backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)',
      boxShadow:'0 32px 80px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.1)',
      ...style
    }}>
      {/* Top shine */}
      <div style={{position:'absolute',top:0,left:'5%',right:'5%',height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)',pointerEvents:'none'}}/>
      {/* Corner glow */}
      <div style={{position:'absolute',top:'-40px',right:'-40px',width:'200px',height:'200px',borderRadius:'50%',background:'radial-gradient(circle,rgba(124,92,252,0.3),transparent 70%)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:'-30px',left:'20%',width:'150px',height:'150px',borderRadius:'50%',background:'radial-gradient(circle,rgba(45,212,191,0.2),transparent 70%)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:1}}>{children}</div>
    </div>
  )
}

// Status pill with glow dot
function SPill({status}:{status:string}) {
  const s=STATUS[status]??{label:status,color:G.textDim,glow:'transparent'}
  const live=['OPEN','ACTIVE','JUDGING'].includes(status)
  return (
    <span className="lg-pill" style={{color:s.color,backgroundColor:`${s.color}15`,borderColor:`${s.color}30`}}>
      <span style={{width:'5px',height:'5px',borderRadius:'50%',backgroundColor:s.color,flexShrink:0,
        animation:live?'pulse 1.5s ease-in-out infinite':'none',
        boxShadow:live?`0 0 6px ${s.color}`:''}}/>
      {s.label}
    </span>
  )
}

// Live clock
function Clock() {
  const [t,setT]=useState('')
  useEffect(()=>{const tick=()=>setT(new Date().toLocaleTimeString());tick();const i=setInterval(tick,1000);return()=>clearInterval(i)},[])
  return <span style={{fontFamily:'monospace',fontSize:'11px',color:G.textDim,letterSpacing:'0.05em'}}>{t}</span>
}

export default function Home() {
  const {address}=useAccount()
  const {data:walletClient}=useWalletClient()
  const [tab,setTab]=useState<Tab>('arena')
  const [debates,setDebates]=useState<Debate[]>([])
  const [player,setPlayer]=useState<Player|null>(null)
  const [leaderboard,setLeaderboard]=useState<Player[]>([])
  const [stats,setStats]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState(false)
  const [refreshing,setRefreshing]=useState(false)
  const [showCreate,setShowCreate]=useState(false)
  const [showRegister,setShowRegister]=useState(false)
  const [activeDebate,setActiveDebate]=useState<Debate|null>(null)
  const [catFilter,setCatFilter]=useState('ALL')
  const [notifs,setNotifs]=useState<Notif[]>([])
  const [showNotifs,setShowNotifs]=useState(false)
  const notifRef=useRef<HTMLDivElement>(null)
  const unread=notifs.filter(n=>!n.read).length

  const addNotif=useCallback((type:Notif['type'],title:string,message:string)=>{
    const n:Notif={id:Date.now().toString(),type,title,message,timestamp:Date.now(),read:false}
    setNotifs(prev=>[n,...prev].slice(0,20))
  },[])

  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(notifRef.current&&!notifRef.current.contains(e.target as Node))setShowNotifs(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)
  },[])

  const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms))

  const fetchAll=useCallback(async()=>{
    setRefreshing(true)
    try{
      const dr=await readContract('get_all_debates')
      try{setDebates(JSON.parse(dr as string))}catch{}
      await delay(700)
      const sr=await readContract('get_platform_stats')
      try{setStats(JSON.parse(sr as string))}catch{}
      await delay(700)
      const lr=await readContract('get_leaderboard')
      try{setLeaderboard(JSON.parse(lr as string))}catch{}
    }catch{addNotif('error','Connection Error','Could not reach GenLayer')}
    finally{setRefreshing(false)}
  },[addNotif])

  const fetchPlayer=useCallback(async(a:string)=>{
    try{setPlayer(JSON.parse(await readContract('get_player',[a]) as string))}catch{}
  },[])

  const fetchDetail=useCallback(async(id:string,viewer:string):Promise<Debate|null>=>{
    try{return JSON.parse(await readContract('get_debate_for_participant',[id,viewer]) as string)}catch{return null}
  },[])

  useEffect(()=>{fetchAll()},[fetchAll])
  useEffect(()=>{if(address){fetchPlayer(address);addNotif('info','Wallet Connected',sa(address))}},[address,fetchPlayer,addNotif])

  async function callWrite(method:string,args:unknown[]) {
    if(!address){addNotif('error','Not Connected','Connect your wallet first');return false}
    if(!player||player.registered!=='true'){setShowRegister(true);return false}
    setLoading(true)
    addNotif('info','Tx Sent',method==='submit_argument'?'AI validators deliberating - 1-3 min':`Processing ${method}...`)
    try{
      const {writeContractWithWallet}=await import('@/lib/genlayer')
      const r=await writeContractWithWallet(address,walletClient,method,args)
      setLoading(false)
      if(r.success){addNotif('success','Confirmed',`${method} on-chain`);await fetchAll();if(address)await fetchPlayer(address);return true}
      addNotif('error','Failed',r.error??'Unknown error');return false
    }catch(e:any){setLoading(false);addNotif('error','Error',e?.message??String(e));return false}
  }

  async function callWriteNoCheck(method:string,args:unknown[]) {
    if(!address){addNotif('error','Not Connected','Connect your wallet first');return false}
    setLoading(true)
    try{
      const {writeContractWithWallet}=await import('@/lib/genlayer')
      const r=await writeContractWithWallet(address,walletClient,method,args)
      setLoading(false)
      if(r.success){addNotif('success','Done',`${method} confirmed`);await fetchAll();if(address)await fetchPlayer(address);return true}
      addNotif('error','Failed',r.error??'Unknown error');return false
    }catch(e:any){setLoading(false);addNotif('error','Error',e?.message??String(e));return false}
  }

  const openDebates=debates.filter(d=>d.status==='OPEN'&&(catFilter==='ALL'||d.category===catFilter))
  const myDebates=debates.filter(d=>d.creator===address||d.opponent===address)

  const notifColor=(type:string)=>type==='success'?G.green:type==='error'?G.red:type==='warning'?G.amber:G.violet
  const notifIcon=(type:string)=>type==='success'?'✓':type==='error'?'!':type==='warning'?'?':'i'

  return (
    <div style={{minHeight:'100vh',background:G.bgGrad,color:G.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Inter","SF Pro Display",sans-serif',fontSize:'14px',overflowX:'hidden'}}>
      <style>{STYLES}</style>

      {/* Ambient orbs */}
      <div className="orb" style={{width:'600px',height:'600px',top:'-200px',left:'-150px',background:'radial-gradient(circle,rgba(124,92,252,0.5),rgba(91,63,228,0.2),transparent 70%)'}}/>
      <div className="orb" style={{width:'500px',height:'500px',top:'30%',right:'-100px',background:'radial-gradient(circle,rgba(45,212,191,0.4),rgba(20,184,166,0.1),transparent 70%)'}}/>
      <div className="orb" style={{width:'400px',height:'400px',bottom:'10%',left:'25%',background:'radial-gradient(circle,rgba(244,114,182,0.3),rgba(236,72,153,0.1),transparent 70%)'}}/>

      {/* HEADER */}
      <header style={{position:'sticky',top:0,zIndex:100,backdropFilter:'blur(32px) saturate(180%)',WebkitBackdropFilter:'blur(32px) saturate(180%)',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(8,8,15,0.75)'}}>
        {/* Status bar */}
        <div style={{borderBottom:'1px solid rgba(255,255,255,0.05)',padding:'5px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',gap:'16px',fontSize:'10px',fontFamily:'monospace',letterSpacing:'0.06em'}}>
            <span style={{display:'flex',alignItems:'center',gap:'5px',color:G.green}}>
              <span style={{width:'5px',height:'5px',borderRadius:'50%',backgroundColor:G.green,animation:'pulse 2s ease-in-out infinite',boxShadow:`0 0 6px ${G.green}`}}/>
              LIVE
            </span>
            <span style={{color:G.textDim}}>BRADBURY</span>
            <span style={{color:G.textDim}}>5 VALIDATORS</span>
          </div>
          <Clock/>
        </div>

        <div style={{maxWidth:'1180px',margin:'0 auto',padding:'0 16px',height:'56px',display:'flex',alignItems:'center',gap:'8px'}}>
          {/* Logo */}
          <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0,marginRight:'12px'}}>
            <div style={{width:'36px',height:'36px',borderRadius:'11px',background:'linear-gradient(135deg,#7C5CFC,#2DD4BF)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'17px',boxShadow:'0 4px 16px rgba(124,92,252,0.5),inset 0 1px 0 rgba(255,255,255,0.2)'}}>⚔</div>
            <div>
              <div style={{fontWeight:800,fontSize:'16px',letterSpacing:'-0.03em',background:'linear-gradient(135deg,#F0EFFF,rgba(240,239,255,0.6))',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>DeBattle</div>
              <div style={{fontSize:'8px',color:G.textDim,letterSpacing:'0.12em',textTransform:'uppercase'}}>On-Chain Arena</div>
            </div>
          </div>

          {/* Desktop tabs */}
          <nav className="hide-mobile" style={{display:'flex',gap:'4px',flex:1}}>
            {(['arena','battles','rankings','profile'] as Tab[]).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`lg-btn-ghost tab-btn ${tab===t?'tab-active':''}`}
                style={{padding:'8px 16px',borderRadius:'10px',fontSize:'13px',fontWeight:tab===t?600:400,borderBottom:'2px solid transparent',textTransform:'capitalize',letterSpacing:'-0.01em',transition:'all 0.2s'}}>
                {t==='arena'?'Arena':t==='battles'?'My Battles':t==='rankings'?'Rankings':'Profile'}
              </button>
            ))}
          </nav>

          <div style={{flex:1,minWidth:0}} className="show-mobile"/>

          <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
            {player?.registered==='true'&&(
              <div style={{display:'flex',alignItems:'center',gap:'5px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:'20px',padding:'5px 12px',backdropFilter:'blur(8px)'}}>
                <span style={{fontSize:'13px'}}>⚡</span>
                <span style={{fontSize:'13px',fontWeight:700,color:G.amber}}>{player.points}</span>
                <span style={{fontSize:'10px',color:G.textDim,textTransform:'uppercase',letterSpacing:'0.04em'}}>pts</span>
              </div>
            )}

            {/* Notif bell */}
            <div ref={notifRef} style={{position:'relative'}}>
              <button onClick={()=>{setShowNotifs(!showNotifs);if(!showNotifs)setNotifs(p=>p.map(n=>({...n,read:true})))}}
                className="lg-btn-secondary" style={{width:'38px',height:'38px',borderRadius:'11px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',position:'relative'}}>
                🔔
                {unread>0&&<span style={{position:'absolute',top:'-5px',right:'-5px',width:'18px',height:'18px',borderRadius:'50%',backgroundColor:G.red,color:'#fff',fontSize:'10px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${G.bg}`,boxShadow:`0 0 8px ${G.red}`}}>{unread>9?'9+':unread}</span>}
              </button>

              {showNotifs&&(
                <div style={{position:'absolute',top:'calc(100% + 10px)',right:0,width:'320px',background:'rgba(12,10,22,0.95)',backdropFilter:'blur(32px)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'18px',boxShadow:'0 32px 80px rgba(0,0,0,0.7)',zIndex:200,animation:'slideNotif 0.2s ease',overflow:'hidden',maxHeight:'440px',display:'flex',flexDirection:'column'}}>
                  <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontWeight:700,fontSize:'14px',color:G.text}}>Notifications</span>
                    <div style={{display:'flex',gap:'10px'}}>
                      <button onClick={()=>setNotifs(p=>p.map(n=>({...n,read:true})))} className="lg-btn-ghost" style={{fontSize:'11px',color:G.violet}}>Mark read</button>
                      <button onClick={()=>setNotifs([])} className="lg-btn-ghost" style={{fontSize:'11px',color:G.textDim}}>Clear</button>
                    </div>
                  </div>
                  <div style={{overflowY:'auto',flex:1}}>
                    {notifs.length===0?<div style={{padding:'32px',textAlign:'center',color:G.textDim,fontSize:'13px'}}>No notifications</div>
                      :notifs.map(n=>(
                        <div key={n.id} style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)',background:n.read?'transparent':'rgba(124,92,252,0.06)',display:'flex',gap:'10px',alignItems:'flex-start'}}>
                          <div style={{width:'28px',height:'28px',borderRadius:'8px',background:`${notifColor(n.type)}15`,border:`1px solid ${notifColor(n.type)}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:800,color:notifColor(n.type),flexShrink:0}}>{notifIcon(n.type)}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:'13px',color:G.text,marginBottom:'2px'}}>{n.title}</div>
                            <div style={{fontSize:'11px',color:G.textSub,lineHeight:1.4}}>{n.message}</div>
                            <div style={{fontSize:'10px',color:G.textDim,marginTop:'3px'}}>{ago(n.timestamp)} ago</div>
                          </div>
                          {!n.read&&<div style={{width:'7px',height:'7px',borderRadius:'50%',backgroundColor:G.violet,marginTop:'4px',flexShrink:0,boxShadow:`0 0 6px ${G.violet}`}}/>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar"/>
          </div>
        </div>
      </header>

      {/* MODALS */}
      {showCreate&&player&&<CreateModal player={player} onClose={()=>setShowCreate(false)} onSubmit={(t,s,c)=>{callWrite('create_debate',[t,s,c]);setShowCreate(false)}} loading={loading}/>}
      {showRegister&&<RegisterModal onClose={()=>setShowRegister(false)} onSubmit={u=>{callWriteNoCheck('register',[u]);setShowRegister(false)}} loading={loading}/>}
      {activeDebate&&address&&<BattleModal debate={activeDebate} address={address} player={player} onClose={()=>setActiveDebate(null)} onAction={callWrite} fetchDetail={id=>fetchDetail(id,address)} loading={loading}/>}

      <main style={{maxWidth:'1180px',margin:'0 auto',padding:'0 16px 120px',position:'relative',zIndex:1}}>

        {/* ARENA TAB */}
        {tab==='arena'&&(
          <div style={{animation:'fadeUp 0.4s ease'}}>
            {/* HERO */}
            <IriCard style={{margin:'20px 0 28px',padding:'clamp(28px,5vw,56px)'}}>
              <div style={{display:'flex',gap:'24px',alignItems:'center',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:'260px'}}>
                  <div style={{display:'inline-flex',alignItems:'center',gap:'7px',background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'20px',padding:'5px 13px',marginBottom:'20px',backdropFilter:'blur(8px)'}}>
                    <span style={{width:'6px',height:'6px',borderRadius:'50%',backgroundColor:G.green,animation:'pulse 1.5s ease-in-out infinite',boxShadow:`0 0 8px ${G.green}`}}/>
                    <span style={{fontSize:'11px',fontWeight:600,color:G.green,letterSpacing:'0.05em',textTransform:'uppercase'}}>Live on GenLayer</span>
                  </div>
                  <h1 style={{fontSize:'clamp(30px,5vw,56px)',fontWeight:900,lineHeight:1.0,letterSpacing:'-0.04em',marginBottom:'14px'}}>
                    <span style={{display:'block',color:G.text}}>Debate anything.</span>
                    <span style={{display:'block',background:'linear-gradient(135deg,#7C5CFC,#2DD4BF,#F472B6)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',filter:'drop-shadow(0 0 30px rgba(124,92,252,0.5))'}}>Win on merit.</span>
                  </h1>
                  <p style={{color:G.textSub,fontSize:'clamp(14px,2vw,16px)',lineHeight:1.7,marginBottom:'24px',maxWidth:'400px'}}>
                    Stake points, argue your case, and let <strong style={{color:'#C4B5FD'}}>5 independent AI validators</strong> determine the winner. On-chain. Permanent.
                  </p>
                  <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                    <button className="lg-btn-primary" onClick={()=>player?.registered==='true'?setShowCreate(true):setShowRegister(true)}
                      style={{padding:'12px 24px',fontSize:'14px'}}>
                      + New Debate
                    </button>
                    {(!player||player.registered!=='true')&&(
                      <button className="lg-btn-secondary" onClick={()=>setShowRegister(true)} style={{padding:'12px 24px',fontSize:'14px'}}>
                        Join Free
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats panel */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1px',background:'rgba(255,255,255,0.06)',borderRadius:'16px',overflow:'hidden',flexShrink:0,backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)'}}>
                  {[
                    {l:'Debates',v:stats.total_debates??'0',c:G.violet},
                    {l:'Open',v:stats.open_debates??'0',c:G.green},
                    {l:'Players',v:stats.total_players??'0',c:G.teal},
                    {l:'Completed',v:stats.completed_debates??'0',c:G.textSub},
                  ].map(s=>(
                    <div key={s.l} style={{background:'rgba(8,8,15,0.6)',padding:'18px 22px',textAlign:'center'}}>
                      <div style={{fontSize:'26px',fontWeight:800,color:s.c,letterSpacing:'-0.03em',lineHeight:1}}>{s.v}</div>
                      <div style={{fontSize:'10px',color:G.textDim,marginTop:'4px',textTransform:'uppercase',letterSpacing:'0.08em'}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </IriCard>

            {/* HOW IT WORKS */}
            <div style={{marginBottom:'28px'}}>
              <div style={{fontSize:'11px',color:G.textDim,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:'14px'}}>Protocol</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'8px'}}>
                {[
                  {n:'01',icon:'📌',t:'Create',d:'Post topic + stake. AI validates.',c:'#7C5CFC'},
                  {n:'02',icon:'🤝',t:'Join',d:'Opponent matches your stake.',c:'#2DD4BF'},
                  {n:'03',icon:'✍',t:'Argue',d:'Both submit independently.',c:'#F472B6'},
                  {n:'04',icon:'🤖',t:'AI Judges',d:'5 validators reach consensus.',c:'#FBBF24'},
                  {n:'05',icon:'🏆',t:'Claim',d:'Winner takes both stakes.',c:'#4ADE80'},
                ].map((s,i)=>(
                  <Card key={i} style={{padding:'16px',background:`linear-gradient(135deg,${s.c}10,rgba(255,255,255,0.04))`,borderColor:`${s.c}20`}}>
                    <div style={{position:'absolute',top:'10px',right:'12px',fontSize:'10px',fontWeight:800,color:`${s.c}40`,letterSpacing:'0.04em'}}>{s.n}</div>
                    <div style={{fontSize:'20px',marginBottom:'8px'}}>{s.icon}</div>
                    <div style={{fontWeight:700,fontSize:'12px',color:G.text,marginBottom:'4px'}}>{s.t}</div>
                    <div style={{fontSize:'11px',color:G.textSub,lineHeight:1.5}}>{s.d}</div>
                    <div style={{position:'absolute',bottom:0,left:0,right:0,height:'2px',background:`linear-gradient(90deg,${s.c}80,transparent)`,borderRadius:'0 0 20px 20px'}}/>
                  </Card>
                ))}
              </div>
            </div>

            {/* OPEN DEBATES */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',flexWrap:'wrap',gap:'10px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontWeight:700,fontSize:'16px',color:G.text}}>Open Debates</span>
                <span style={{fontSize:'12px',color:G.textSub,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'20px',padding:'2px 10px'}}>{openDebates.length}</span>
              </div>
              <div style={{display:'flex',gap:'5px',alignItems:'center',flexWrap:'wrap'}}>
                {['ALL',...CATS].map(c=>(
                  <button key={c} onClick={()=>setCatFilter(c)}
                    style={{padding:'4px 10px',borderRadius:'8px',border:`1px solid ${catFilter===c?G.violet+'60':G.border0}`,background:catFilter===c?`${G.violet}15`:'transparent',color:catFilter===c?'#C4B5FD':G.textDim,fontSize:'11px',fontWeight:catFilter===c?600:400,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',transition:'all 0.15s'}}>
                    {c}
                  </button>
                ))}
                <button className="lg-btn-ghost" onClick={fetchAll} style={{padding:'4px 10px',fontSize:'11px',color:G.textDim}}>
                  {refreshing?'..':'↻'}
                </button>
              </div>
            </div>

            {openDebates.length===0?(
              <Card style={{padding:'56px 24px',textAlign:'center'}}>
                <div style={{fontSize:'48px',marginBottom:'14px',animation:'float 3s ease-in-out infinite'}}>⚔</div>
                <p style={{fontWeight:700,fontSize:'18px',marginBottom:'6px',background:'linear-gradient(135deg,#7C5CFC,#2DD4BF)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Arena is empty</p>
                <p style={{color:G.textSub,marginBottom:'20px',fontSize:'14px'}}>Be the first to issue a challenge</p>
                <button className="lg-btn-primary" onClick={()=>player?.registered==='true'?setShowCreate(true):setShowRegister(true)} style={{padding:'11px 22px',fontSize:'14px'}}>Create First Debate</button>
              </Card>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))',gap:'10px'}}>
                {openDebates.map(d=><DebateCard key={d.debate_id} debate={d} address={address} onJoin={()=>callWrite('join_debate',[d.debate_id])} onClick={()=>setActiveDebate(d)} loading={loading}/>)}
              </div>
            )}
          </div>
        )}

        {/* MY BATTLES */}
        {tab==='battles'&&(
          <div style={{paddingTop:'24px',animation:'fadeUp 0.4s ease'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
              <h2 style={{fontSize:'20px',fontWeight:700,letterSpacing:'-0.02em'}}>My Battles</h2>
              <button className="lg-btn-secondary" onClick={fetchAll} style={{padding:'7px 14px',fontSize:'12px'}}>{refreshing?'Loading...':'Refresh'}</button>
            </div>
            {!address?<EmptyState icon="🔌" title="Connect your wallet" sub="Your battle history lives here"/>
              :myDebates.length===0?<EmptyState icon="⚔" title="No battles yet" sub="Step into the arena">
                  <button className="lg-btn-primary" onClick={()=>setTab('arena')} style={{marginTop:'16px',padding:'10px 20px',fontSize:'13px'}}>Browse Arena</button>
                </EmptyState>
              :<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {myDebates.map(d=><DebateCard key={d.debate_id} debate={d} address={address} onJoin={()=>{}} onClick={()=>setActiveDebate(d)} loading={loading} detailed/>)}
              </div>}
          </div>
        )}

        {/* RANKINGS */}
        {tab==='rankings'&&(
          <div style={{paddingTop:'24px',animation:'fadeUp 0.4s ease'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
              <h2 style={{fontSize:'20px',fontWeight:700,letterSpacing:'-0.02em'}}>Rankings</h2>
              <button className="lg-btn-secondary" onClick={fetchAll} style={{padding:'7px 14px',fontSize:'12px'}}>{refreshing?'Loading...':'Refresh'}</button>
            </div>
            {leaderboard.length===0?<EmptyState icon="🏆" title="No players yet" sub="Be the first to register"/>
              :<Card style={{overflow:'hidden',padding:0}}>
                <div style={{display:'grid',gridTemplateColumns:'44px 1fr 52px 52px 62px 72px',padding:'10px 18px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.03)'}}>
                  {['#','Player','W','L','Pts','Streak'].map(h=>(
                    <div key={h} style={{fontSize:'10px',fontWeight:700,color:G.textDim,textTransform:'uppercase',letterSpacing:'0.08em',textAlign:h==='Player'?'left':'center'}}>{h}</div>
                  ))}
                </div>
                {leaderboard.map((p,i)=>{
                  const isMe=p.address===address
                  const mColors=['#FFD700','#C0C0C0','#CD7F32']
                  return(
                    <div key={p.address} style={{display:'grid',gridTemplateColumns:'44px 1fr 52px 52px 62px 72px',padding:'13px 18px',borderBottom:i<leaderboard.length-1?'1px solid rgba(255,255,255,0.05)':'none',background:isMe?'rgba(124,92,252,0.08)':'transparent',transition:'background 0.15s'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px'}}>{i<3?['🥇','🥈','🥉'][i]:<span style={{fontSize:'12px',fontWeight:600,color:G.textDim}}>{i+1}</span>}</div>
                      <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0}}>
                        <div style={{width:'32px',height:'32px',borderRadius:'50%',background:`linear-gradient(135deg,${G.violet}33,${G.teal}22)`,border:`1px solid ${G.violet}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#C4B5FD',flexShrink:0}}>
                          {p.username?p.username[0].toUpperCase():'?'}
                        </div>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:'13px',color:isMe?'#C4B5FD':G.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {p.username||sa(p.address)}{isMe?' (you)':''}
                          </div>
                          <div style={{fontSize:'10px',color:G.textDim,fontFamily:'monospace'}}>{sa(p.address)}</div>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:G.green,fontSize:'14px'}}>{p.wins}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:G.red,fontSize:'14px'}}>{p.losses}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:G.text,fontSize:'14px'}}>{p.points}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {parseInt(p.best_streak)>0
                          ?<span style={{fontSize:'11px',fontWeight:600,color:G.amber,background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:'20px',padding:'2px 8px'}}>{p.best_streak}🔥</span>
                          :<span style={{color:G.textDim,fontSize:'12px'}}>-</span>}
                      </div>
                    </div>
                  )
                })}
              </Card>}
          </div>
        )}

        {/* PROFILE */}
        {tab==='profile'&&(
          <div style={{paddingTop:'24px',animation:'fadeUp 0.4s ease'}}>
            <h2 style={{fontSize:'20px',fontWeight:700,letterSpacing:'-0.02em',marginBottom:'20px'}}>Profile</h2>
            {!address?<EmptyState icon="🔌" title="Connect your wallet" sub="Your stats live here"/>
              :!player||player.registered!=='true'?(
                <IriCard style={{padding:'56px 28px',textAlign:'center'}}>
                  <div style={{fontSize:'52px',marginBottom:'16px',animation:'float 3s ease-in-out infinite'}}>⚔</div>
                  <h3 style={{fontSize:'22px',fontWeight:800,marginBottom:'10px',color:G.text}}>You haven&apos;t entered yet</h3>
                  <p style={{color:G.textSub,marginBottom:'28px'}}>Register and receive <strong style={{color:G.amber}}>{STARTING_POINTS} free points</strong></p>
                  <button className="lg-btn-primary" onClick={()=>setShowRegister(true)} style={{padding:'13px 28px',fontSize:'15px'}}>
                    Register Free - {STARTING_POINTS} Points
                  </button>
                </IriCard>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  <IriCard style={{padding:'28px'}}>
                    <div style={{display:'flex',gap:'18px',alignItems:'flex-start',flexWrap:'wrap'}}>
                      <div style={{position:'relative'}}>
                        <div style={{position:'absolute',inset:'-3px',borderRadius:'50%',background:`conic-gradient(${G.violet},${G.teal},${G.pink},${G.violet})`,animation:'spin 4s linear infinite'}}/>
                        <div style={{position:'relative',width:'68px',height:'68px',borderRadius:'50%',background:'rgba(8,8,15,0.9)',border:'3px solid rgba(8,8,15,1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:900,color:'#C4B5FD'}}>
                          {player.username?player.username[0].toUpperCase():'?'}
                        </div>
                      </div>
                      <div style={{flex:1}}>
                        <h3 style={{fontSize:'22px',fontWeight:800,letterSpacing:'-0.02em',marginBottom:'4px'}}>{player.username||'Anonymous'}</h3>
                        <p style={{color:G.textDim,fontFamily:'monospace',fontSize:'11px',marginBottom:'12px',wordBreak:'break-all'}}>{address}</p>
                        <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
                          <span className="lg-pill" style={{color:G.amber,backgroundColor:'rgba(251,191,36,0.12)',borderColor:'rgba(251,191,36,0.3)'}}>⚡ {player.points} pts</span>
                          {parseInt(player.win_streak)>=2&&<span className="lg-pill" style={{color:'#FB923C',backgroundColor:'rgba(251,146,60,0.12)',borderColor:'rgba(251,146,60,0.3)'}}>🔥 {player.win_streak} streak</span>}
                          {parseInt(player.wins)>=5&&<span className="lg-pill" style={{color:G.amber,backgroundColor:'rgba(251,191,36,0.10)',borderColor:'rgba(251,191,36,0.25)'}}>⭐ Veteran</span>}
                        </div>
                      </div>
                    </div>
                  </IriCard>

                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                    {[{v:player.wins,l:'Wins',c:G.green,i:'✅'},{v:player.losses,l:'Losses',c:G.red,i:'❌'},{v:player.draws,l:'Draws',c:G.textSub,i:'🤝'}].map(s=>(
                      <Card key={s.l} style={{padding:'18px',textAlign:'center'}}>
                        <div style={{fontSize:'20px',marginBottom:'7px'}}>{s.i}</div>
                        <div style={{fontSize:'26px',fontWeight:800,color:s.c,letterSpacing:'-0.03em',lineHeight:1}}>{s.v}</div>
                        <div style={{fontSize:'10px',color:G.textDim,marginTop:'5px',textTransform:'uppercase',letterSpacing:'0.08em'}}>{s.l}</div>
                      </Card>
                    ))}
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'10px'}}>
                    {[{v:player.total_debates,l:'Battles',c:G.text,i:'⚔'},{v:player.best_streak,l:'Best Streak',c:G.amber,i:'🔥'},{v:player.points_earned,l:'Earned',c:G.green,i:'📈'},{v:player.points_lost,l:'Lost',c:G.red,i:'📉'}].map(s=>(
                      <Card key={s.l} style={{padding:'16px',textAlign:'center'}}>
                        <div style={{fontSize:'18px',marginBottom:'7px'}}>{s.i}</div>
                        <div style={{fontSize:'20px',fontWeight:800,color:s.c,letterSpacing:'-0.02em',lineHeight:1}}>{s.v}</div>
                        <div style={{fontSize:'10px',color:G.textDim,marginTop:'4px',textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.l}</div>
                      </Card>
                    ))}
                  </div>

                  {parseInt(player.total_debates)>0&&(
                    <Card style={{padding:'18px 20px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px'}}>
                        <span style={{fontSize:'13px',color:G.textSub}}>Win Rate</span>
                        <span style={{fontSize:'13px',fontWeight:700,color:'#C4B5FD'}}>{Math.round((parseInt(player.wins)/parseInt(player.total_debates))*100)}%</span>
                      </div>
                      <div style={{background:'rgba(255,255,255,0.06)',borderRadius:'6px',height:'8px',overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)'}}>
                        <div style={{width:`${Math.round((parseInt(player.wins)/parseInt(player.total_debates))*100)}%`,height:'100%',background:'linear-gradient(90deg,#7C5CFC,#2DD4BF)',borderRadius:'6px',transition:'width 0.8s ease',boxShadow:'0 0 12px rgba(124,92,252,0.6)'}}/>
                      </div>
                    </Card>
                  )}

                  <Card style={{padding:'14px 18px'}}>
                    <div style={{fontFamily:'monospace',fontSize:'11px',color:G.textDim,lineHeight:2}}>
                      <div>Contract: <span style={{color:G.textSub}}>{CONTRACT_ADDRESS}</span></div>
                      <div>Network: <span style={{color:G.textSub}}>GenLayer Bradbury - Chain 4221</span></div>
                      <a href={`https://explorer-bradbury.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener" style={{color:'#C4B5FD'}}>Explorer</a>
                    </div>
                  </Card>
                </div>
              )}
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="show-mobile" style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:'rgba(8,8,15,0.9)',backdropFilter:'blur(32px)',borderTop:'1px solid rgba(255,255,255,0.07)',padding:'8px 0 env(safe-area-inset-bottom,10px)',display:'none',justifyContent:'space-around'}}>
        {([['arena','🏟','Arena'],['battles','⚔','Battles'],['rankings','🏆','Ranks'],['profile','👤','Profile']] as [Tab,string,string][]).map(([t,icon,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'4px 14px',fontFamily:'inherit'}}>
            <span style={{fontSize:'22px',filter:tab===t?`drop-shadow(0 0 8px ${G.violet})`:'grayscale(0.7)'}}>{icon}</span>
            <span style={{fontSize:'10px',fontWeight:tab===t?700:400,color:tab===t?'#C4B5FD':G.textDim,transition:'color 0.15s'}}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function EmptyState({icon,title,sub,children}:{icon:string;title:string;sub:string;children?:React.ReactNode}) {
  return(
    <Card style={{padding:'56px 24px',textAlign:'center'}}>
      <div style={{fontSize:'48px',marginBottom:'14px',animation:'float 3s ease-in-out infinite'}}>{icon}</div>
      <p style={{fontWeight:700,fontSize:'17px',marginBottom:'6px',background:'linear-gradient(135deg,#7C5CFC,#2DD4BF)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{title}</p>
      <p style={{color:G.textSub,fontSize:'14px'}}>{sub}</p>
      {children}
    </Card>
  )
}

function DebateCard({debate,address,onJoin,onClick,loading,detailed=false}:{
  debate:Debate;address?:string;onJoin:()=>void;onClick:()=>void;loading:boolean;detailed?:boolean
}) {
  const isCreator=debate.creator===address
  const isOpponent=debate.opponent===address
  const isWinner=debate.winner===address
  const isDraw=debate.winner==='DRAW'
  return(
    <Card onClick={onClick} glow={isWinner} style={{padding:'18px',cursor:'pointer',position:'relative',overflow:'hidden'}}>
      {isWinner&&<div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:`linear-gradient(90deg,transparent,${G.green},transparent)`}}/>}
      {debate.status==='ACTIVE'&&<div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:`linear-gradient(90deg,transparent,${G.violet},transparent)`}}/>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px',marginBottom:'10px'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',gap:'5px',marginBottom:'7px',flexWrap:'wrap'}}>
            <span style={{fontSize:'10px',color:G.textSub,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'5px',padding:'2px 7px'}}>{debate.category}</span>
            <span style={{fontSize:'10px',color:G.amber,background:'rgba(251,191,36,0.10)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:'5px',padding:'2px 7px',fontWeight:600}}>⚡ {debate.stake} pts</span>
          </div>
          <p style={{fontWeight:700,fontSize:'14px',lineHeight:1.35,color:G.text,letterSpacing:'-0.01em'}}>{debate.topic}</p>
        </div>
        <SPill status={debate.status}/>
      </div>
      <div style={{fontSize:'11px',color:G.textSub,marginBottom:['FINISHED','CLAIMED','FINAL'].includes(debate.status)&&debate.reasoning?'10px':'0'}}>
        <span style={{fontFamily:'monospace',color:isCreator?'#C4B5FD':G.textSub}}>{sa(debate.creator)}{isCreator?' (you)':''}</span>
        <span style={{margin:'0 6px',color:G.textDim}}>vs</span>
        <span style={{fontFamily:'monospace',color:isOpponent?'#C4B5FD':G.textSub}}>
          {debate.opponent===ZERO?<em style={{color:G.textDim}}>awaiting...</em>:`${sa(debate.opponent)}${isOpponent?' (you)':''}`}
        </span>
      </div>
      {['FINISHED','CLAIMED','FINAL'].includes(debate.status)&&debate.reasoning&&(
        <div style={{background:isWinner?'rgba(74,222,128,0.08)':'rgba(255,255,255,0.03)',border:`1px solid ${isWinner?G.green+'25':'rgba(255,255,255,0.07)'}`,borderRadius:'10px',padding:'10px 12px',borderLeft:`3px solid ${isWinner?G.green:isDraw?G.textDim:(isCreator||isOpponent)?G.red:G.textDim}`}}>
          <p style={{fontSize:'12px',fontWeight:700,marginBottom:'3px',color:isWinner?G.green:isDraw?G.textSub:(isCreator||isOpponent)?G.red:G.textSub}}>
            {isDraw?'Draw':isWinner?('Victory! '+(debate.claimed!=='true'?'Claim points ->':'Claimed')):(isCreator||isOpponent)?'Defeat':('Winner: '+sa(debate.winner))}
          </p>
          <p style={{fontSize:'11px',color:G.textSub,lineHeight:1.5}}>{debate.reasoning.slice(0,100)}{debate.reasoning.length>100?'...':''}</p>
        </div>
      )}
      {debate.status==='OPEN'&&!isCreator&&address&&(
        <div style={{marginTop:'12px'}}>
          <button disabled={loading} onClick={e=>{e.stopPropagation();onJoin()}} className="lg-btn-primary"
            style={{width:'100%',padding:'10px',fontSize:'13px',opacity:loading?0.5:1}}>
            Accept - Stake {debate.stake} pts
          </button>
        </div>
      )}
    </Card>
  )
}

function BattleModal({debate:init,address,player,onClose,onAction,fetchDetail,loading}:{
  debate:Debate;address:string;player:Player|null
  onClose:()=>void;onAction:(m:string,a:unknown[])=>Promise<boolean>
  fetchDetail:(id:string)=>Promise<Debate|null>;loading:boolean
}) {
  const [debate,setDebate]=useState(init)
  const [arg,setArg]=useState('')
  const [showAppeal,setShowAppeal]=useState(false)
  const [appealText,setAppealText]=useState('')
  useEffect(()=>{fetchDetail(init.debate_id).then(d=>{if(d)setDebate(d)})},[init.debate_id])
  const isCreator=debate.creator===address,isOpponent=debate.opponent===address
  const isParty=isCreator||isOpponent,isWinner=debate.winner===address,isDraw=debate.winner==='DRAW'
  const hasMyArg=isCreator?!!debate.creator_argument:!!debate.opponent_argument
  return(
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.7)',zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',backdropFilter:'blur(16px)'}} onClick={onClose}>
      <div style={{background:'rgba(12,10,22,0.92)',backdropFilter:'blur(40px) saturate(180%)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'22px',width:'100%',maxWidth:'660px',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.06)',position:'relative'}} onClick={e=>e.stopPropagation()}>
        <div style={{position:'absolute',top:0,left:'5%',right:'5%',height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)',borderRadius:'50%',pointerEvents:'none'}}/>
        <div style={{padding:'22px 22px 28px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'18px'}}>
            <div style={{flex:1,paddingRight:'12px'}}>
              <div style={{display:'flex',gap:'6px',marginBottom:'8px',flexWrap:'wrap',alignItems:'center'}}>
                <SPill status={debate.status}/>
                <span style={{fontSize:'11px',color:G.textDim}}>·</span>
                <span style={{fontSize:'11px',color:G.textSub}}>{debate.category}</span>
                <span style={{fontSize:'11px',color:G.amber,fontWeight:600}}>· ⚡ {debate.stake} pts · winner {parseInt(debate.stake)*2}</span>
              </div>
              <h2 style={{fontSize:'17px',fontWeight:800,lineHeight:1.3,letterSpacing:'-0.02em',color:G.text}}>{debate.topic}</h2>
            </div>
            <button onClick={onClose} className="lg-btn-secondary" style={{width:'32px',height:'32px',borderRadius:'9px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',flexShrink:0}}>✕</button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:'8px',alignItems:'center',marginBottom:'14px'}}>
            {[
              {label:'Creator',addr:debate.creator,score:debate.creator_score,isMe:isCreator,arg:debate.creator_argument},
              {label:'Opponent',addr:debate.opponent,score:debate.opponent_score,isMe:isOpponent,arg:debate.opponent_argument},
            ].map((p,i)=>(
              <React.Fragment key={i}>
                {i===1&&<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
                  <span style={{fontSize:'18px',filter:`drop-shadow(0 0 8px ${G.violet})`}}>⚔</span>
                  <span style={{fontSize:'9px',color:G.textDim,fontWeight:700,letterSpacing:'0.1em'}}>VS</span>
                </div>}
                <div style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${debate.winner===p.addr&&!isDraw?G.green+'40':'rgba(255,255,255,0.08)'}`,borderRadius:'14px',padding:'14px',textAlign:'center',backdropFilter:'blur(8px)'}}>
                  <div style={{fontSize:'10px',color:G.textDim,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'7px',fontWeight:600}}>{p.label}</div>
                  <div style={{fontFamily:'monospace',fontSize:'11px',color:p.isMe?'#C4B5FD':G.textSub,marginBottom:'9px'}}>{sa(p.addr)}{p.isMe?' (you)':''}</div>
                  {p.score&&<div style={{fontSize:'30px',fontWeight:900,color:parseInt(p.score)>=70?G.green:parseInt(p.score)>=50?G.amber:G.red,letterSpacing:'-0.03em',lineHeight:1,marginBottom:'3px'}}>{p.score}<span style={{fontSize:'13px',color:G.textDim,fontWeight:400}}>/100</span></div>}
                  {!p.score&&debate.status==='ACTIVE'&&p.addr!==ZERO&&<div style={{fontSize:'11px',color:G.amber}}>Awaiting...</div>}
                  {debate.winner===p.addr&&!isDraw&&<div style={{fontSize:'11px',fontWeight:600,color:G.green,marginTop:'4px'}}>Winner ✓</div>}
                  {isDraw&&p.addr!==ZERO&&<div style={{fontSize:'11px',color:G.textSub,marginTop:'4px'}}>Draw</div>}
                  {p.arg&&isParty&&<p style={{fontSize:'11px',color:G.textSub,marginTop:'8px',lineHeight:1.5,borderTop:'1px solid rgba(255,255,255,0.07)',paddingTop:'8px',textAlign:'left'}}>{p.arg.slice(0,100)}{p.arg.length>100?'...':''}</p>}
                </div>
              </React.Fragment>
            ))}
          </div>

          {debate.reasoning&&(
            <div style={{background:'rgba(124,92,252,0.08)',border:'1px solid rgba(124,92,252,0.20)',borderRadius:'12px',padding:'14px',marginBottom:'14px',borderLeft:`3px solid ${G.violet}`}}>
              <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'9px'}}>
                <span style={{fontSize:'14px'}}>🤖</span>
                <span style={{fontSize:'11px',color:'#C4B5FD',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>AI Validator Verdict</span>
              </div>
              <p style={{fontSize:'13px',color:G.text,lineHeight:1.65}}>{debate.reasoning}</p>
              {debate.creator_score_breakdown&&isParty&&(
                <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
                  <p style={{fontSize:'11px',color:G.textDim,fontWeight:600,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.06em'}}>Breakdown</p>
                  <p style={{fontSize:'11px',color:G.textSub,lineHeight:1.6}}>Creator: {debate.creator_score_breakdown}</p>
                  <p style={{fontSize:'11px',color:G.textSub,lineHeight:1.6,marginTop:'3px'}}>Opponent: {debate.opponent_score_breakdown}</p>
                </div>
              )}
              {debate.appeal_reasoning&&(
                <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
                  <p style={{fontSize:'11px',color:G.amber,fontWeight:700,marginBottom:'4px'}}>Appeal - {debate.appeal_verdict}</p>
                  <p style={{fontSize:'11px',color:G.textSub,lineHeight:1.6}}>{debate.appeal_reasoning}</p>
                </div>
              )}
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {debate.status==='OPEN'&&!isCreator&&(
              <button disabled={loading} onClick={()=>{onAction('join_debate',[debate.debate_id]);onClose()}} className="lg-btn-primary"
                style={{padding:'13px',fontSize:'14px',opacity:loading?0.5:1}}>Accept Challenge - Stake {debate.stake} pts</button>
            )}
            {debate.status==='ACTIVE'&&isParty&&!hasMyArg&&(
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <div style={{background:'rgba(124,92,252,0.08)',border:'1px solid rgba(124,92,252,0.18)',borderRadius:'10px',padding:'10px 13px',fontSize:'12px',color:'#C4B5FD',lineHeight:1.6}}>
                  After both submit, 5 AI validators judge automatically. Takes 1-3 minutes.
                </div>
                <textarea value={arg} onChange={e=>setArg(e.target.value)} placeholder="Build your strongest argument. Validators score: Logic (35) Evidence (25) Persuasion (25) Clarity (15)."
                  className="lg-input" style={{minHeight:'120px',resize:'vertical'}}/>
                <button disabled={loading||arg.trim().length<20} onClick={()=>{onAction('submit_argument',[debate.debate_id,arg]);onClose()}} className="lg-btn-primary"
                  style={{padding:'12px',fontSize:'14px',opacity:arg.trim().length>=20?1:0.4}}>Submit Argument</button>
                <p style={{fontSize:'11px',color:G.textDim,textAlign:'right'}}>{arg.length} chars - min 20</p>
              </div>
            )}
            {debate.status==='ACTIVE'&&isParty&&hasMyArg&&(
              <div style={{background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:'10px',padding:'12px',textAlign:'center'}}>
                <span style={{fontSize:'13px',color:G.green,fontWeight:600}}>Argument submitted - waiting for opponent</span>
              </div>
            )}
            {(debate.status==='FINISHED'||debate.status==='FINAL')&&isWinner&&!isDraw&&debate.claimed!=='true'&&(
              <button disabled={loading} onClick={()=>{onAction('claim_winnings',[debate.debate_id]);onClose()}} className="lg-btn-success"
                style={{padding:'14px',fontSize:'15px',opacity:loading?0.5:1}}>
                Claim {parseInt(debate.stake)*2} Points
              </button>
            )}
            {debate.status==='OPEN'&&isCreator&&(
              <button disabled={loading} onClick={()=>{onAction('cancel_debate',[debate.debate_id]);onClose()}} className="lg-btn-ghost"
                style={{padding:'10px',fontSize:'13px',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px'}}>
                Cancel (refunds stake)
              </button>
            )}
            {debate.status==='FINISHED'&&isParty&&!isWinner&&!isDraw&&!debate.appeal_grounds&&(
              !showAppeal?(
                <button onClick={()=>setShowAppeal(true)} className="lg-btn-secondary" style={{padding:'10px',fontSize:'13px'}}>
                  Appeal Verdict (costs {APPEAL_COST} pts)
                </button>
              ):(
                <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:'12px',padding:'14px',display:'flex',flexDirection:'column',gap:'8px'}}>
                  <p style={{fontSize:'12px',color:G.amber,fontWeight:600}}>Strict standard - only clear errors overturned:</p>
                  <textarea value={appealText} onChange={e=>setAppealText(e.target.value)} placeholder="What specific error did validators make?" className="lg-input" style={{minHeight:'80px',resize:'vertical'}}/>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button disabled={loading||!appealText.trim()} onClick={()=>{onAction('appeal_verdict',[debate.debate_id,appealText]);setShowAppeal(false);onClose()}}
                      style={{flex:1,background:'linear-gradient(135deg,#D97706,#B45309)',color:'#fff',border:'none',borderRadius:'9px',padding:'10px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:appealText.trim()?1:0.5,fontFamily:'inherit'}}>
                      File Appeal
                    </button>
                    <button onClick={()=>setShowAppeal(false)} className="lg-btn-secondary" style={{padding:'10px 14px',fontSize:'13px'}}>Cancel</button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateModal({player,onClose,onSubmit,loading}:{player:Player;onClose:()=>void;onSubmit:(t:string,s:string,c:string)=>void;loading:boolean}) {
  const [topic,setTopic]=useState(''),[stake,setStake]=useState('10'),[cat,setCat]=useState('General')
  const max=Math.min(MAX_STAKE,parseInt(player.points))
  const ok=topic.trim().length>=10&&parseInt(stake)>=MIN_STAKE&&parseInt(stake)<=max
  return(
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.7)',zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',backdropFilter:'blur(16px)'}} onClick={onClose}>
      <div style={{background:'rgba(12,10,22,0.92)',backdropFilter:'blur(40px)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'22px',width:'100%',maxWidth:'500px',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(0,0,0,0.8)',position:'relative'}} onClick={e=>e.stopPropagation()}>
        <div style={{position:'absolute',top:0,left:'10%',right:'10%',height:'1px',background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)',pointerEvents:'none'}}/>
        <div style={{padding:'22px 22px 28px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
            <h2 style={{fontSize:'18px',fontWeight:800,letterSpacing:'-0.02em',color:G.text}}>New Debate</h2>
            <button onClick={onClose} className="lg-btn-secondary" style={{width:'32px',height:'32px',borderRadius:'9px',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px'}}>✕</button>
          </div>
          <div style={{background:'rgba(124,92,252,0.08)',border:'1px solid rgba(124,92,252,0.18)',borderRadius:'10px',padding:'10px 13px',fontSize:'12px',color:'#C4B5FD',marginBottom:'18px',lineHeight:1.6}}>
            AI validators verify your topic is fair before it goes live.
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <div>
              <label style={{display:'block',fontSize:'12px',fontWeight:500,color:G.textSub,marginBottom:'5px'}}>Topic</label>
              <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. AI will create more jobs than it destroys" className="lg-input"/>
              <p style={{fontSize:'11px',color:G.textDim,marginTop:'4px'}}>{topic.length} chars - min 10</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'10px'}}>
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:500,color:G.textSub,marginBottom:'5px'}}>Stake - <span style={{color:G.amber}}>{player.points} available</span></label>
                <input type="number" min={MIN_STAKE} max={max} value={stake} onChange={e=>setStake(e.target.value)} className="lg-input"/>
                <p style={{fontSize:'11px',color:G.textDim,marginTop:'4px'}}>Winner gets {parseInt(stake||'0')*2} pts</p>
              </div>
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:500,color:G.textSub,marginBottom:'5px'}}>Category</label>
                <select value={cat} onChange={e=>setCat(e.target.value)} className="lg-input" style={{cursor:'pointer'}}>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <button disabled={loading||!ok} onClick={()=>onSubmit(topic,stake,cat)} className="lg-btn-primary"
              style={{padding:'12px',fontSize:'14px',opacity:ok?1:0.4}}>Launch Debate</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RegisterModal({onClose,onSubmit,loading}:{onClose:()=>void;onSubmit:(u:string)=>void;loading:boolean}) {
  const [username,setUsername]=useState('')
  return(
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.75)',zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(20px)'}} onClick={onClose}>
      <div style={{position:'relative',width:'100%',maxWidth:'400px'}} onClick={e=>e.stopPropagation()}>
        <IriCard style={{overflow:'hidden'}}>
          <div style={{padding:'36px 28px',textAlign:'center',position:'relative'}}>
            <div style={{position:'relative',width:'72px',height:'72px',margin:'0 auto 20px'}}>
              <div style={{position:'absolute',inset:'-3px',borderRadius:'50%',background:`conic-gradient(${G.violet},${G.teal},${G.pink},${G.violet})`,animation:'spin 3s linear infinite'}}/>
              <div style={{position:'relative',width:'72px',height:'72px',borderRadius:'50%',background:'rgba(8,8,15,0.9)',border:'3px solid rgba(8,8,15,1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'30px'}}>⚔</div>
            </div>
            <h2 style={{fontSize:'24px',fontWeight:900,letterSpacing:'-0.03em',marginBottom:'10px',color:G.text}}>Join DeBattle</h2>
            <p style={{color:G.textSub,fontSize:'14px',lineHeight:1.65,marginBottom:'26px'}}>
              Register and receive <strong style={{color:G.amber}}>{STARTING_POINTS} free points</strong> to start debating.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'12px',textAlign:'left'}}>
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:500,color:G.textSub,marginBottom:'5px'}}>Username <span style={{color:G.textDim,fontWeight:400}}>(optional)</span></label>
                <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. LogicMaster" maxLength={20} className="lg-input"/>
              </div>
              <button disabled={loading} onClick={()=>onSubmit(username)} className="lg-btn-primary"
                style={{padding:'13px',fontSize:'14px',opacity:loading?0.5:1}}>
                Enter Arena - {STARTING_POINTS} Points Free
              </button>
              <p style={{fontSize:'11px',color:G.textDim,textAlign:'center'}}>Signs a transaction on GenLayer Bradbury</p>
            </div>
          </div>
        </IriCard>
      </div>
    </div>
  )
}
