'use client'
import { useState } from 'react'
import Link from 'next/link'

const images = [
  { id: 1, name: 'api-gateway',      tag: 'v2.1.4', registry: 'ghcr.io',   size: '245 MB', os: 'debian:12',    scanned: '2h ago',  critical: 3, high: 8,  medium: 12, status: 'failing' },
  { id: 2, name: 'auth-service',     tag: 'v1.8.2', registry: 'ghcr.io',   size: '189 MB', os: 'alpine:3.18',  scanned: '2h ago',  critical: 0, high: 4,  medium: 7,  status: 'warning' },
  { id: 3, name: 'payment-ms',       tag: 'v3.0.1', registry: 'docker.io', size: '512 MB', os: 'ubuntu:22.04', scanned: '4h ago',  critical: 5, high: 11, medium: 18, status: 'failing' },
  { id: 4, name: 'frontend-app',     tag: 'v4.2.0', registry: 'ghcr.io',   size: '98 MB',  os: 'nginx:alpine', scanned: '1d ago',  critical: 0, high: 1,  medium: 4,  status: 'passing' },
  { id: 5, name: 'notification-svc', tag: 'v1.2.0', registry: 'ghcr.io',   size: '156 MB', os: 'alpine:3.18',  scanned: '2d ago',  critical: 0, high: 0,  medium: 3,  status: 'passing' },
  { id: 6, name: 'data-pipeline',    tag: 'v2.0.5', registry: 'ecr.aws',   size: '892 MB', os: 'python:3.11',  scanned: '3d ago',  critical: 2, high: 6,  medium: 9,  status: 'failing' },
]

const vulns = [
  { pkg: 'openssl',      version: '3.0.7',  fixIn: '3.0.8',   cve: 'CVE-2023-0464',  cvss: 7.5,  severity: 'high',     image: 'api-gateway',   type: 'OS' },
  { pkg: 'libcurl',      version: '7.88.1', fixIn: '8.0.0',   cve: 'CVE-2023-28319', cvss: 9.1,  severity: 'critical', image: 'api-gateway',   type: 'OS' },
  { pkg: 'log4j-core',   version: '2.14.0', fixIn: '2.17.1',  cve: 'CVE-2021-44228', cvss: 10.0, severity: 'critical', image: 'payment-ms',    type: 'Lib' },
  { pkg: 'python',       version: '3.10.6', fixIn: '3.10.13', cve: 'CVE-2023-40217', cvss: 5.3,  severity: 'medium',   image: 'auth-service',  type: 'OS' },
  { pkg: 'nginx',        version: '1.23.0', fixIn: '1.25.3',  cve: 'CVE-2023-44487', cvss: 7.5,  severity: 'high',     image: 'frontend-app',  type: 'OS' },
  { pkg: 'express',      version: '4.17.1', fixIn: '4.18.2',  cve: 'CVE-2022-24999', cvss: 7.5,  severity: 'high',     image: 'api-gateway',   type: 'Lib' },
  { pkg: 'cryptography', version: '3.4.8',  fixIn: '41.0.3',  cve: 'CVE-2023-38325', cvss: 7.5,  severity: 'high',     image: 'data-pipeline', type: 'Lib' },
]

const sevConfig: Record<string,{color:string;bg:string}> = {
  critical:{color:'#FF6B6B',bg:'rgba(192,55,42,0.15)'},
  high:    {color:'#FFB020',bg:'rgba(184,106,0,0.15)'},
  medium:  {color:'#4D9FFF',bg:'rgba(27,127,255,0.15)'},
  low:     {color:'rgba(255,255,255,0.4)',bg:'rgba(255,255,255,0.07)'},
}
const statusConfig: Record<string,{color:string;bg:string;label:string}> = {
  failing:{color:'#FF6B6B',bg:'rgba(192,55,42,0.12)',label:'✗ Failing'},
  warning:{color:'#FFB020',bg:'rgba(184,106,0,0.12)',label:'⚠ Warning'},
  passing:{color:'#00E576',bg:'rgba(0,229,118,0.10)',label:'✓ Passing'},
}

