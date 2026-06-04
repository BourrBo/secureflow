'use client'
import { useState } from 'react'
import Link from 'next/link'

const reports = [
  { id:1,  name:'Executive Security Summary — May 2025',  type:'PDF', size:'4.2 MB', date:'May 21, 2025', category:'Executive',  status:'ready' },
  { id:2,  name:'OWASP Top 10 Coverage Report',           type:'PDF', size:'1.8 MB', date:'May 18, 2025', category:'Compliance', status:'ready' },
  { id:3,  name:'SOC 2 Type II Evidence Pack',            type:'PDF', size:'8.1 MB', date:'May 15, 2025', category:'Compliance', status:'ready' },
  { id:4,  name:'Full Vulnerability Export — All Modules',type:'CSV', size:'0.9 MB', date:'May 20, 2025', category:'Technical',  status:'ready' },
  { id:5,  name:'ISO 27001 Gap Analysis',                 type:'PDF', size:'3.1 MB', date:'May 10, 2025', category:'Compliance', status:'ready' },
  { id:6,  name:'SAST Findings — api-gateway',            type:'CSV', size:'0.3 MB', date:'May 21, 2025', category:'Technical',  status:'ready' },
  { id:7,  name:'SCA SBOM — CycloneDX Format',            type:'JSON',size:'1.1 MB', date:'May 19, 2025', category:'SBOM',       status:'ready' },
  { id:8,  name:'SCA SBOM — SPDX Format',                 type:'JSON',size:'0.8 MB', date:'May 19, 2025', category:'SBOM',       status:'ready' },
  { id:9,  name:'Secrets Exposure Report',                type:'PDF', size:'0.6 MB', date:'May 17, 2025', category:'Technical',  status:'ready' },
  { id:10, name:'Q1 2025 Security Metrics',               type:'PDF', size:'5.4 MB', date:'Apr 01, 2025', category:'Executive',  status:'ready' },
]

const metrics = [
  { label:'Critical fixed this month', value:'17',  color:'#00E576', trend:'▲ up from 12' },
  { label:'Avg fix time (MTTR)',        value:'6.2d',color:'#4D9FFF', trend:'▼ down from 7.3d' },
  { label:'Security score',            value:'64',  color:'#FFB020', trend:'▼ down from 67' },
  { label:'Total findings closed',     value:'142', color:'#00E576', trend:'▲ up from 119' },
]

const typeColors: Record<string,{color:string;bg:string}> = {
  PDF:  {color:'#FF6B6B',bg:'rgba(192,55,42,0.15)'},
  CSV:  {color:'#00E576',bg:'rgba(0,229,118,0.10)'},
  JSON: {color:'#4D9FFF',bg:'rgba(27,127,255,0.15)'},
}

const catColors: Record<string,string> = {
  Executive:'#FFB020', Compliance:'#4D9FFF', Technical:'#00E576', SBOM:'#00D4FF',
}

