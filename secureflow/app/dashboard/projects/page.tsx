'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const BACKEND_URL = 'http://127.0.0.1:8000'

// ── Shape returned by GET /api/projects ──
type BackendProject = {
  id: number
  name: string
  source_type: string
  repo_url: string | null
  created_at: string
  scan_count: number
  last_scan_at: string | null
  open_findings_count: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
}

type Status = 'failing' | 'warning' | 'passing'

const statusConfig: Record<Status, { color: string; bg: string; label: string }> = {
  failing: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.12)', label: 'Failing' },
  warning: { color: '#FFB020', bg: 'rgba(184,106,0,0.12)', label: 'Warning' },
  passing: { color: '#00E576', bg: 'rgba(0,229,118,0.10)', label: 'Passing' },
}

// ── A project "fails" if it has any Critical, "warns" if any High, else passes ──
function deriveStatus(p: BackendProject): Status {
  if ((p.critical_count ?? 0) > 0) return 'failing'
  if ((p.high_count ?? 0) > 0) return 'warning'
  return 'passing'
}

// ── Simple weighted score until the backend computes one server-side ──
function deriveScore(p: BackendProject): number {
  const critical = p.critical_count ?? 0
  const high = p.high_count ?? 0
  const medium = p.medium_count ?? 0
  const score = 100 - critical * 15 - high * 5 - medium * 1
  return Math.max(0, Math.min(100, Math.round(score)))
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<BackendProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${BACKEND_URL}/api/projects`)
        if (!res.ok) throw new Error(`Backend error ${res.status}`)
        const data = await res.json()
        if (!cancelled) setProjects(data.projects || [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    total: projects.length,
    failing: projects.filter(p => deriveStatus(p) === 'failing').length,
    warning: projects.filter(p => deriveStatus(p) === 'warning').length,
    passing: projects.filter(p => deriveStatus(p) === 'passing').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>Projects</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 12px', width: 200 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#F0F4FF', width: '100%', fontFamily: 'var(--body)' }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Projects', value: String(counts.total),   color: '#1B7FFF' },
            { label: 'Failing',        value: String(counts.failing), color: '#FF3B5C' },
            { label: 'Warning',        value: String(counts.warning), color: '#FFB020' },
            { label: 'Passing',        value: String(counts.passing), color: '#00E576' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(192,55,42,0.12)', color: '#FF6B6B', fontSize: 12, marginBottom: 16 }}>
            {error} — is the backend running at {BACKEND_URL}?
          </div>
        )}

        {/* Projects table */}
        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px 80px 90px 90px', gap: 0, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {['Project', 'Source', 'Critical', 'High', 'Medium', 'Score', 'Status'].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {loading && (
            <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading projects…</div>
          )}

          {!loading && filtered.length === 0 && !error && (
            <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              No projects yet — run a scan from SAST, SCA, IaC, or Secrets to create one.
            </div>
          )}

          {/* Table rows */}
          {!loading && filtered.map((p, i) => {
            const status = deriveStatus(p)
            const sc = statusConfig[status]
            const score = deriveScore(p)
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px 80px 90px 90px',
                  padding: '12px 16px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  textDecoration: 'none', transition: 'background .12s', alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Name */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4FF' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    {p.scan_count} scan{p.scan_count === 1 ? '' : 's'} · last scan {relativeTime(p.last_scan_at)}
                  </div>
                </div>
                {/* Source */}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>
                  {p.source_type === 'git' ? 'GitHub' : 'Upload'}
                </div>
                {/* Critical */}
                <div style={{ fontSize: 13, fontWeight: 500, color: (p.critical_count ?? 0) > 0 ? '#FF6B6B' : 'rgba(255,255,255,0.25)' }}>{p.critical_count ?? 0}</div>
                {/* High */}
                <div style={{ fontSize: 13, fontWeight: 500, color: (p.high_count ?? 0) > 0 ? '#FFB020' : 'rgba(255,255,255,0.25)' }}>{p.high_count ?? 0}</div>
                {/* Medium */}
                <div style={{ fontSize: 13, fontWeight: 500, color: (p.medium_count ?? 0) > 0 ? '#4D9FFF' : 'rgba(255,255,255,0.25)' }}>{p.medium_count ?? 0}</div>
                {/* Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${score}%`, background: score >= 80 ? '#00E576' : score >= 60 ? '#FFB020' : '#FF3B5C', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 24 }}>{score}</span>
                </div>
                {/* Status */}
                <div>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 10, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
