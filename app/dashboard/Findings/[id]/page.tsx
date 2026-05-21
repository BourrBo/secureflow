'use client'
import { useState } from 'react'
import Link from 'next/link'

const findingData: Record<string, {
  id: number; name: string; owasp: string; severity: string
  file: string; line: number; cwe: string; cvss: number; epss: number
  scanner: string; branch: string; commit: string; status: string; assignee: string
  description: string; codeLines: { ln: number; code: string; highlight?: boolean }[]
  fixCode: string; tags: string[]; jira: string
  activity: { time: string; msg: string }[]
}> = {
  '1': {
    id: 1, name: 'SQL Injection via user input', owasp: 'A03:2021 · Injection',
    severity: 'critical', file: 'routes/user.js', line: 142,
    cwe: 'CWE-89', cvss: 9.1, epss: 0.82,
    scanner: 'Semgrep 1.47', branch: 'main', commit: 'a3f1c92',
    status: 'open', assignee: 'Rahul Kumar',
    description: 'User-controlled input from req.params.id is concatenated directly into a raw SQL query string without sanitization or parameterization. This allows an attacker to inject arbitrary SQL, potentially reading, modifying, or deleting all database records.',
    codeLines: [
      { ln: 139, code: "const db = require('./db');" },
      { ln: 140, code: 'const userId = req.params.id;' },
      { ln: 141, code: 'const query = `SELECT * FROM users`;' },
      { ln: 142, code: 'db.execute(query + " WHERE id=" + userId);', highlight: true },
      { ln: 143, code: 'return res.json(result);' },
    ],
    fixCode: 'db.execute("SELECT * FROM users WHERE id=?", [userId]);',
    tags: ['sql-injection', 'owasp-top10', 'CWE-89', 'database', 'api-layer'],
    jira: 'APPSEC-88',
    activity: [
      { time: 'Jan 18, 09:14', msg: 'Finding detected by Semgrep on PR #221' },
      { time: 'Jan 18, 11:30', msg: 'Assigned to Rahul Kumar by auto-policy' },
      { time: 'Jan 18, 14:02', msg: 'Jira ticket APPSEC-88 created automatically' },
      { time: 'Jan 19, 08:55', msg: 'Slack notification sent to #security-alerts' },
    ],
  },
}

const sevConfig: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#FF6B6B', bg: 'rgba(192,55,42,0.15)', border: 'rgba(192,55,42,0.3)' },
  high:     { color: '#FFB020', bg: 'rgba(184,106,0,0.15)', border: 'rgba(184,106,0,0.3)' },
  medium:   { color: '#4D9FFF', bg: 'rgba(27,127,255,0.15)', border: 'rgba(27,127,255,0.3)' },
}

