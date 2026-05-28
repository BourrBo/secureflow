'use client'
import { useState } from 'react'
import Link from 'next/link'

const secrets = [
  { id: 1,  type: 'AWS Access Key',        value: 'AKIA••••••••••••WXYZ', file: 'config/aws.js',          line: 12,  branch: 'main',    commit: 'a3f1c92', project: 'api-gateway',    severity: 'critical', status: 'active',   foundAt: '2h ago' },
  { id: 2,  type: 'AWS Secret Key',        value: 'wJalr••••••••••••••••', file: 'config/aws.js',          line: 13,  branch: 'main',    commit: 'a3f1c92', project: 'api-gateway',    severity: 'critical', status: 'active',   foundAt: '2h ago' },
  { id: 3,  type: 'GitHub Personal Token', value: 'ghp_••••••••••••••••••', file: '.env.development',      line: 8,   branch: 'develop', commit: 'b7e2d41', project: 'auth-service',   severity: 'critical', status: 'revoked',  foundAt: '1d ago' },
  { id: 4,  type: 'Stripe Secret Key',     value: 'sk_live_••••••••••••••', file: 'services/payment.js',   line: 3,   branch: 'main',    commit: 'c9f3a11', project: 'payment-ms',    severity: 'critical', status: 'active',   foundAt: '3d ago' },
  { id: 5,  type: 'JWT Secret',            value: 'mysupersecretkey••••••', file: 'middleware/auth.js',     line: 7,   branch: 'main',    commit: 'd1e4b22', project: 'auth-service',   severity: 'high',     status: 'active',   foundAt: '3d ago' },
  { id: 6,  type: 'Database Password',     value: 'postgres://admin:••••••', file: 'config/database.js',   line: 4,   branch: 'main',    commit: 'e5f6c33', project: 'api-gateway',    severity: 'high',     status: 'active',   foundAt: '5d ago' },
  { id: 7,  type: 'Slack Webhook URL',     value: 'https://hooks.slack.com/••', file: 'utils/notify.js',  line: 2,   branch: 'main',    commit: 'f7a8d44', project: 'notification-svc',severity: 'medium',   status: 'revoked',  foundAt: '1w ago' },
  { id: 8,  type: 'SendGrid API Key',      value: 'SG.••••••••••••••••••••', file: 'services/email.js',    line: 1,   branch: 'staging', commit: 'a9b0e55', project: 'notification-svc',severity: 'high',     status: 'active',   foundAt: '1w ago' },
  { id: 9,  type: 'Google OAuth Secret',   value: 'GOCSPX-••••••••••••••', file: '.env.local',             line: 15,  branch: 'main',    commit: 'b1c2f66', project: 'frontend-app',   severity: 'high',     status: 'active',   foundAt: '2w ago' },
  { id: 10, type: 'Private RSA Key',       value: '-----BEGIN RSA••••••', file: 'keys/private.pem',        line: 1,   branch: 'main',    commit: 'c3d4a77', project: 'auth-service',   severity: 'critical', status: 'active',   foundAt: '2w ago' },
]

const sevConfig: Record<string, { color: string; bg: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)' },
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active:  { color: '#FF6B6B', bg: 'rgba(192,55,42,0.12)', label: '⚠ Active' },
  revoked: { color: '#00E576', bg: 'rgba(0,229,118,0.10)', label: '✓ Revoked' },
}

const typeIcons: Record<string, string> = {
  'AWS Access Key': '🟠', 'AWS Secret Key': '🟠', 'GitHub Personal Token': '⚫',
  'Stripe Secret Key': '💳', 'JWT Secret': '🔑', 'Database Password': '🗄',
  'Slack Webhook URL': '💬', 'SendGrid API Key': '📧', 'Google OAuth Secret': '🔵',
  'Private RSA Key': '🔐',
}

const tabs = [
  { key: 'all',      label: 'All',      count: 10 },
  { key: 'critical', label: 'Critical', count: 4 },
  { key: 'active',   label: 'Active',   count: 8 },
  { key: 'revoked',  label: 'Revoked',  count: 2 },
]

export default function SecretsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [scanning, setScanning] = useState(false)

  const filtered = secrets.filter((s) => {
    if (activeTab === 'critical') return s.severity === 'critical'
    if (activeTab === 'active')   return s.status === 'active'
    if (activeTab === 'revoked')  return s.status === 'revoked'
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Secrets Detection</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Export CSV</button>
          <button
            onClick={() => { setScanning(true); setTimeout(() => setScanning(false), 3000) }}
            disabled={scanning}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {scanning
              ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Scanning history...</>
              : '⟳ Scan History'}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Alert banner */}
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(192,55,42,0.1)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <span style={{ color: '#FF6B6B', fontWeight: 500 }}>2 live AWS credentials detected</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>in api-gateway main branch. Rotate immediately to prevent unauthorized access.</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#FF6B6B', fontWeight: 500, whiteSpace: 'nowrap' }}>Rotate now →</span>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Secrets',    value: '10', color: '#F0F4FF', sub: 'across 5 projects' },
            { label: 'Active / Live',    value: '8',  color: '#FF6B6B', sub: '▲ 2 found today' },
            { label: 'Critical',         value: '4',  color: '#FF6B6B', sub: 'AWS + Stripe + RSA' },
            { label: 'Revoked / Fixed',  value: '2',  color: '#00E576', sub: 'GitHub + Slack' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>{s.sub}</div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
            </div>
          ))}
        </div>

        {/* TABLE */}
        <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '12px 14px', fontSize: 12, fontWeight: activeTab === t.key ? 500 : 400, color: activeTab === t.key ? '#F0F4FF' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? '#1B7FFF' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--body)' }}>
                {t.label}
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: activeTab === t.key ? 'rgba(27,127,255,0.2)' : 'rgba(255,255,255,0.07)', color: activeTab === t.key ? '#4D9FFF' : 'rgba(255,255,255,0.3)' }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 80px 100px 90px 80px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {['Secret Type', 'File · Line', 'Project', 'Branch', 'Commit', 'Status', 'Severity'].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((s, i) => {
            const sev = sevConfig[s.severity]
            const st  = statusConfig[s.status]
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 80px 100px 90px 80px', padding: '12px 16px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{typeIcons[s.type] || '🔑'}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{s.type}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{s.value}</div>
                  </div>
                </div>
                {/* File */}
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#4D9FFF' }}>{s.file}:{s.line}</div>
                {/* Project */}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{s.project}</div>
                {/* Branch */}
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{s.branch}</div>
                {/* Commit */}
                <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#4D9FFF' }}>{s.commit}</div>
                {/* Status */}
                <div><span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span></div>
                {/* Severity */}
                <div><span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color }}>{s.severity}</span></div>
              </div>
            )
          })}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
