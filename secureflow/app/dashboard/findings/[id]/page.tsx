'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import StatCard from '@/components/dashboard/StatCard'
import SeverityBadge from '@/components/dashboard/SeverityBadge'

const BACKEND_URL = 'http://127.0.0.1:8000'

type Finding = {
  id: number
  scan_id: number
  project_id: number
  project_name: string
  scan_type: string
  title: string
  severity: string
  file: string | null
  line: number | null
  description: string | null
  rule: string | null
  cwe: string | null
  owasp: string | null
  scanner: string
  iso27001_control: string | null
  iso27001_control_name: string | null
  code_context: { ln: number; code: string; highlight?: boolean }[]
}

type Project = { id: number; name: string }

const scannerLabels: Record<string, string> = {
  semgrep: 'SAST · Semgrep',
  trivy: 'SCA · Trivy',
  checkov: 'IaC · Checkov',
  secrets: 'Secrets',
}

function toSeverityKey(s: string): 'critical' | 'high' | 'medium' | 'low' {
  const v = s?.toUpperCase()
  if (v === 'CRITICAL') return 'critical'
  if (v === 'HIGH') return 'high'
  if (v === 'MEDIUM') return 'medium'
  return 'low'
}

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [scannerFilter, setScannerFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<number | null>(null)

  // Load project list once, for the filter dropdown
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/projects`)
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(() => {})
  }, [])

  // Reload findings whenever a filter changes
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (projectFilter !== 'all') params.set('project_id', projectFilter)
        if (severityFilter !== 'all') params.set('severity', severityFilter)
        if (scannerFilter !== 'all') params.set('scanner', scannerFilter)

        const res = await fetch(`${BACKEND_URL}/api/findings?${params.toString()}`)
        if (!res.ok) throw new Error(`Backend error ${res.status}`)
        const data = await res.json()
        if (!cancelled) setFindings(data.findings || [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load findings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectFilter, severityFilter, scannerFilter])

  const counts = {
    total: findings.length,
    critical: findings.filter(f => toSeverityKey(f.severity) === 'critical').length,
    high: findings.filter(f => toSeverityKey(f.severity) === 'high').length,
    medium: findings.filter(f => toSeverityKey(f.severity) === 'medium').length,
  }

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)', color: '#F0F4FF', fontSize: 12,
    outline: 'none', cursor: 'pointer', fontFamily: 'var(--body)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Findings</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={selectStyle}>
            <option value="all" style={{ background: '#0D1B2E' }}>All projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id} style={{ background: '#0D1B2E' }}>{p.name}</option>
            ))}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="all" style={{ background: '#0D1B2E' }}>All severities</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
              <option key={s} value={s} style={{ background: '#0D1B2E' }}>{s}</option>
            ))}
          </select>
          <select value={scannerFilter} onChange={e => setScannerFilter(e.target.value)} style={selectStyle}>
            <option value="all" style={{ background: '#0D1B2E' }}>All scanners</option>
            {Object.entries(scannerLabels).map(([k, label]) => (
              <option key={k} value={k} style={{ background: '#0D1B2E' }}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total findings" value={counts.total} accentColor="#1B7FFF" />
          <StatCard label="Critical" value={counts.critical} accentColor="#FF6B6B" />
          <StatCard label="High" value={counts.high} accentColor="#FFB020" />
          <StatCard label="Medium" value={counts.medium} accentColor="#4D9FFF" />
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(192,55,42,0.12)', color: '#FF6B6B', fontSize: 12, marginBottom: 16 }}>
            {error} — is the backend running at {BACKEND_URL}?
          </div>
        )}

        {/* Findings table */}
        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 90px 100px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {['Finding', 'Project', 'Scanner', 'Severity', 'ISO Control'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {loading && (
            <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading findings…</div>
          )}

          {!loading && findings.length === 0 && !error && (
            <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              No findings match these filters.
            </div>
          )}

          {!loading && findings.map((f, i) => {
            const isOpen = expanded === f.id
            return (
              <div key={f.id} style={{ borderBottom: i < findings.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div
                  onClick={() => setExpanded(isOpen ? null : f.id)}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 90px 100px', padding: '12px 16px', alignItems: 'center', cursor: 'pointer', transition: 'background .12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4FF' }}>{f.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
                      {f.file || 'n/a'}{f.line ? `:${f.line}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{f.project_name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{scannerLabels[f.scanner] || f.scanner}</div>
                  <div><SeverityBadge severity={toSeverityKey(f.severity)} /></div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>{f.iso27001_control || '—'}</div>
                </div>

                {isOpen && (
                  <div style={{ padding: '4px 16px 16px 16px', background: 'rgba(255,255,255,0.015)' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10, lineHeight: 1.5 }}>
                      {f.description || 'No description available.'}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                      {f.cwe && <span>CWE: {f.cwe}</span>}
                      {f.owasp && <span>OWASP: {f.owasp}</span>}
                      {f.iso27001_control_name && <span>ISO {f.iso27001_control}: {f.iso27001_control_name}</span>}
                    </div>
                    {f.code_context && f.code_context.length > 0 && (
                      <div style={{ background: '#0A121F', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 0', fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {f.code_context.map(line => (
                          <div key={line.ln} style={{ display: 'flex', gap: 12, padding: '2px 14px', background: line.highlight ? 'rgba(255,107,107,0.08)' : 'transparent' }}>
                            <span style={{ color: 'rgba(255,255,255,0.25)', minWidth: 30, textAlign: 'right' }}>{line.ln}</span>
                            <span style={{ color: line.highlight ? '#FF6B6B' : 'rgba(255,255,255,0.6)', whiteSpace: 'pre' }}>{line.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
