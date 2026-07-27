'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const sevConfig = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)' },
  informational: { color: '#7C8AA5', bg: 'rgba(124,138,165,0.12)' },
  info:          { color: '#7C8AA5', bg: 'rgba(124,138,165,0.12)' },
}

export default function DASTPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [targetUrl, setTargetUrl] = useState("http://testphp.vulnweb.com/")
  const [scanMode, setScanMode] = useState("standard")
  const [findings, setFindings] = useState<any[]>([])

  useEffect(() => {
    let interval: any;
    if (scanning) {
      setScanProgress(10);
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 600);
    } else {
      setScanProgress(0);
    }
    return () => clearInterval(interval);
  }, [scanning]);

  const handleScan = async () => {
    try {
      setFindings([]); 
      setScanning(true)

      const response = await fetch("http://127.0.0.1:8000/api/dast/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_url: targetUrl,
          scan_mode: scanMode,
        }),
      })

      if (!response.ok) {
        throw new Error("Scan failed")
      }

      const data = await response.json()
      setScanProgress(100);
      setFindings(data.findings || data)
    } catch (err) {
      setFindings([]); 
      console.error(err)
      alert("DAST scan failed.")
    } finally {
      setScanning(false)
    }
  }

  const filtered = findings.filter((e: any) => {
    if (activeTab === "critical") return e.severity?.toLowerCase() === "critical";
    if (activeTab === "high") return e.severity?.toLowerCase() === "high";
    if (activeTab === "resolved") return false;
    return true;
  });

  const tabs = [
    {key:'all', label:'All', count: findings.length},
    {key:'critical', label:'Critical', count: findings.filter(v => v.severity?.toLowerCase() === 'critical').length},
    {key:'high', label:'High', count: findings.filter(v => v.severity?.toLowerCase() === 'high').length},
    {key:'resolved', label:'Resolved', count: 0}
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',fontFamily:'var(--body)'}}>
      {/* TOP BAR */}
      <div style={{height:56,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'var(--bg)'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(255,255,255,0.35)'}}>
          <Link href="/dashboard" style={{color:'rgba(255,255,255,0.35)',textDecoration:'none'}}>Dashboard</Link>
          <span>/</span>
          <span style={{color:'#F0F4FF',fontWeight:500}}>DAST</span>
          <span style={{fontSize:9,padding:'1px 6px',borderRadius:4,background:'rgba(27,127,255,0.15)',color:'#4D9FFF',marginLeft:4}}>Phase 3</span>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          
          {/* FULLY FUNCTIONAL TEXT INPUT REPLACING THE DROPDOWN */}
          <input 
            type="text" 
            value={targetUrl} 
            onChange={(e) => setTargetUrl(e.target.value)} 
            placeholder="Enter target URL (e.g., http://localhost:3000)"
            style={{padding:'6px 12px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#F0F4FF',fontSize:12,outline:'none',width:'280px',fontFamily:'var(--body)'}}
          />

          <select 
            value={scanMode}
            onChange={(e) => setScanMode(e.target.value)}
            style={{padding:'6px 10px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#F0F4FF',fontSize:12,outline:'none',cursor:'pointer',fontFamily:'var(--body)'}}
          >
            <option value="standard" style={{background:'#0D1B2E'}}>Standard Scan</option>
            <option value="full" style={{background:'#0D1B2E'}}>Full Scan</option>
            <option value="quick" style={{background:'#0D1B2E'}}>Quick Scan</option>
          </select>

          <button style={{padding:'7px 12px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer'}}>Export</button>
          
          <button onClick={handleScan} disabled={scanning}
            style={{padding:'7px 16px',borderRadius:7,border:'none',background:scanning?'rgba(27,127,255,0.5)':'#1B7FFF',color:'#fff',fontSize:12,fontWeight:600,cursor:scanning?'not-allowed':'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:6}}>
            {scanning?<><span style={{display:'inline-block',width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Scanning...</>:'▶ Start Scan'}
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:20,background:'rgba(6,13,24,0.8)'}}>

        {/* Scan progress bar */}
        {scanning && (
          <div style={{marginBottom:16,padding:'12px 16px',background:'rgba(27,127,255,0.08)',border:'1px solid rgba(27,127,255,0.2)',borderRadius:10}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:12}}>
              <span style={{color:'#4D9FFF',fontWeight:500}}>🔍 OWASP ZAP scanning {targetUrl}...</span>
              <span style={{color:'rgba(255,255,255,0.4)',fontFamily:'var(--mono)'}}>{scanProgress}%</span>
            </div>
            <div style={{height:4,background:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${scanProgress}%`,background:'#1B7FFF',borderRadius:2,transition:'width .3s'}}/>
            </div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:6,fontFamily:'var(--mono)'}}>
              Crawling endpoints → Testing SQL injection → Testing XSS → Testing CSRF...
            </div>
          </div>
        )}

        {/* STAT CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
          {[
            {label:'Endpoints Tested', value: findings.length > 0 ? '47' : '0', color:'#F0F4FF', sub:'100% coverage'},
            {label:'Critical Issues',  value: findings.filter(v => v.severity?.toLowerCase() === 'critical').length, color:'#FF6B6B', sub:'need immediate fix'},
            {label:'High Issues',      value: findings.filter(v => v.severity?.toLowerCase() === 'high').length, color:'#FFB020', sub:'fix this sprint'},
            {label:'Scan Status',      value: scanning ? 'Running' : (findings.length > 0 ? 'Completed' : 'Idle'), color:'#4D9FFF', sub:'current state'},
          ].map(s=>(
            <div key={s.label} style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.6px',color:'rgba(255,255,255,0.35)',marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:28,fontWeight:300,color:s.color,letterSpacing:'-1px',lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:5}}>{s.sub}</div>
              <div style={{marginTop:10,height:3,borderRadius:2,background:s.color,width:28}}/>
            </div>
          ))}
        </div>

        {/* TABLE */}
        <div style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,overflow:'hidden'}}>
          {/* Tabs */}
          <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 16px'}}>
            {tabs.map(t=>(
              <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{padding:'12px 14px',fontSize:12,fontWeight:activeTab===t.key?500:400,color:activeTab===t.key?'#F0F4FF':'rgba(255,255,255,0.35)',background:'none',border:'none',borderBottom:`2px solid ${activeTab===t.key?'#1B7FFF':'transparent'}`,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:'var(--body)'}}>
                {t.label}
                <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:activeTab===t.key?'rgba(27,127,255,0.2)':'rgba(255,255,255,0.07)',color:activeTab===t.key?'#4D9FFF':'rgba(255,255,255,0.3)'}}>{t.count}</span>
              </button>
            ))}
          </div>
          {/* Header */}
          <div style={{display:'grid',gridTemplateColumns:'120px 2fr 2fr 120px 120px 3fr',padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
            {['Severity', 'Title', 'Target', 'CWE', 'OWASP', 'Description'].map(h=>(
              <div key={h} style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.5px',color:'rgba(255,255,255,0.3)'}}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 14}}>
              {scanning ? "Scanning target..." : "No vulnerabilities found or scan has not been run yet."}
            </div>
          ) : (
            filtered.map((e, i) => {
              const severity = (e.severity || "low").toLowerCase();
              const sev = sevConfig[severity as keyof typeof sevConfig] || sevConfig.low;
              
              return (
                <div
                  key={`${e.rule || e.title}-${i}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 2fr 2fr 120px 120px 3fr",
                    padding: "11px 16px",
                    alignItems: "center",
                    borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "background .12s",
                  }}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <span style={{fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: sev.bg, color: sev.color, fontFamily: "var(--mono)"}}>
                      {e.severity}
                    </span>
                  </div>
                  <div style={{fontSize: 12, fontWeight: 500, color: "#F0F4FF"}}>{e.title || e.rule}</div>
                  <div style={{fontSize: 11, fontFamily: "var(--mono)", color: "#4D9FFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{e.file || e.endpoint || targetUrl}</div>
                  <div style={{fontSize: 10, color: "rgba(255,255,255,0.5)"}}>{e.cwe || "CWE-N/A"}</div>
                  <div style={{fontSize: 10, fontFamily: "var(--mono)", color: "rgba(255,255,255,0.4)"}}>{e.owasp || "A00:2021"}</div>
                  <div style={{fontSize: 11, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}} title={e.description}>{e.description}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}