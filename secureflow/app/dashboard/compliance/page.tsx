'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import StatCard from '@/components/dashboard/StatCard'

const BACKEND_URL = 'http://127.0.0.1:8000'

type Control = {
  control_id: string
  control_name: string
  control_description: string
  total_findings: number
  by_severity: Record<string, number>
}

type Project = { id: number; name: string }

function severityColor(sev: string): string {
  if (sev === 'CRITICAL') return '#FF6B6B'
  if (sev === 'HIGH') return '#FFB020'
  if (sev === 'MEDIUM') return '#4D9FFF'
  return 'rgba(255,255,255,0.4)'
}

export default function CompliancePage() {
  const [controls, setControls] = useState<Control[]>([])
  const [totalFindings, setTotalFindings] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedControl, setSelectedControl] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/projects`)
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (projectFilter !== 'all') params.set('project_id', projectFilter)
        const res = await fetch(`${BACKEND_URL}/api/compliance?${params.toString()}`)
        if (!res.ok) throw new Error(`Backend error ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setControls(data.controls || [])
          setTotalFindings(data.total_findings || 0)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load compliance data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectFilter])

  const detail = controls.find(c => c.control_id === selectedControl)
  const worstControl = [...controls].sort((a, b) => b.total_findings - a.total_findings)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Compliance — ISO/IEC 27001:2022</span>
        </div>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#F0F4FF', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'var(--body)' }}
        >
          <option value="all" style={{ background: '#0D1B2E' }}>All projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id} style={{ background: '#0D1B2E' }}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        <div style={{ marginBottom: 16, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Annex A control coverage — based on findings mapped by scan
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Controls triggered" value={controls.length} accentColor="#1B7FFF" />
          <StatCard label="Total mapped findings" value={totalFindings} accentColor="#FFB020" />
          <StatCard label="Most-triggered control" value={worstControl ? worstControl.control_id : '—'} sub={worstControl?.control_name} accentColor="#FF6B6B" />
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(192,55,42,0.12)', color: '#FF6B6B', fontSize: 12, marginBottom: 16 }}>
            {error} — is the backend running at {BACKEND_URL}?
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>

          {/* Controls table */}
          <div>
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Control', 'Findings', 'Severity breakdown'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
                ))}
              </div>

              {loading && (
                <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading compliance data…</div>
              )}

              {!loading && controls.length === 0 && !error && (
                <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  No findings mapped to any control yet — run a scan first.
                </div>
              )}

              {!loading && controls.map((c, i) => {
                const maxCount = Math.max(...Object.values(c.by_severity), 1)
                return (
                  <div
                    key={c.control_id}
                    onClick={() => setSelectedControl(c.control_id)}
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr', padding: '10px 16px', alignItems: 'center', borderBottom: i < controls.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer', background: selectedControl === c.control_id ? 'rgba(27,127,255,0.06)' : 'transparent' }}
                    onMouseEnter={(e) => { if (selectedControl !== c.control_id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={(e) => { if (selectedControl !== c.control_id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: '#F0F4FF', fontWeight: 500 }}>A.{c.control_id}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{c.control_name}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4FF', textAlign: 'center' }}>{c.total_findings}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => {
                        const count = c.by_severity[sev] || 0
                        if (!count) return null
                        return (
                          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: severityColor(sev) }} />
                            <span style={{ fontSize: 10, color: severityColor(sev) }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right column — selected control detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {detail ? (
              <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 6 }}>
                  A.{detail.control_id} — {detail.control_name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 14 }}>
                  {detail.control_description}
                </div>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => {
                  const count = detail.by_severity[sev] || 0
                  return (
                    <div key={sev} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                      <span style={{ color: severityColor(sev) }}>{sev}</span>
                      <span style={{ fontWeight: 500, color: '#F0F4FF' }}>{count}</span>
                    </div>
                  )
                })}
                <Link
                  href={`/dashboard/findings?severity=&project=`}
                  style={{ display: 'block', textAlign: 'center', width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginTop: 14 }}
                >
                  View findings for this control →
                </Link>
              </div>
            ) : (
              <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Click a control on the left to see its full description and severity detail.
              </div>
            )}

            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              Note: coverage shown here reflects only the controls your scanners have actually mapped findings to
              (via <code style={{ color: 'rgba(255,255,255,0.6)' }}>mappings/iso27001.py</code>) — it is not a full
              ISO/IEC 27001 Annex A audit across all 93 controls.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
