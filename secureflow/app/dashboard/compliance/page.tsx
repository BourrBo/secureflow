'use client'
import { useState } from 'react'
import Link from 'next/link'

const frameworks = [
  { name: 'SOC 2 Type II',   score: 78, status: 'on-track',  controls: 42, passing: 33, failing: 9,  color: '#00E576', due: 'Aug 2025' },
  { name: 'ISO 27001',       score: 61, status: 'at-risk',   controls: 38, passing: 23, failing: 15, color: '#FFB020', due: 'Dec 2025' },
  { name: 'NIST CSF',        score: 83, status: 'on-track',  controls: 55, passing: 46, failing: 9,  color: '#00E576', due: 'Ongoing' },
  { name: 'OWASP ASVS',      score: 44, status: 'failing',   controls: 60, passing: 26, failing: 34, color: '#FF6B6B', due: 'Q3 2025' },
  { name: 'PCI DSS v4.0',    score: 72, status: 'in-progress',controls: 51, passing: 37, failing: 14, color: '#4D9FFF', due: 'Oct 2025' },
  { name: 'CIS Benchmarks',  score: 91, status: 'passing',   controls: 33, passing: 30, failing: 3,  color: '#00E576', due: 'Ongoing' },
]

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  'on-track':    { color: '#00E576', bg: 'rgba(0,229,118,0.1)',    label: 'On Track' },
  'at-risk':     { color: '#FFB020', bg: 'rgba(184,106,0,0.12)',   label: 'At Risk' },
  'failing':     { color: '#FF6B6B', bg: 'rgba(192,55,42,0.12)',   label: 'Failing' },
  'in-progress': { color: '#4D9FFF', bg: 'rgba(27,127,255,0.12)', label: 'In Progress' },
  'passing':     { color: '#00E576', bg: 'rgba(0,229,118,0.1)',    label: 'Passing' },
}

const owaspControls = [
  { cat: 'A01 — Broken Access Control',     total: 12, passing: 9,  failing: 3,  pct: 75, trend: 'up' },
  { cat: 'A02 — Cryptographic Failures',    total: 8,  passing: 6,  failing: 2,  pct: 75, trend: 'same' },
  { cat: 'A03 — Injection',                 total: 15, passing: 7,  failing: 8,  pct: 47, trend: 'down' },
  { cat: 'A04 — Insecure Design',           total: 10, passing: 6,  failing: 4,  pct: 60, trend: 'up' },
  { cat: 'A05 — Security Misconfiguration', total: 20, passing: 18, failing: 2,  pct: 90, trend: 'up' },
  { cat: 'A06 — Vulnerable Components',     total: 14, passing: 8,  failing: 6,  pct: 57, trend: 'down' },
  { cat: 'A07 — Auth & Auth Failures',      total: 10, passing: 5,  failing: 5,  pct: 50, trend: 'same' },
  { cat: 'A08 — Software Integrity',        total: 9,  passing: 8,  failing: 1,  pct: 89, trend: 'up' },
  { cat: 'A09 — Logging & Monitoring',      total: 8,  passing: 5,  failing: 3,  pct: 63, trend: 'same' },
  { cat: 'A10 — SSRF',                      total: 6,  passing: 4,  failing: 2,  pct: 67, trend: 'up' },
]

const recentReports = [
  { name: 'SOC 2 Executive Summary',  date: 'May 21, 2025', type: 'PDF', size: '2.4 MB' },
  { name: 'OWASP Top 10 Coverage',    date: 'May 18, 2025', type: 'PDF', size: '1.8 MB' },
  { name: 'ISO 27001 Gap Analysis',   date: 'May 15, 2025', type: 'PDF', size: '3.1 MB' },
  { name: 'Q1 2025 Security Report',  date: 'Apr 01, 2025', type: 'PDF', size: '4.2 MB' },
  { name: 'Full Vulnerability Export', date: 'May 20, 2025', type: 'CSV', size: '0.9 MB' },
]

