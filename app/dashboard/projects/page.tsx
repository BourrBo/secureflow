'use client'
import Link from 'next/link'

const projects = [
  { id: 1, name: 'api-gateway',      lang: 'Node.js',    files: 142, branch: 'main',    lastScan: '2h ago',   score: 38, critical: 8,  high: 14, medium: 22, status: 'failing' },
  { id: 2, name: 'auth-service',     lang: 'Python',     files: 87,  branch: 'main',    lastScan: '4h ago',   score: 55, critical: 0,  high: 9,  medium: 14, status: 'warning' },
  { id: 3, name: 'payment-ms',       lang: 'Java',       files: 214, branch: 'develop', lastScan: '3d ago',   score: 61, critical: 0,  high: 6,  medium: 11, status: 'warning' },
  { id: 4, name: 'frontend-app',     lang: 'React / TS', files: 312, branch: 'main',    lastScan: '1d ago',   score: 78, critical: 0,  high: 2,  medium: 8,  status: 'passing' },
  { id: 5, name: 'infra-terraform',  lang: 'Terraform',  files: 44,  branch: 'main',    lastScan: '5h ago',   score: 65, critical: 0,  high: 4,  medium: 17, status: 'warning' },
  { id: 6, name: 'notification-svc', lang: 'Go',         files: 63,  branch: 'main',    lastScan: '2d ago',   score: 91, critical: 0,  high: 0,  medium: 3,  status: 'passing' },
  { id: 7, name: 'data-pipeline',    lang: 'Python',     files: 98,  branch: 'staging', lastScan: '6d ago',   score: 44, critical: 3,  high: 8,  medium: 12, status: 'failing' },
  { id: 8, name: 'mobile-backend',   lang: 'Node.js',    files: 176, branch: 'main',    lastScan: '1d ago',   score: 72, critical: 0,  high: 3,  medium: 9,  status: 'passing' },
]

const statusConfig = {
  failing: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.12)', label: 'Failing' },
  warning: { color: '#FFB020', bg: 'rgba(184,106,0,0.12)', label: 'Warning' },
  passing: { color: '#00E576', bg: 'rgba(0,229,118,0.10)', label: 'Passing' },
}

export default function ProjectsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>Projects</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 12px', width: 200 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>⌕</span>
            <input placeholder="Search projects…" style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#F0F4FF', width: '100%', fontFamily: 'var(--body)' }} />
          </div>
          <button style={{ fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, background: '#1B7FFF', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 0 16px rgba(27,127,255,0.3)' }}>
            + Connect Repo
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Projects', value: '14', color: '#1B7FFF' },
            { label: 'Failing',        value: '3',  color: '#FF3B5C' },
            { label: 'Warning',        value: '4',  color: '#FFB020' },
            { label: 'Passing',        value: '7',  color: '#00E576' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px' }}>{s.value}</div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
            </div>
          ))}
        </div>

        {/* Projects table */}
        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 80px 90px 90px', gap: 0, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {['Project', 'Language', 'Branch', 'Critical', 'High', 'Medium', 'Score', 'Status'].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {/* Table rows */}
          {projects.map((p, i) => {
            const sc = statusConfig[p.status as keyof typeof statusConfig]
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px 80px 90px 90px',
                  padding: '12px 16px', borderBottom: i < projects.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  textDecoration: 'none', transition: 'background .12s', alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Name */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F0F4FF' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{p.files} files · last scan {p.lastScan}</div>
                </div>
                {/* Lang */}
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{p.lang}</div>
                {/* Branch */}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>{p.branch}</div>
                {/* Critical */}
                <div style={{ fontSize: 13, fontWeight: 500, color: p.critical > 0 ? '#FF6B6B' : 'rgba(255,255,255,0.25)' }}>{p.critical}</div>
                {/* High */}
                <div style={{ fontSize: 13, fontWeight: 500, color: p.high > 0 ? '#FFB020' : 'rgba(255,255,255,0.25)' }}>{p.high}</div>
                {/* Medium */}
                <div style={{ fontSize: 13, fontWeight: 500, color: p.medium > 0 ? '#4D9FFF' : 'rgba(255,255,255,0.25)' }}>{p.medium}</div>
                {/* Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.score}%`, background: p.score >= 80 ? '#00E576' : p.score >= 60 ? '#FFB020' : '#FF3B5C', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 24 }}>{p.score}</span>
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
