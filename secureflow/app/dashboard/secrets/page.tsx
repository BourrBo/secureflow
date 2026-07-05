'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ISO27001Badge, ViewStandardLink, ExportReportButton } from '@/components/dashboard/ISO27001'

// ── Shape coming back from the backend (shared Finding model — mixed scanners) ──
type BackendFinding = {
  title:       string
  severity:    string   // already lowercase from secrets_parser.py: critical/high/medium/low
  file:        string
  line:        number
  description: string   // includes "(matched: <redacted value>)"
  rule:        string
  cwe:         string
  owasp:       string
  scanner:     string   // "semgrep" | "trivy" | "checkov" | "secrets" — we only keep "secrets" here
  iso27001_control?:      string
  iso27001_control_name?: string
  iso27001_description?:  string
}

type Secret = {
  id:               number
  type:             string   // human-readable rule name, e.g. "Aws Access Key"
  ruleId:           string   // raw rule id, e.g. "aws-access-key"
  redactedMatch:    string
  detectionMethod:  'pattern' | 'entropy' | 'unknown'
  severity:         'critical' | 'high' | 'medium' | 'low'
  file:             string
  line:             number
  cwe:              string
  iso27001Control:     string
  iso27001ControlName: string
  iso27001Description: string
}

function mapSeverity(raw: string): Secret['severity'] {
  const s = raw?.toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high')     return 'high'
  if (s === 'medium')   return 'medium'
  return 'low'
}

// Backend sends description as "Human description (matched: AKIA****WXYZ)" —
// pull the redacted value out for its own column instead of duplicating the full sentence.
function extractRedactedMatch(description: string): string {
  const m = description.match(/\(matched: (.+)\)\s*$/)
  return m ? m[1] : '—'
}

function humanizeRuleId(rule: string): string {
  if (rule === 'entropy-generic') return 'High-Entropy String'
  return rule
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const sevConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)', label: 'Critical' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)',  label: 'High' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)', label: 'Medium' },
  low:      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)', label: 'Low' },
}

const methodConfig: Record<string, { color: string; label: string }> = {
  pattern: { color: '#4D9FFF', label: 'Pattern match' },
  entropy: { color: 'rgba(255,255,255,0.4)', label: 'Entropy' },
}

const typeIcons: Record<string, string> = {
  'aws-access-key': '🟠', 'aws-secret-key': '🟠', 'github-token': '⚫', 'gitlab-token': '🦊',
  'slack-token': '💬', 'slack-webhook': '💬', 'google-api-key': '🔵', 'stripe-key': '💳',
  'openai-key': '🤖', 'private-key-block': '🔐', 'jwt': '🔑', 'generic-api-key-assignment': '🔑',
  'db-connection-string': '🗄', 'npm-token': '📦', 'entropy-generic': '🎲',
}

const BACKEND_URL = 'http://127.0.0.1:8000'

