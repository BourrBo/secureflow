'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { ISO27001Badge, ViewStandardLink, ExportReportButton } from '@/components/dashboard/ISO27001'

// ── Types ──────────────────────────────────────────────────────────
interface Finding {
  title: string
  severity: string
  file: string
  line: number
  description: string
  rule: string
  cwe: string
  owasp: string
  scanner: string
  iso27001_control?:      string
  iso27001_control_name?: string
  iso27001_description?:  string
}

// ── Severity / status config ───────────────────────────────────────
const sevConfig: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)' },
  HIGH:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)' },
  MEDIUM:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)' },
  LOW:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)' },
  INFO:     { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.05)' },
}

function getSev(s: string) {
  return sevConfig[s?.toUpperCase()] ?? sevConfig['LOW']
}

// ── Derive a short "category" from file extension / path ───────────
function guessCategory(file: string): { label: string; color: string } {
  const f = file.toLowerCase()
  if (f.includes('k8s') || f.endsWith('.yaml') || f.endsWith('.yml'))
    return { label: 'K8s', color: '#00E576' }
  if (f.includes('docker'))
    return { label: 'Docker', color: '#4D9FFF' }
  if (f.includes('helm'))
    return { label: 'Helm', color: '#9D7FEA' }
  if (f.includes('terraform') || f.endsWith('.tf'))
    return { label: 'Terraform', color: '#FFB020' }
  if (f.includes('iam'))
    return { label: 'IAM', color: '#FF3B5C' }
  if (f.includes('cloudformation') || f.endsWith('.json'))
    return { label: 'CloudFormation', color: '#FF6B6B' }
  return { label: 'IaC', color: '#4D9FFF' }
}

// ── Stats helper ───────────────────────────────────────────────────
function countBySev(findings: Finding[], sev: string) {
  return findings.filter(f => f.severity?.toUpperCase() === sev).length
}

// ── Scan mode toggle ───────────────────────────────────────────────
type ScanMode = 'github' | 'local'