export default function FindingDetailPage({ params }: { params: { id: string } }) {
  const finding = findingData[params.id] || findingData['1']
  const sev = sevConfig[finding.severity] || sevConfig.critical
  const [aiLoading, setAiLoading] = useState(false)
  const [aiShown, setAiShown] = useState(false)
  const [status, setStatus] = useState(finding.status)
  const [copied, setCopied] = useState(false)

  const handleAiFix = () => {
    setAiLoading(true)
    setTimeout(() => { setAiLoading(false); setAiShown(true) }, 2000)
  }

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* ── TOP BAR ── */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/sast" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>SAST</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>SF-{finding.id.toString().padStart(4, '0')} · {finding.name.slice(0, 30)}…</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/dashboard/sast" style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, textDecoration: 'none' }}>
            ← Back
          </Link>
          <button style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Create Jira Ticket
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Finding header */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 10, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`, whiteSpace: 'nowrap', marginTop: 3 }}>
                  {finding.severity.toUpperCase()}
                </span>
                <div>
                  <h1 style={{ fontFamily: 'var(--font)', fontSize: 18, fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.3px', marginBottom: 4 }}>
                    {finding.name}
                  </h1>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--mono)' }}>
                    SF-{finding.id.toString().padStart(4,'0')} · {finding.cwe} · {finding.owasp} · {finding.file}:{finding.line}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 0 }}>
                {finding.description}
              </p>
            </div>

            {/* Vulnerable code */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>Vulnerable code</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--mono)' }}>{finding.file}</span>
              </div>
              <div style={{ background: '#040D1A', padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8 }}>
                {finding.codeLines.map((line) => (
                  <div
                    key={line.ln}
                    style={{
                      display: 'flex', gap: 16, alignItems: 'baseline',
                      background: line.highlight ? 'rgba(192,55,42,0.18)' : 'transparent',
                      margin: line.highlight ? '0 -16px' : '0',
                      padding: line.highlight ? '0 16px' : '0',
                      borderLeft: line.highlight ? '3px solid #FF3B5C' : '3px solid transparent',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.2)', minWidth: 28, textAlign: 'right', userSelect: 'none', fontSize: 11 }}>{line.ln}</span>
                    <span style={{ color: line.highlight ? '#F09595' : 'rgba(255,255,255,0.65)' }}>{line.code}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Fix section */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: `1px solid ${aiShown ? 'rgba(0,229,118,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .3s' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>✦</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)' }}>AI Fix Suggestion</span>
                  {aiShown && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,229,118,0.1)', color: '#00E576', border: '1px solid rgba(0,229,118,0.2)' }}>Ready</span>}
                </div>
                {!aiShown && (
                  <button
                    onClick={handleAiFix}
                    disabled={aiLoading}
                    style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: aiLoading ? 'rgba(27,127,255,0.4)' : '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {aiLoading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Generating fix…
                      </>
                    ) : '✦ Generate Fix'}
                  </button>
                )}
                {aiShown && (
                  <button onClick={handleCopy} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(0,229,118,0.2)', background: 'rgba(0,229,118,0.08)', color: '#00E576', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--body)' }}>
                    {copied ? '✓ Copied!' : 'Copy fix'}
                  </button>
                )}
              </div>

              {!aiShown && !aiLoading && (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  Click &ldquo;Generate Fix&rdquo; to get an AI-powered remediation for this vulnerability
                </div>
              )}

              {aiLoading && (
                <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(27,127,255,0.3)', borderTopColor: '#4D9FFF', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: '#4D9FFF', fontWeight: 500 }}>Analyzing vulnerability…</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Reading codebase context and generating fix</div>
                  </div>
                </div>
              )}

              {aiShown && (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 12 }}>
                    Replace string concatenation with a parameterized query. Pass user input as a bound parameter so the database driver handles escaping automatically:
                  </p>
                  <div style={{ background: '#040D1A', borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8, border: '1px solid rgba(0,229,118,0.1)' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: 'rgba(255,255,255,0.2)', minWidth: 28, textAlign: 'right' }}>142</span>
                      <span style={{ color: '#98C56A' }}>{finding.fixCode}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                    💡 This fix uses a prepared statement which prevents all SQL injection attacks by separating data from query logic.
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: '🎫 Create Jira Ticket', primary: true },
                { label: '👤 Assign to Dev' },
                { label: '✓ Mark Resolved' },
                { label: '🚫 False Positive' },
                { label: '⚠ Accept Risk' },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => btn.label.includes('Resolved') && setStatus('resolved')}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'var(--body)', transition: 'all .15s',
                    background: btn.primary ? '#1B7FFF' : 'rgba(255,255,255,0.05)',
                    color: btn.primary ? '#fff' : 'rgba(255,255,255,0.6)',
                    border: btn.primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: btn.primary ? '0 0 16px rgba(27,127,255,0.25)' : 'none',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Activity log */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 14 }}>Activity log</div>
              {finding.activity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, padding: '8px 0', borderBottom: i < finding.activity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--mono)', minWidth: 100, flexShrink: 0 }}>{a.time}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{a.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN — Metadata ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Details */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 14 }}>Finding details</div>
              {[
                { label: 'Status',   value: status === 'resolved' ? '✓ Resolved' : '● Open', color: status === 'resolved' ? '#00E576' : '#FF6B6B' },
                { label: 'Assignee', value: finding.assignee },
                { label: 'Scanner',  value: finding.scanner, mono: true },
                { label: 'CVSS',     value: finding.cvss.toString(), color: '#FF6B6B' },
                { label: 'EPSS',     value: finding.epss.toString(), color: '#FFB020' },
                { label: 'Branch',   value: finding.branch, mono: true },
                { label: 'Commit',   value: finding.commit, mono: true, color: '#4D9FFF' },
                { label: 'Jira',     value: finding.jira, color: '#4D9FFF' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: row.color || '#F0F4FF', fontFamily: row.mono ? 'var(--mono)' : 'var(--body)' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Tags */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 10 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {finding.tags.map((tag) => (
                  <span key={tag} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* OWASP reference */}
            <div style={{ background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 10 }}>OWASP Reference</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                {finding.owasp} — Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query.
              </div>
              <a href="https://owasp.org/Top10/A03_2021-Injection/" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 11, color: '#4D9FFF', textDecoration: 'none' }}>
                View OWASP docs →
              </a>
            </div>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
