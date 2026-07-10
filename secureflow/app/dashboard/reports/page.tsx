'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import StatCard from '@/components/dashboard/StatCard'

const BACKEND_URL = 'http://127.0.0.1:8000'

type Report = {
  id: number             // this is the scan_id
  project_id: number
  project_name: string
  repo_url: string | null
  scan_type: string
  status: string
  started_at: string
  finished_at: string | null
  findings_count: number
}

type Project = { id: number; name: string }

const scanTypeLabels: Record<string, string> = {
  sast: 'SAST', sca: 'SCA', iac: 'IaC', secrets: 'Secrets',
}

const scanTypeColors: Record<string, { color: string; bg: string }> = {
  sast:    { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)' },
  sca:     { color: '#00E576', bg: 'rgba(0,229,118,0.10)' },
  iac:     { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)' },
  secrets: { color: '#FFB020', bg: 'rgba(184,106,0,0.15)' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

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
        const res = await fetch(`${BACKEND_URL}/api/reports?${params.toString()}`)
        if (!res.ok) throw new Error(`Backend error ${res.status}`)
        const data = await res.json()
        if (!cancelled) setReports(data.reports || [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectFilter])

  async function downloadReport(scanId: number, scanType: string, projectName: string) {
    setDownloadingId(scanId)
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports/${scanId}/pdf`)
      if (!res.ok) throw new Error(`Backend error ${res.status}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `secureflow_${scanType}_${projectName}_scan${scanId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  const totalFindings = reports.reduce((sum, r) => sum + r.findings_count, 0)
  const completed = reports.filter(r => r.status === 'completed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Reports</span>
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

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total scans" value={reports.length} accentColor="#1B7FFF" />
          <StatCard label="Completed" value={completed} accentColor="#00E576" />
          <StatCard label="Total findings across scans" value={totalFindings} accentColor="#FFB020" />
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(192,55,42,0.12)', color: '#FF6B6B', fontSize: 12, marginBottom: 16 }}>
            {error} — is the backend running at {BACKEND_URL}?
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
          Scan reports ({reports.length})
        </div>

        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {loading && (
            <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading reports…</div>
          )}

          {!loading && reports.length === 0 && !error && (
            <div style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              No scans yet — run a scan from SAST, SCA, IaC, or Secrets to generate a report.
            </div>
          )}

          {!loading && reports.map((r, i) => {
            const tc = scanTypeColors[r.scan_type] || { color: '#aaa', bg: 'rgba(255,255,255,0.07)' }
            const isDownloading = downloadingId === r.id
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < reports.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 44, height: 44, borderRadius: 9, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: tc.color, flexShrink: 0, fontFamily: 'var(--mono)' }}>
                  {scanTypeLabels[r.scan_type] || r.scan_type}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4FF' }}>
                    {r.project_name} — {scanTypeLabels[r.scan_type] || r.scan_type} scan
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{formatDate(r.started_at)}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{r.findings_count} findings</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                    <span style={{ fontSize: 10, color: r.status === 'completed' ? '#00E576' : r.status === 'failed' ? '#FF6B6B' : 'rgba(255,255,255,0.4)' }}>{r.status}</span>
                  </div>
                </div>
                <button
                  onClick={() => downloadReport(r.id, r.scan_type, r.project_name)}
                  disabled={isDownloading || r.status !== 'completed'}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: r.status !== 'completed' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', fontSize: 11, cursor: r.status !== 'completed' ? 'not-allowed' : 'pointer', fontFamily: 'var(--body)', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .15s' }}
                >
                  {isDownloading ? 'Generating…' : '↓ Download PDF'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