export default function SecretsPage() {
  const [repoUrl, setRepoUrl]       = useState('https://github.com/pallets/flask')
  const [secrets, setSecrets]       = useState<Secret[]>([])
  const [activeTab, setActiveTab]   = useState('all')
  const [scanning, setScanning]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [hasScanned, setHasScanned] = useState(false)
  const [scanTime, setScanTime]     = useState<number | null>(null)

  const [scanMode, setScanMode]     = useState<'github' | 'local'>('github')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const normalizeResponse = (data: BackendFinding[]): Secret[] => {
    return data
      .filter((item) => item.scanner === 'secrets')
      .map((item, index) => ({
        id: index + 1,
        type: humanizeRuleId(item.rule),
        ruleId: item.rule,
        redactedMatch: extractRedactedMatch(item.description),
        detectionMethod: item.rule === 'entropy-generic' ? 'entropy' : 'pattern',
        severity: mapSeverity(item.severity),
        file: item.file || 'unknown',
        line: item.line || 0,
        cwe: item.cwe || 'CWE-798',
        iso27001Control:     item.iso27001_control      || '5.17',
        iso27001ControlName: item.iso27001_control_name || 'Authentication information',
        iso27001Description: item.iso27001_description  || 'Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information.',
      }))
  }

  const runScan = async (endpoint: string, options: RequestInit) => {
    setScanning(true)
    setError(null)
    setSecrets([])
    const startTime = Date.now()

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, options)

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Backend error ${response.status}: ${errText}`)
      }

      const data: BackendFinding[] = await response.json()
      if (!Array.isArray(data)) {
        throw new Error('Backend did not return an array of findings')
      }

      setSecrets(normalizeResponse(data))
      setHasScanned(true)
      setScanTime(Math.round((Date.now() - startTime) / 1000))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setScanning(false)
    }
  }

  const handleScan = () => {
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL')
      return
    }
    runScan('/api/secrets/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_url: repoUrl.trim() }),
    })
  }

  const handleScanLocal = () => {
    if (!selectedFile) {
      setError('Please select a .zip file to upload')
      return
    }
    const formData = new FormData()
    formData.append('file', selectedFile)
    runScan('/api/secrets/scan-local', { method: 'POST', body: formData })
  }

  const filtered = secrets.filter((s) => {
    if (activeTab === 'critical') return s.severity === 'critical'
    if (activeTab === 'high')     return s.severity === 'high'
    if (activeTab === 'pattern')  return s.detectionMethod === 'pattern'
    if (activeTab === 'entropy')  return s.detectionMethod === 'entropy'
    return true
  })

  const counts = {
    critical: secrets.filter(s => s.severity === 'critical').length,
    high:     secrets.filter(s => s.severity === 'high').length,
    pattern:  secrets.filter(s => s.detectionMethod === 'pattern').length,
    entropy:  secrets.filter(s => s.detectionMethod === 'entropy').length,
  }

  const tabs = [
    { key: 'all',      label: 'All',            count: secrets.length },
    { key: 'critical', label: 'Critical',        count: counts.critical },
    { key: 'high',     label: 'High',            count: counts.high },
    { key: 'pattern',  label: 'Pattern matches',  count: counts.pattern },
    { key: 'entropy',  label: 'Entropy-based',    count: counts.entropy },
  ]

  const uniqueFiles = new Set(secrets.map(s => s.file)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)', gap: 12 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Secrets Detection</span>
        </div>

        <div style={{ flexShrink: 0 }}><ViewStandardLink /></div>
        <ExportReportButton
          findings={secrets.map(s => ({
            title: s.type, severity: s.severity, file: s.file, line: s.line,
            description: `Secret detected (matched: ${s.redactedMatch})`,
            rule: s.ruleId, cwe: s.cwe, owasp: 'A02:2021', scanner: 'secrets',
            iso27001_control: s.iso27001Control,
            iso27001_control_name: s.iso27001ControlName,
            iso27001_description: s.iso27001Description,
          }))}
          scanType="secrets"
          repoLabel={scanMode === 'github' ? repoUrl : (selectedFile?.name || '')}
        />
        <ExportReportButton
          findings={secrets.map(s => ({
            title: s.type, severity: s.severity, file: s.file, line: s.line,
            description: `Secret detected — redacted match: ${s.redactedMatch}`,
            rule: s.ruleId, cwe: s.cwe, owasp: 'A02:2021', scanner: 'secrets',
            iso27001_control: s.iso27001Control,
            iso27001_control_name: s.iso27001ControlName,
            iso27001_description: s.iso27001Description,
          }))}
          scanType="secrets"
          repoLabel={scanMode === 'github' ? repoUrl : (selectedFile?.name || '')}
        />

        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden', flexShrink: 0 }}>
          {(['github', 'local'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setScanMode(mode); setError(null) }}
              style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: scanMode === mode ? '#1B7FFF' : 'rgba(255,255,255,0.05)',
                color: scanMode === mode ? '#fff' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font)',
              }}
            >
              {mode === 'github' ? 'GitHub URL' : 'Upload Local'}
            </button>
          ))}
        </div>

        {scanMode === 'github' && (
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="https://github.com/owner/repo"
            style={{
              flex: 1, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: '#F0F4FF', fontSize: 13, outline: 'none',
              fontFamily: 'var(--mono)',
            }}
          />
        )}

        {scanMode === 'local' && (
          <label
            htmlFor="secrets-zip-upload"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8,
              border: `1px solid ${selectedFile ? 'rgba(27,127,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
              background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
            }}
          >
            <input
              id="secrets-zip-upload"
              type="file"
              accept=".zip"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
            <span style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: 6, background: 'rgba(27,127,255,0.15)',
              color: '#4D9FFF', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Choose .zip
            </span>
            <span style={{
              fontSize: 12, color: selectedFile ? '#F0F4FF' : 'rgba(255,255,255,0.3)', fontFamily: 'var(--mono)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {selectedFile ? selectedFile.name : 'No file selected'}
            </span>
            {selectedFile && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedFile(null) }}
                style={{ flexShrink: 0, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
              >
                ✕
              </button>
            )}
          </label>
        )}

        <button
          onClick={scanMode === 'github' ? handleScan : handleScanLocal}
          disabled={scanning}
          style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: scanning ? 'rgba(27,127,255,0.5)' : '#1B7FFF', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            boxShadow: scanning ? 'none' : '0 0 16px rgba(27,127,255,0.3)',
          }}
        >
          {scanning ? (
            <>
              <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Scanning...
            </>
          ) : '⟳ Run Secrets Scan'}
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>

        {scanning && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(27,127,255,0.08)', border: '1px solid rgba(27,127,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(27,127,255,0.3)', borderTopColor: '#4D9FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            <div>
              <span style={{ color: '#4D9FFF', fontWeight: 500 }}>Scanning for exposed secrets...</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 10 }}>
                {scanMode === 'github' ? 'Cloning repo → Pattern + entropy scan → Redacting matches' : 'Extracting upload → Pattern + entropy scan → Redacting matches'}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(192,55,42,0.08)', border: '1px solid rgba(192,55,42,0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>❌</span>
            <div>
              <div style={{ color: '#FF6B6B', fontWeight: 500, marginBottom: 4 }}>Scan failed</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--mono)' }}>{error}</div>
            </div>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {hasScanned && !scanning && !error && (
          <div style={{ marginBottom: 16, padding: '10px 16px', background: secrets.some(s => s.severity === 'critical') ? 'rgba(192,55,42,0.1)' : 'rgba(0,229,118,0.06)', border: `1px solid ${secrets.some(s => s.severity === 'critical') ? 'rgba(192,55,42,0.25)' : 'rgba(0,229,118,0.2)'}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ fontSize: 14 }}>{secrets.some(s => s.severity === 'critical') ? '🚨' : '✅'}</span>
            <span style={{ color: secrets.some(s => s.severity === 'critical') ? '#FF6B6B' : '#00E576', fontWeight: 500 }}>
              {secrets.length === 0 ? 'No secrets detected' : 'Scan complete!'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              {secrets.length === 0
                ? `Scanned in ${scanTime}s — no leaked credentials found`
                : `Found ${secrets.length} finding${secrets.length === 1 ? '' : 's'} across ${uniqueFiles} file${uniqueFiles === 1 ? '' : 's'} in ${scanTime}s`}
            </span>
          </div>
        )}

        {!hasScanned && !scanning && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 8 }}>
              Ready to scan for secrets
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 440, lineHeight: 1.6 }}>
              {scanMode === 'github' ? (
                <>Enter a GitHub repository URL above and click <strong style={{ color: '#4D9FFF' }}>Run Secrets Scan</strong> to check for hardcoded API keys, tokens, and credentials using pattern matching and entropy analysis.</>
              ) : (
                <>Select a <strong style={{ color: '#4D9FFF' }}>.zip</strong> file and click <strong style={{ color: '#4D9FFF' }}>Run Secrets Scan</strong> to check it for hardcoded credentials.</>
              )}
            </div>
          </div>
        )}

        {hasScanned && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Critical',         value: counts.critical, color: '#FF6B6B' },
                { label: 'High',             value: counts.high,     color: '#FFB020' },
                { label: 'Pattern matches',  value: counts.pattern,  color: '#4D9FFF' },
                { label: 'Entropy-based',    value: counts.entropy,  color: 'rgba(255,255,255,0.4)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 300, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: s.color, width: 28 }} />
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>

              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{ padding: '12px 14px', fontSize: 12, fontWeight: activeTab === t.key ? 500 : 400, color: activeTab === t.key ? '#F0F4FF' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? '#1B7FFF' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--body)' }}>
                    {t.label}
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: activeTab === t.key ? 'rgba(27,127,255,0.2)' : 'rgba(255,255,255,0.07)', color: activeTab === t.key ? '#4D9FFF' : 'rgba(255,255,255,0.3)' }}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 1.2fr 100px 80px 80px 80px', padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Secret Type', 'File · Line', 'Redacted Match', 'Detection', 'CWE', 'Severity', 'ISO 27001'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)' }}>{h}</div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No {activeTab === 'all' ? '' : activeTab} findings.
                </div>
              )}

              {filtered.map((s, i) => {
                const sev = sevConfig[s.severity]
                const method = methodConfig[s.detectionMethod] || methodConfig.entropy
                return (
                  <div key={s.id}
                    style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 1.2fr 100px 80px 80px 80px', padding: '11px 16px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>{typeIcons[s.ruleId] || '🔑'}</span>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{s.type}</div>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: '#4D9FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.file}>
                      {s.file}:{s.line}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.redactedMatch}
                    </div>
                    <div style={{ fontSize: 10, color: method.color }}>{method.label}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{s.cwe}</div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: sev.bg, color: sev.color }}>
                        {sev.label}
                      </span>
                    </div>
                    <div>
                      <ISO27001Badge info={{ control: s.iso27001Control, controlName: s.iso27001ControlName, description: s.iso27001Description }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