export default function ContainerPage() {
  const [activeTab, setActiveTab] = useState('images')
  const [scanning, setScanning] = useState(false)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',fontFamily:'var(--body)'}}>
      {/* TOP BAR */}
      <div style={{height:56,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'var(--bg)'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'rgba(255,255,255,0.35)'}}>
          <Link href="/dashboard" style={{color:'rgba(255,255,255,0.35)',textDecoration:'none'}}>Dashboard</Link>
          <span>/</span>
          <span style={{color:'#F0F4FF',fontWeight:500}}>Container Scan</span>
          <span style={{fontSize:9,padding:'1px 6px',borderRadius:4,background:'rgba(27,127,255,0.15)',color:'#4D9FFF',marginLeft:4}}>Phase 3</span>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button style={{padding:'7px 12px',borderRadius:7,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer'}}>Export CSV</button>
          <button onClick={()=>{setScanning(true);setTimeout(()=>setScanning(false),3000)}} disabled={scanning}
            style={{padding:'7px 16px',borderRadius:7,border:'none',background:scanning?'rgba(27,127,255,0.5)':'#1B7FFF',color:'#fff',fontSize:12,fontWeight:600,cursor:scanning?'not-allowed':'pointer',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:6}}>
            {scanning?<><span style={{display:'inline-block',width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Scanning...</>:'⟳ Scan Images'}
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:20,background:'rgba(6,13,24,0.8)'}}>
        {/* STAT CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
          {[
            {label:'Images Scanned',value:'6',  color:'#F0F4FF',sub:'across 3 registries'},
            {label:'Critical CVEs', value:'10', color:'#FF6B6B',sub:'in 3 images'},
            {label:'High CVEs',     value:'30', color:'#FFB020',sub:'across all images'},
            {label:'Images Passing',value:'2',  color:'#00E576',sub:'of 6 scanned'},
          ].map(s=>(
            <div key={s.label} style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'14px 16px'}}>
              <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.6px',color:'rgba(255,255,255,0.35)',marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:28,fontWeight:300,color:s.color,letterSpacing:'-1px',lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:5}}>{s.sub}</div>
              <div style={{marginTop:10,height:3,borderRadius:2,background:s.color,width:28}}/>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',marginBottom:16}}>
          {[{key:'images',label:'Images'},{key:'vulns',label:'Vulnerabilities'}].map(t=>(
            <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{padding:'10px 16px',fontSize:12,fontWeight:activeTab===t.key?500:400,color:activeTab===t.key?'#F0F4FF':'rgba(255,255,255,0.35)',background:'none',border:'none',borderBottom:`2px solid ${activeTab===t.key?'#1B7FFF':'transparent'}`,cursor:'pointer',fontFamily:'var(--body)'}}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab==='images'&&(
          <div style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 80px 110px 120px 70px 70px 70px 80px 90px',padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
              {['Image','Tag','Registry','Base OS','Critical','High','Medium','Size','Status'].map(h=>(
                <div key={h} style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.5px',color:'rgba(255,255,255,0.3)'}}>{h}</div>
              ))}
            </div>
            {images.map((img,i)=>{
              const st=statusConfig[img.status]
              return(
                <div key={img.id} style={{display:'grid',gridTemplateColumns:'2fr 80px 110px 120px 70px 70px 70px 80px 90px',padding:'12px 16px',alignItems:'center',borderBottom:i<images.length-1?'1px solid rgba(255,255,255,0.04)':'none',transition:'background .12s'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:16}}>🐳</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:500,color:'#F0F4FF'}}>{img.name}</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:1}}>Scanned {img.scanned}</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,fontFamily:'var(--mono)',color:'#4D9FFF'}}>{img.tag}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{img.registry}</div>
                  <div style={{fontSize:10,fontFamily:'var(--mono)',color:'rgba(255,255,255,0.4)'}}>{img.os}</div>
                  <div style={{fontSize:13,fontWeight:500,color:img.critical>0?'#FF6B6B':'rgba(255,255,255,0.25)'}}>{img.critical}</div>
                  <div style={{fontSize:13,fontWeight:500,color:img.high>0?'#FFB020':'rgba(255,255,255,0.25)'}}>{img.high}</div>
                  <div style={{fontSize:13,fontWeight:500,color:img.medium>0?'#4D9FFF':'rgba(255,255,255,0.25)'}}>{img.medium}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{img.size}</div>
                  <div><span style={{fontSize:10,fontWeight:500,padding:'2px 8px',borderRadius:10,background:st.bg,color:st.color}}>{st.label}</span></div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab==='vulns'&&(
          <div style={{background:'rgba(13,27,46,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 80px 110px 110px 140px 70px 90px',padding:'9px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
              {['Package','Type','Version','Fix In','CVE','CVSS','Severity'].map(h=>(
                <div key={h} style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.5px',color:'rgba(255,255,255,0.3)'}}>{h}</div>
              ))}
            </div>
            {vulns.map((v,i)=>{
              const sev=sevConfig[v.severity]
              return(
                <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 80px 110px 110px 140px 70px 90px',padding:'11px 16px',alignItems:'center',borderBottom:i<vulns.length-1?'1px solid rgba(255,255,255,0.04)':'none',transition:'background .12s'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div>
                    <div style={{fontSize:12,fontWeight:500,color:'#F0F4FF'}}>{v.pkg}</div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',fontFamily:'var(--mono)',marginTop:2}}>{v.image}</div>
                  </div>
                  <div><span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:v.type==='OS'?'rgba(0,212,255,0.1)':'rgba(27,127,255,0.1)',color:v.type==='OS'?'#00D4FF':'#4D9FFF'}}>{v.type}</span></div>
                  <div style={{fontSize:11,fontFamily:'var(--mono)',color:'#FF6B6B'}}>{v.version}</div>
                  <div style={{fontSize:11,fontFamily:'var(--mono)',color:'#00E576'}}>{v.fixIn}</div>
                  <div style={{fontSize:11,fontFamily:'var(--mono)',color:'#4D9FFF'}}>{v.cve}</div>
                  <div style={{fontSize:13,fontWeight:500,color:v.cvss>=9?'#FF6B6B':v.cvss>=7?'#FFB020':'#4D9FFF'}}>{v.cvss}</div>
                  <div><span style={{fontSize:10,fontWeight:500,padding:'2px 8px',borderRadius:10,background:sev.bg,color:sev.color}}>{v.severity}</span></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