// ── Main component ─────────────────────────────────────────────────
export default function IaCPage() {
  const [scanMode, setScanMode]     = useState<ScanMode>('github')
  const [repoUrl, setRepoUrl]       = useState('')
  const [findings, setFindings]     = useState<Finding[] | null>(null)
  const [scanning, setScanning]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState('ALL')
  const [dragOver, setDragOver]     = useState(false)
  const [fileName, setFileName]     = useState<string | null>(null)
  const fileRef                     = useRef<HTMLInputElement>(null)
  const fileDataRef                 = useRef<File | null>(null)

  // ── API calls ────────────────────────────────────────────────────
  async function runGithubScan() {
    if (!repoUrl.trim()) return
    setScanning(true); setError(null); setFindings(null)
    try {
      const res = await fetch('http://localhost:8000/api/iac/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail ?? `HTTP ${res.status}`)
      }
      setFindings(await res.json())
      setActiveTab('ALL')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  async function runLocalScan(file: File) {
    setScanning(true); setError(null); setFindings(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('http://localhost:8000/api/iac/scan-local', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail ?? `HTTP ${res.status}`)
      }
      setFindings(await res.json())
      setActiveTab('ALL')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  function handleFileSelect(file: File) {
    fileDataRef.current = file
    setFileName(file.name)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  // ── Filtered findings ─────────────────────────────────────────────
  const filtered = findings
    ? activeTab === 'ALL'
      ? findings
      : findings.filter(f => f.severity?.toUpperCase() === activeTab)
    : []

  const tabs = findings
    ? [
        { key: 'ALL',      label: 'All',      count: findings.length },
        { key: 'CRITICAL', label: 'Critical', count: countBySev(findings, 'CRITICAL') },
        { key: 'HIGH',     label: 'High',     count: countBySev(findings, 'HIGH') },
        { key: 'MEDIUM',   label: 'Medium',   count: countBySev(findings, 'MEDIUM') },
        { key: 'LOW',      label: 'Low',      count: countBySev(findings, 'LOW') },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>IaC Security</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ViewStandardLink />
          <ExportReportButton
            findings={(findings || []) as any[]}
            scanType="iac"
            repoLabel={scanMode === 'github' ? repoUrl : (fileName || '')}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--mono)' }}>
            powered by Checkov
          </span>
          {findings && (
            <button
              onClick={() => { setFindings(null); setError(null); setFileName(null); fileDataRef.current = null }}
              style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}
            >
              ← New Scan
            </button>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {/* ── SCAN FORM (shown when no results yet) ── */}
        {!findings && (
          <div style={{ maxWidth: 640, margin: '40px auto 0' }}>

            {/* Header */}
            <div style={{ marginBottom: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4D9FFF', marginBottom: 10 }}>
                Infrastructure as Code
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 300, color: '#F0F4FF', letterSpacing: '-0.5px' }}>
                IaC Security Scan
              </h1>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                Scans Terraform, Kubernetes, Dockerfile, Helm, and CloudFormation for misconfigurations using Checkov.
              </p>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 4, marginBottom: 20 }}>
              {(['github', 'local'] as ScanMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setScanMode(m); setError(null) }}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', background: scanMode === m ? 'rgba(27,127,255,0.18)' : 'transparent', color: scanMode === m ? '#4D9FFF' : 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: scanMode === m ? 600 : 400, cursor: 'pointer', fontFamily: 'var(--body)', transition: 'all 0.15s' }}
                >
                  {m === 'github' ? '⟲  GitHub URL' : '⬆  Upload ZIP'}
                </button>
              ))}
            </div>

            {/* GitHub mode */}
            {scanMode === 'github' && (
              <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 8 }}>
                  Public GitHub Repository URL
                </label>
                <input
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runGithubScan()}
                  placeholder="https://github.com/bridgecrewio/terragoat"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F0F4FF', fontSize: 13, fontFamily: 'var(--mono)', outline: 'none', marginBottom: 14 }}
                />
                <button
                  onClick={runGithubScan}
                  disabled={scanning || !repoUrl.trim()}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', background: scanning || !repoUrl.trim() ? 'rgba(27,127,255,0.35)' : '#1B7FFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: scanning || !repoUrl.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {scanning
                    ? <><Spinner /> Cloning &amp; scanning…</>
                    : 'Run IaC Scan'}
                </button>
              </div>
            )}

            {/* Local upload mode */}
            {scanMode === 'local' && (
              <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: `2px dashed ${dragOver ? '#1B7FFF' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, transition: 'border-color 0.15s', background: dragOver ? 'rgba(27,127,255,0.05)' : 'transparent' }}
                >
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
                  {fileName
                    ? <div style={{ fontSize: 13, color: '#4D9FFF', fontFamily: 'var(--mono)' }}>{fileName}</div>
                    : <>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Drop your project ZIP here</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>or click to browse</div>
                      </>
                  }
                  <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
                </div>
                <button
                  onClick={() => { if (fileDataRef.current) runLocalScan(fileDataRef.current) }}
                  disabled={scanning || !fileDataRef.current}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', background: scanning || !fileDataRef.current ? 'rgba(27,127,255,0.35)' : '#1B7FFF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: scanning || !fileDataRef.current ? 'not-allowed' : 'pointer', fontFamily: 'var(--body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {scanning ? <><Spinner /> Scanning…</> : 'Run IaC Scan'}
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(192,55,42,0.1)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, fontSize: 12, color: '#FF6B6B', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                ⚠ {error}
              </div>
            )}

            {/* Scanning state */}
            {scanning && (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Running Checkov across IaC files…</div>
                <ScanProgressBar />
              </div>
            )}

            {/* Info chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 28 }}>
              {['Terraform', 'Kubernetes', 'Dockerfile', 'Helm', 'CloudFormation', 'ARM'].map(t => (
                <span key={t} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {findings && (
          <>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total Findings', value: findings.length,                    color: '#F0F4FF' },
                { label: 'Critical',       value: countBySev(findings, 'CRITICAL'),   color: '#FF6B6B' },
                { label: 'High',           value: countBySev(findings, 'HIGH'),       color: '#FFB020' },
                { label: 'Medium',         value: countBySev(findings, 'MEDIUM'),     color: '#4D9FFF' },
                { label: 'Low / Info',     value: countBySev(findings, 'LOW') + countBySev(findings, 'INFO'), color: 'rgba(255,255,255,0.4)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
                </div>
              ))}
            </div>

            {/* Critical alert banner (if any) */}
            {countBySev(findings, 'CRITICAL') > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(192,55,42,0.1)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ color: '#FF6B6B', fontWeight: 500 }}>{countBySev(findings, 'CRITICAL')} critical misconfiguration{countBySev(findings, 'CRITICAL') > 1 ? 's' : ''} found</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>— review and remediate before deployment.</span>
              </div>
            )}

            {/* Table */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{ padding: '12px 14px', fontSize: 12, fontWeight: activeTab === t.key ? 500 : 400, color: activeTab === t.key ? '#F0F4FF' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? '#1B7FFF' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--body)' }}
                  >
                    {t.label}
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: activeTab === t.key ? 'rgba(27,127,255,0.2)' : 'rgba(255,255,255,0.07)', color: activeTab === t.key ? '#4D9FFF' : 'rgba(255,255,255,0.3)' }}>{t.count}</span>
                  </button>
                ))}
              </div>

              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 2.2fr 1.3fr 70px 70px 80px 80px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Check ID / Rule', 'Description', 'File · Line', 'Category', 'CWE', 'Severity', 'ISO 27001'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {filtered.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No findings in this category.
                </div>
              ) : (
                filtered.map((f, i) => {
                  const sev = getSev(f.severity)
                  const cat = guessCategory(f.file)
                  const desc = f.description.replace(/^FAILED — /, '').replace(/^PASSED — /, '')
                  return (
                    <div key={i}
                      style={{ display: 'grid', gridTemplateColumns: '1.8fr 2.2fr 1.3fr 70px 70px 80px 80px', padding: '12px 16px', alignItems: 'start', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Rule ID */}
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#4D9FFF', wordBreak: 'break-all' }}>{f.rule || f.title}</div>

                      {/* Description */}
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, paddingRight: 12 }}>
                        {desc.length > 120 ? desc.slice(0, 120) + '…' : desc}
                      </div>

                      {/* File:line */}
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)', wordBreak: 'break-all' }}>
                        {f.file}{f.line > 0 ? `:${f.line}` : ''}
                      </div>

                      {/* Category */}
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: `${cat.color}18`, color: cat.color }}>
                          {cat.label}
                        </span>
                      </div>

                      {/* CWE */}
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.35)' }}>{f.cwe}</div>

                      {/* Severity */}
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: sev.bg, color: sev.color }}>
                          {f.severity}
                        </span>
                      </div>

                      {/* ISO 27001 */}
                      <div>
                        <ISO27001Badge info={{
                          control: f.iso27001_control || '8.9',
                          controlName: f.iso27001_control_name || 'Configuration management',
                          description: f.iso27001_description || 'Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.',
                        }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer note */}
            <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
              Scanned by Checkov · {findings.length} total findings · OWASP A05:2021 Security Misconfiguration
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes progress { 0% { width: 0% } 80% { width: 85% } 100% { width: 92% } }
      `}</style>
    </div>
  )
}

// ── Small reusable components ──────────────────────────────────────
function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  )
}

function ScanProgressBar() {
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
      <div style={{ height: '100%', background: 'linear-gradient(90deg, #1B7FFF, #4D9FFF)', borderRadius: 2, animation: 'progress 4s ease-out forwards' }} />
    </div>
  )
}