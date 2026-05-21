'use client'
import { useState } from 'react'
import Link from 'next/link'

const findings = [
  { id: 1,  name: 'SQL Injection via user input',        owasp: 'A03:2021',  severity: 'critical', file: 'routes/user.js',       line: 142, cwe: 'CWE-89',  cvss: 9.1, status: 'open',     assignee: 'Rahul K.' },
  { id: 2,  name: 'Hardcoded JWT Secret Key',            owasp: 'A02:2021',  severity: 'critical', file: 'config/auth.js',        line: 18,  cwe: 'CWE-798', cvss: 8.6, status: 'open',     assignee: '—' },
  { id: 3,  name: 'Remote Code Execution via eval()',    owasp: 'A03:2021',  severity: 'critical', file: 'lib/parser.js',         line: 67,  cwe: 'CWE-78',  cvss: 9.8, status: 'open',     assignee: 'Priya S.' },
  { id: 4,  name: 'Prototype Pollution',                 owasp: 'A08:2021',  severity: 'critical', file: 'utils/merge.js',        line: 34,  cwe: 'CWE-1321',cvss: 9.0, status: 'inreview', assignee: 'Dev Team' },
  { id: 5,  name: 'Cross-Site Scripting (XSS)',          owasp: 'A03:2021',  severity: 'high',     file: 'views/dashboard.jsx',   line: 87,  cwe: 'CWE-79',  cvss: 7.4, status: 'inreview', assignee: 'Dev Team' },
  { id: 6,  name: 'Insecure Deserialization',            owasp: 'A08:2021',  severity: 'high',     file: 'lib/serializer.py',     line: 204, cwe: 'CWE-502', cvss: 7.8, status: 'resolved',  assignee: 'Priya S.' },
  { id: 7,  name: 'CORS Misconfiguration',               owasp: 'A05:2021',  severity: 'high',     file: 'middleware/cors.js',    line: 33,  cwe: 'CWE-942', cvss: 7.2, status: 'open',     assignee: '—' },
  { id: 8,  name: 'Missing Rate Limiting',               owasp: 'A04:2021',  severity: 'high',     file: 'routes/auth.js',        line: 61,  cwe: 'CWE-307', cvss: 7.5, status: 'open',     assignee: '—' },
  { id: 9,  name: 'Path Traversal Attack',               owasp: 'A01:2021',  severity: 'high',     file: 'api/files.js',          line: 29,  cwe: 'CWE-22',  cvss: 7.6, status: 'open',     assignee: 'Rahul K.' },
  { id: 10, name: 'Insecure Direct Object Reference',    owasp: 'A01:2021',  severity: 'high',     file: 'routes/orders.js',      line: 88,  cwe: 'CWE-639', cvss: 7.1, status: 'open',     assignee: '—' },
  { id: 11, name: 'Weak Password Policy',                owasp: 'A07:2021',  severity: 'medium',   file: 'services/auth.js',      line: 112, cwe: 'CWE-521', cvss: 5.3, status: 'open',     assignee: '—' },
  { id: 12, name: 'Sensitive Data in URL',               owasp: 'A02:2021',  severity: 'medium',   file: 'routes/api.js',         line: 45,  cwe: 'CWE-598', cvss: 5.9, status: 'open',     assignee: '—' },
  { id: 13, name: 'Unvalidated Redirect',                owasp: 'A01:2021',  severity: 'medium',   file: 'middleware/redirect.js',line: 22,  cwe: 'CWE-601', cvss: 6.1, status: 'inreview', assignee: 'Dev Team' },
  { id: 14, name: 'Console.log with Sensitive Data',    owasp: 'A09:2021',  severity: 'low',      file: 'services/payment.js',   line: 78,  cwe: 'CWE-532', cvss: 3.1, status: 'open',     assignee: '—' },
  { id: 15, name: 'Missing Security Headers',            owasp: 'A05:2021',  severity: 'low',      file: 'app.js',               line: 12,  cwe: 'CWE-693', cvss: 3.7, status: 'resolved',  assignee: 'Rahul K.' },
]

const sevConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)', label: 'Critical' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)', label: 'High' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)', label: 'Medium' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)', label: 'Low' },
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  open:     { color: '#FF6B6B', bg: 'rgba(192,55,42,0.12)', label: 'Open' },
  inreview: { color: '#FFB020', bg: 'rgba(184,106,0,0.12)', label: 'In Review' },
  resolved: { color: '#00E576', bg: 'rgba(0,229,118,0.10)', label: 'Resolved' },
}

const projects = ['All Projects', 'api-gateway', 'auth-service', 'payment-ms', 'frontend-app']
const tabs = [
  { key: 'all',      label: 'All',      count: 15 },
  { key: 'critical', label: 'Critical', count: 4 },
  { key: 'high',     label: 'High',     count: 6 },
  { key: 'medium',   label: 'Medium',   count: 3 },
  { key: 'resolved', label: 'Resolved', count: 2 },
]

