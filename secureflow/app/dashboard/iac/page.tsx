'use client'
import { useState } from 'react'
import Link from 'next/link'

const issues = [
  { id: 1,  title: 'S3 Bucket Public Access Enabled',        resource: 'aws_s3_bucket.assets',         file: 'terraform/storage.tf',    line: 14,  severity: 'critical', category: 'Storage',   tool: 'KICS',    status: 'open',     cis: 'CIS 2.1.5' },
  { id: 2,  title: 'Security Group Allows All Inbound',      resource: 'aws_security_group.web',       file: 'terraform/networking.tf', line: 28,  severity: 'critical', category: 'Network',   tool: 'KICS',    status: 'open',     cis: 'CIS 5.2' },
  { id: 3,  title: 'RDS Instance Not Encrypted',             resource: 'aws_db_instance.main',         file: 'terraform/database.tf',   line: 9,   severity: 'critical', category: 'Database',  tool: 'KICS',    status: 'open',     cis: 'CIS 2.3.1' },
  { id: 4,  title: 'EKS Cluster Logging Disabled',           resource: 'aws_eks_cluster.main',         file: 'terraform/eks.tf',        line: 34,  severity: 'high',     category: 'Container', tool: 'KICS',    status: 'open',     cis: 'CIS 5.1' },
  { id: 5,  title: 'IAM Role with Admin Privileges',         resource: 'aws_iam_role.lambda_exec',     file: 'terraform/iam.tf',        line: 22,  severity: 'high',     category: 'IAM',       tool: 'KICS',    status: 'inreview', cis: 'CIS 1.16' },
  { id: 6,  title: 'CloudTrail Logging Disabled',            resource: 'aws_cloudtrail.main',          file: 'terraform/logging.tf',    line: 7,   severity: 'high',     category: 'Logging',   tool: 'KICS',    status: 'open',     cis: 'CIS 3.1' },
  { id: 7,  title: 'K8s Pod Runs as Root',                   resource: 'Deployment/api-gateway',       file: 'k8s/api-deployment.yaml', line: 45,  severity: 'high',     category: 'Container', tool: 'KICS',    status: 'open',     cis: 'CIS 5.2.6' },
  { id: 8,  title: 'K8s No Resource Limits Set',             resource: 'Deployment/auth-service',      file: 'k8s/auth-deployment.yaml',line: 33,  severity: 'medium',   category: 'Container', tool: 'KICS',    status: 'open',     cis: 'CIS 5.2' },
  { id: 9,  title: 'Helm Chart Default Values Used',         resource: 'Chart/nginx-ingress',          file: 'helm/values.yaml',        line: 1,   severity: 'medium',   category: 'Config',    tool: 'KICS',    status: 'resolved', cis: 'N/A' },
  { id: 10, title: 'ElastiCache Not Encrypted at Rest',      resource: 'aws_elasticache_cluster.redis',file: 'terraform/cache.tf',      line: 18,  severity: 'medium',   category: 'Storage',   tool: 'KICS',    status: 'open',     cis: 'CIS 2.6' },
  { id: 11, title: 'ALB HTTP Instead of HTTPS',              resource: 'aws_lb_listener.http',         file: 'terraform/alb.tf',        line: 12,  severity: 'medium',   category: 'Network',   tool: 'KICS',    status: 'resolved', cis: 'CIS 2.1' },
  { id: 12, title: 'VPC Flow Logs Disabled',                 resource: 'aws_vpc.main',                 file: 'terraform/vpc.tf',        line: 6,   severity: 'low',      category: 'Logging',   tool: 'KICS',    status: 'open',     cis: 'CIS 3.9' },
]

const sevConfig: Record<string, { color: string; bg: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)' },
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  open:     { color: '#FF6B6B', bg: 'rgba(192,55,42,0.12)', label: 'Open' },
  inreview: { color: '#FFB020', bg: 'rgba(184,106,0,0.12)', label: 'In Review' },
  resolved: { color: '#00E576', bg: 'rgba(0,229,118,0.10)', label: 'Resolved' },
}

const categoryColors: Record<string, string> = {
  Storage: '#FFB020', Network: '#FF6B6B', Database: '#4D9FFF',
  Container: '#00E576', IAM: '#FF3B5C', Logging: '#9D7FEA', Config: '#4D9FFF',
}

const tabs = [
  { key: 'all',      label: 'All',      count: 12 },
  { key: 'critical', label: 'Critical', count: 3 },
  { key: 'high',     label: 'High',     count: 4 },
  { key: 'medium',   label: 'Medium',   count: 4 },
  { key: 'resolved', label: 'Resolved', count: 2 },
]

export default function IaCPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [scanning, setScanning] = useState(false)

  const filtered = issues.filter((i) => {
    if (activeTab === 'critical') return i.severity === 'critical'
    if (activeTab === 'high')     return i.severity === 'high'
    if (activeTab === 'medium')   return i.severity === 'medium'
    if (activeTab === 'resolved') return i.status === 'resolved'
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>IaC Security</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Export CSV</button>
          <button
            onClick={() => { setScanning(true); setTimeout(() => setScanning(false), 3000) }}
            disabled={scanning}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {scanning
              ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Scanning...</>
              : '⟳ Scan IaC'}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* Alert banner */}
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(192,55,42,0.1)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ color: '#FF6B6B', fontWeight: 500 }}>S3 bucket publicly accessible</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>terraform/storage.tf — your assets bucket allows public reads. Fix before next deployment.</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#FF6B6B', fontWeight: 500, whiteSpace: 'nowrap' }}>View fix →</span>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Issues',  value: '12', color: '#F0F4FF', sub: 'across 6 files' },
            { label: 'Critical',      value: '3',  color: '#FF6B6B', sub: 'S3, SG, RDS' },
            { label: 'High',          value: '4',  color: '#FFB020', sub: 'EKS, IAM, K8s' },
            { label: 'Resolved',      value: '2',  color: '#00E576', sub: 'this sprint' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>{s.sub}</div>
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 16 }}>
          {Object.entries(categoryColors).map(([cat, color]) => {
            const count = issues.filter((i) => i.category === cat).length
            return (
              <div key={cat} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 3 }}>{count}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat}</div>
              </div>
            )
          })}
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
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1.5fr 90px 90px 80px 90px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            {['Issue', 'Resource', 'File · Line', 'Category', 'CIS Benchmark', 'Tool', 'Status'].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((issue, i) => {
            const sev = sevConfig[issue.severity]
            const st  = statusConfig[issue.status]
            const catColor = categoryColors[issue.category] || '#aaa'
            return (
              <div key={issue.id} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1.5fr 90px 90px 80px 90px', padding: '12px 16px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Title */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: sev.bg, color: sev.color }}>{issue.severity}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{issue.title}</span>
                  </div>
                </div>
                {/* Resource */}
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#4D9FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.resource}</div>
                {/* File */}
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.file}:{issue.line}</div>
                {/* Category */}
                <div><span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: `${catColor}18`, color: catColor }}>{issue.category}</span></div>
                {/* CIS */}
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{issue.cis}</div>
                {/* Tool */}
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{issue.tool}</div>
                {/* Status */}
                <div><span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span></div>
              </div>
            )
          })}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