export default function ReportsPage() {
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState('All')
  const [generated, setGenerated] = useState(false)

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => { setGenerating(false); setGenerated(true) }, 2500)
  }

  const filtered = reports.filter(r => filter === 'All' || r.category === filter)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',fontFamily:'var(--body)'}}>

      {/* TOP BAR */}
      <div style={{height:56,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'var(--bg)'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(255,255,255,0.35)'}}>
          <Link href="/dashboard" style={{color:'rgba(255,255,255,0.35)',textDecoration:'none'}}>Dashboard</Link>
          <span>/</span>
          <span style={{color:'#F0F4FF',fontWeight:500}}>Reports</span>
        </div>
        <div style={{display:'flex',gap:10}}>
          <select value={filter} onChange={e=>setFilter(e.target.value)}
            style={{padding:'6px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#F0F4FF',fontSize:12,outline:'none',cursor:'pointer',fontFamily:'var(--body)'}}>
            {['All','Executive','Compliance','Technical','SBOM'].map(c=>(
              <option key={c} value={c} style={{background:'#0D1B2E'}}>{c}</option>
            ))}
          </select>
          <button onClick={handleGenerate} disabled={generating}
            style={{padding:'7px 16px',borderRadius:7,border:'none',background:generating?'rgba(27,127,255,0.5)':'#1B7FFF',color:'#fff',fontSize:12,fontWeight:600,cursor:generating?'not-allowed':'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:6}}>
            {generating
              ?<><span style={{display:'inline-block',width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Generating...</>
              :'+ Generate Report'}
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:20,background:'rgba(6,13,24,0.8)'}}>

        {/* Success banner */}
        {generated && (
          <div style={{marginBottom:16,padding:'10px 16px',background:'rgba(0,229,118,0.08)',border:'1px solid rgba(0,229,118,0.2)',borderRadius:10,display:'flex',alignItems:'center',gap:10,fontSize:12}}>
            <span style={{fontSize:16}}>✅</span>
            <span style={{color:'#00E576',fontWeight:500}}>Report generated!</span>
            <span style={{color:'rgba(255,255,255,0.5)'}}>Executive Security Summary — June 2025 is ready to download.</span>
            <button onClick={()=>setGenerated(false)} style={{marginLeft:'auto',background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:16}}>✕</button>
          </div>
        )}

        {/* METRICS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
          {metrics.map(m=>(
            <div key={m.label} style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.6px',color:'rgba(255,255,255,0.35)',marginBottom:6}}>{m.label}</div>
              <div style={{fontSize:28,fontWeight:300,color:m.color,letterSpacing:'-1px',lineHeight:1}}>{m.value}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:5}}>{m.trend}</div>
              <div style={{marginTop:10,height:3,borderRadius:2,background:m.color,width:28}}/>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>

          {/* REPORTS LIST */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:12}}>
              Available reports ({filtered.length})
            </div>
            <div style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,overflow:'hidden'}}>
              {filtered.map((r,i)=>{
                const tc=typeColors[r.type]||{color:'#aaa',bg:'rgba(255,255,255,0.07)'}
                const catColor=catColors[r.category]||'#aaa'
                return(
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderBottom:i<filtered.length-1?'1px solid rgba(255,255,255,0.05)':'none',transition:'background .12s'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    {/* Icon */}
                    <div style={{width:40,height:40,borderRadius:9,background:tc.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:tc.color,flexShrink:0,fontFamily:'var(--mono)'}}>
                      {r.type}
                    </div>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:'#F0F4FF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                        <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>{r.date}</span>
                        <span style={{fontSize:10,color:'rgba(255,255,255,0.2)'}}>·</span>
                        <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>{r.size}</span>
                        <span style={{fontSize:10,color:'rgba(255,255,255,0.2)'}}>·</span>
                        <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:`${catColor}18`,color:catColor}}>{r.category}</span>
                      </div>
                    </div>
                    {/* Download */}
                    <button style={{padding:'6px 14px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:11,cursor:'pointer',fontFamily:'var(--body)',whiteSpace:'nowrap',flexShrink:0,transition:'all .15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(27,127,255,0.4)';e.currentTarget.style.color='#4D9FFF'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';e.currentTarget.style.color='rgba(255,255,255,0.5)'}}>
                      ↓ Download
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT — Generate + Schedule */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Generate custom */}
            <div style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:16}}>
              <div style={{fontSize:12,fontWeight:600,color:'#F0F4FF',fontFamily:'var(--font)',marginBottom:14}}>Generate custom report</div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.5)',marginBottom:5}}>Report type</label>
                <select style={{width:'100%',padding:'8px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(13,27,46,0.9)',color:'#F0F4FF',fontSize:12,outline:'none',cursor:'pointer',fontFamily:'var(--body)'}}>
                  <option style={{background:'#0D1B2E'}}>Executive Summary</option>
                  <option style={{background:'#0D1B2E'}}>Technical Full Report</option>
                  <option style={{background:'#0D1B2E'}}>Compliance Report</option>
                  <option style={{background:'#0D1B2E'}}>SBOM Export</option>
                  <option style={{background:'#0D1B2E'}}>Vulnerability CSV</option>
                </select>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.5)',marginBottom:5}}>Date range</label>
                <select style={{width:'100%',padding:'8px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(13,27,46,0.9)',color:'#F0F4FF',fontSize:12,outline:'none',cursor:'pointer',fontFamily:'var(--body)'}}>
                  <option style={{background:'#0D1B2E'}}>Last 30 days</option>
                  <option style={{background:'#0D1B2E'}}>Last 90 days</option>
                  <option style={{background:'#0D1B2E'}}>This quarter</option>
                  <option style={{background:'#0D1B2E'}}>Custom range</option>
                </select>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{display:'block',fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.5)',marginBottom:5}}>Include modules</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {['SAST','SCA','Secrets','IaC','Container','DAST'].map(m=>(
                    <label key={m} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'rgba(255,255,255,0.5)',cursor:'pointer'}}>
                      <input type="checkbox" defaultChecked style={{accentColor:'#1B7FFF'}}/>{m}
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={handleGenerate} disabled={generating}
                style={{width:'100%',padding:'9px',borderRadius:8,border:'none',background:generating?'rgba(27,127,255,0.5)':'#1B7FFF',color:'#fff',fontSize:12,fontWeight:600,cursor:generating?'not-allowed':'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                {generating?<><span style={{display:'inline-block',width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Generating...</>:'Generate Report →'}
              </button>
            </div>

            {/* Scheduled reports */}
            <div style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:16}}>
              <div style={{fontSize:12,fontWeight:600,color:'#F0F4FF',fontFamily:'var(--font)',marginBottom:12}}>Scheduled reports</div>
              {[
                {name:'Weekly Executive Summary', schedule:'Every Monday 9AM', next:'Jun 2'},
                {name:'Monthly Compliance Report', schedule:'1st of each month', next:'Jun 1'},
                {name:'Daily Vuln Export CSV', schedule:'Every day midnight', next:'Tomorrow'},
              ].map((s,i)=>(
                <div key={s.name} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<2?'1px solid rgba(255,255,255,0.05)':'none'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:500,color:'#F0F4FF'}}>{s.name}</div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:2}}>{s.schedule} · Next: {s.next}</div>
                  </div>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'#00E576',flexShrink:0}}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