export default function CompliancePage() {
  const [activeFramework, setActiveFramework] = useState('OWASP ASVS')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => setGenerating(false), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Compliance & Reports</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Export PDF</button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: generating ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {generating
              ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Generating...</>
              : '+ Generate Report'}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Overall posture */}
        <div style={{ marginBottom: 16, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Compliance posture — all frameworks
        </div>

        {/* Framework cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {frameworks.map((f) => {
            const st = statusConfig[f.status]
            const isActive = activeFramework === f.name
            return (
              <div
                key={f.name}
                onClick={() => setActiveFramework(f.name)}
                style={{ background: 'rgba(13,27,46,0.8)', border: `1px solid ${isActive ? 'rgba(27,127,255,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color .15s', boxShadow: isActive ? '0 0 20px rgba(27,127,255,0.1)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.name}</div>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 300, color: f.color, letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>{f.score}%</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${f.score}%`, background: f.color, borderRadius: 2, transition: 'width .6s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  <span><span style={{ color: '#00E576' }}>{f.passing}</span> passing</span>
                  <span><span style={{ color: '#FF6B6B' }}>{f.failing}</span> failing</span>
                  <span>Due: {f.due}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>

          {/* OWASP Top 10 table */}
          <div>
            <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              OWASP Top 10 — control coverage
            </div>
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 60px 60px 60px 120px 40px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Category', 'Controls', 'Pass', 'Fail', 'Coverage', ''].map((h) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
                ))}
              </div>
              {owaspControls.map((c, i) => {
                const barColor = c.pct >= 80 ? '#00E576' : c.pct >= 60 ? '#FFB020' : '#FF6B6B'
                const trend = c.trend === 'up' ? { icon: '▲', color: '#00E576' } : c.trend === 'down' ? { icon: '▼', color: '#FF6B6B' } : { icon: '—', color: 'rgba(255,255,255,0.3)' }
                return (
                  <div key={c.cat} style={{ display: 'grid', gridTemplateColumns: '3fr 60px 60px 60px 120px 40px', padding: '10px 16px', alignItems: 'center', borderBottom: i < owaspControls.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontSize: 12, color: '#F0F4FF', fontWeight: 400 }}>{c.cat}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{c.total}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#00E576', textAlign: 'center' }}>{c.passing}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#FF6B6B', textAlign: 'center' }}>{c.failing}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${c.pct}%`, background: barColor, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: barColor, minWidth: 28, textAlign: 'right' }}>{c.pct}%</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: trend.color }}>{trend.icon}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Selected framework detail */}
            {(() => {
              const f = frameworks.find((x) => x.name === activeFramework)!
              const st = statusConfig[f.status]
              return (
                <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 14 }}>
                    {f.name} — Detail
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ fontSize: 40, fontWeight: 300, color: f.color, letterSpacing: '-2px' }}>{f.score}%</div>
                    <div>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 500 }}>{st.label}</span>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>Audit due: {f.due}</div>
                    </div>
                  </div>
                  {[
                    { label: 'Total controls', val: f.controls },
                    { label: 'Passing',        val: f.passing,  color: '#00E576' },
                    { label: 'Failing',        val: f.failing,  color: '#FF6B6B' },
                    { label: 'Coverage',       val: `${f.score}%`, color: f.color },
                  ].map((row) => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                      <span style={{ fontWeight: 500, color: row.color || '#F0F4FF' }}>{row.val}</span>
                    </div>
                  ))}
                  <button style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', marginTop: 14 }}>
                    Download {f.name} Report →
                  </button>
                </div>
              )
            })()}

            {/* Recent reports */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 12 }}>Recent reports</div>
              {recentReports.map((r, i) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentReports.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: r.type === 'PDF' ? 'rgba(192,55,42,0.15)' : 'rgba(0,229,118,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: r.type === 'PDF' ? '#FF6B6B' : '#00E576', flexShrink: 0 }}>{r.type}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#F0F4FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{r.date} · {r.size}</div>
                  </div>
                  <button style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>↓</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