export default function SASTPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedProject, setSelectedProject] = useState('All Projects')
  const [scanning, setScanning] = useState(false)
  const [selected, setSelected] = useState<number[]>([])

  const filtered = findings.filter((f) => {
    if (activeTab === 'critical') return f.severity === 'critical'
    if (activeTab === 'high')     return f.severity === 'high'
    if (activeTab === 'medium')   return f.severity === 'medium'
    if (activeTab === 'resolved') return f.status === 'resolved'
    return true
  })

  const toggleSelect = (id: number) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  const handleScan = () => {
    setScanning(true)
    setTimeout(() => setScanning(false), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* ── TOP BAR ── */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)', gap: 12 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>SAST Results</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          {/* Project selector */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#F0F4FF', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'var(--body)' }}
          >
            {projects.map((p) => <option key={p} value={p} style={{ background: '#0D1B2E' }}>{p}</option>)}
          </select>

          {/* Export */}
          <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--body)' }}>
            Export CSV
          </button>

          {/* Re-scan */}
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 0 16px rgba(27,127,255,0.25)' }}
          >
            {scanning ? (
              <>
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Scanning...
              </>
            ) : '⟳ Re-scan'}
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Scanning banner */}
        {scanning && (
          <div style={{ marginBottom: 14, padding: '10px 16px', background: 'rgba(27,127,255,0.08)', border: '1px solid rgba(27,127,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(27,127,255,0.3)', borderTopColor: '#4D9FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <span style={{ color: '#4D9FFF', fontWeight: 500 }}>Scanning api-gateway · main branch...</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Running Semgrep on 142 files</span>
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Critical', value: 4,  color: '#FF6B6B', sub: '▲ 2 new today' },
            { label: 'High',     value: 6,  color: '#FFB020', sub: '▲ 1 new today' },
            { label: 'Medium',   value: 3,  color: '#4D9FFF', sub: 'No change' },
            { label: 'Low',      value: 2,  color: 'rgba(255,255,255,0.4)', sub: 'No change' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>{s.sub}</div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
            </div>
          ))}
        </div>

        {/* ── BULK ACTIONS ── */}
        {selected.length > 0 && (
          <div style={{ marginBottom: 12, padding: '10px 16px', background: 'rgba(27,127,255,0.08)', border: '1px solid rgba(27,127,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span style={{ color: '#4D9FFF', fontWeight: 500 }}>{selected.length} finding{selected.length > 1 ? 's' : ''} selected</span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
              {['Assign', 'Create Jira Tickets', 'Mark Resolved', 'Suppress'].map((action) => (
                <button key={action} onClick={() => setSelected([])} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--body)' }}>
                  {action}
                </button>
              ))}
            </div>
            <button onClick={() => setSelected([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* ── FINDINGS TABLE ── */}
        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '12px 14px', fontSize: 12, fontWeight: activeTab === t.key ? 500 : 400,
                  color: activeTab === t.key ? '#F0F4FF' : 'rgba(255,255,255,0.35)',
                  background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? '#1B7FFF' : 'transparent'}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'var(--body)', transition: 'color .15s',
                }}
              >
                {t.label}
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: activeTab === t.key ? 'rgba(27,127,255,0.2)' : 'rgba(255,255,255,0.07)', color: activeTab === t.key ? '#4D9FFF' : 'rgba(255,255,255,0.3)' }}>
                  {t.count}
                </span>
              </button>
            ))}

            {/* Search in table */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '4px 10px' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>⌕</span>
                <input placeholder="Filter findings…" style={{ background: 'none', border: 'none', outline: 'none', fontSize: 11, color: '#F0F4FF', width: 140, fontFamily: 'var(--body)' }} />
              </div>
            </div>
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 3fr 90px 1.5fr 80px 70px 90px 100px 60px', gap: 0, padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <div />
            {['Vulnerability', 'Severity', 'File · Line', 'CWE', 'CVSS', 'Status', 'Assigned', ''].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {/* Table rows */}
          {filtered.map((f, i) => {
            const sev = sevConfig[f.severity]
            const st  = statusConfig[f.status]
            const isSelected = selected.includes(f.id)
            return (
              <div
                key={f.id}
                style={{
                  display: 'grid', gridTemplateColumns: '36px 3fr 90px 1.5fr 80px 70px 90px 100px 60px',
                  padding: '11px 16px', alignItems: 'center',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: isSelected ? 'rgba(27,127,255,0.06)' : 'transparent',
                  transition: 'background .12s',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Checkbox */}
                <div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(f.id)}
                    style={{ accentColor: '#1B7FFF', cursor: 'pointer', width: 14, height: 14 }}
                  />
                </div>

                {/* Name */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF', marginBottom: 2 }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--mono)' }}>{f.owasp}</div>
                </div>

                {/* Severity */}
                <div>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color }}>
                    {sev.label}
                  </span>
                </div>

                {/* File */}
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#4D9FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.file}:{f.line}
                </div>

                {/* CWE */}
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{f.cwe}</div>

                {/* CVSS */}
                <div style={{ fontSize: 13, fontWeight: 500, color: f.cvss >= 9 ? '#FF6B6B' : f.cvss >= 7 ? '#FFB020' : '#4D9FFF' }}>
                  {f.cvss}
                </div>

                {/* Status */}
                <div>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                {/* Assignee */}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f.assignee}</div>

                {/* View button */}
                <div>
                  <Link
                    href={`/dashboard/findings/${f.id}`}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block', transition: 'all .15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(27,127,255,0.4)'; e.currentTarget.style.color = '#4D9FFF' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                  >
                    View →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
