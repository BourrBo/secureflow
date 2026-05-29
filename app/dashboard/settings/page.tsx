'use client'
import { useState } from 'react'
import Link from 'next/link'

const tabs = ['SCM / Repos', 'Scan Engines', 'Notifications', 'Auth & SSO', 'Team & RBAC', 'API Keys']

// ── Repos Tab ──
function ReposTab() {
  const repos = [
    { icon: '🐙', name: 'GitHub',        org: 'acme/api-gateway',      status: 'active',  trigger: 'Push + PR' },
    { icon: '🦊', name: 'GitLab',        org: 'mygroup/auth-svc',       status: 'active',  trigger: 'PR only' },
    { icon: '🔷', name: 'Azure DevOps',  org: 'myproject/payment-ms',   status: 'pending', trigger: 'Not set' },
    { icon: '🌿', name: 'Bitbucket',     org: 'acme/frontend-app',      status: 'active',  trigger: 'Push + PR' },
  ]
  const [blockOn, setBlockOn] = useState('Critical only')
  const [frequency, setFrequency] = useState('On every PR')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div style={card}>
          <div style={cardTitle}>Connected repositories</div>
          {repos.map((r) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{r.name} — {r.org}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{r.trigger}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: r.status === 'active' ? 'rgba(0,229,118,0.1)' : 'rgba(184,106,0,0.12)', color: r.status === 'active' ? '#00E576' : '#FFB020' }}>
                {r.status === 'active' ? '✓ Active' : '⏳ Pending'}
              </span>
            </div>
          ))}
          <button style={btnSecondary}>+ Connect new repository</button>
        </div>

        <div style={{ ...card, marginTop: 16 }}>
          <div style={cardTitle}>Scan schedule</div>
          <div style={formGroup}>
            <label style={label}>Default scan trigger</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={select}>
              <option>On every PR (recommended)</option>
              <option>On push to main</option>
              <option>Daily at 2:00 AM</option>
              <option>Weekly</option>
            </select>
          </div>
          <div style={formGroup}>
            <label style={label}>Block PR on severity ≥</label>
            <select value={blockOn} onChange={(e) => setBlockOn(e.target.value)} style={select}>
              <option>Critical only</option>
              <option>Critical + High</option>
              <option>Never block</option>
            </select>
            <div style={hint}>Applied to all repos unless overridden per project</div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>SLA — fix deadlines</div>
        {[
          { sev: 'Critical', days: 3,  color: '#FF6B6B' },
          { sev: 'High',     days: 7,  color: '#FFB020' },
          { sev: 'Medium',   days: 30, color: '#4D9FFF' },
          { sev: 'Low',      days: 90, color: 'rgba(255,255,255,0.4)' },
        ].map((s) => (
          <div key={s.sev} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: `${s.color}18`, color: s.color, minWidth: 60, textAlign: 'center' }}>{s.sev}</span>
            <input type="number" defaultValue={s.days} style={{ ...inputStyle, width: 70 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>days to fix</span>
          </div>
        ))}
        <div style={{ marginTop: 20 }}>
          <div style={cardTitle}>SBOM generation</div>
          {[
            { label: 'Auto-generate SBOM on scan', sub: 'CycloneDX format', on: true },
            { label: 'Export SPDX format',         sub: 'In addition to CycloneDX', on: false },
            { label: 'Include transitive deps',    sub: 'Recommended for compliance', on: true },
          ].map((t) => <ToggleRow key={t.label} {...t} />)}
        </div>
      </div>
    </div>
  )
}

// ── Scan Engines Tab ──
function ScanEnginesTab() {
  const engines = [
    { name: 'Semgrep',      type: 'SAST',    version: '1.47.0', status: true,  langs: 'JS, TS, Python, Java, Go, Ruby' },
    { name: 'Horusec',      type: 'SAST',    version: '2.9.0',  status: false, langs: '20+ languages' },
    { name: 'OSV-Scanner',  type: 'SCA',     version: '1.6.0',  status: true,  langs: 'npm, pip, maven, go.mod' },
    { name: 'Gitleaks',     type: 'Secrets', version: '8.18.0', status: true,  langs: '800+ secret patterns' },
    { name: 'KICS',         type: 'IaC',     version: '2.1.0',  status: true,  langs: 'Terraform, K8s, Helm, CF' },
    { name: 'Trivy',        type: 'Container',version: '0.48.0',status: false, langs: 'Docker, K8s images' },
    { name: 'OWASP ZAP',   type: 'DAST',    version: '2.14.0', status: false, langs: 'Web applications' },
  ]
  return (
    <div style={card}>
      <div style={cardTitle}>Scan engine configuration</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {engines.map((e) => (
          <div key={e.name} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${e.status ? 'rgba(0,229,118,0.15)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F4FF' }}>{e.name}</span>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(27,127,255,0.15)', color: '#4D9FFF' }}>{e.type}</span>
                <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.3)' }}>v{e.version}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{e.langs}</div>
            </div>
            <Toggle on={e.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Notifications Tab ──
function NotificationsTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={card}>
        <div style={cardTitle}>Notification channels</div>
        {[
          { icon: '💬', name: 'Slack webhook',    sub: '→ #security-alerts',        on: true },
          { icon: '🎫', name: 'Jira auto-ticket', sub: 'Critical findings only',     on: true },
          { icon: '📧', name: 'Email digest',      sub: 'Weekly summary to leads',   on: false },
          { icon: '📋', name: 'MS Teams',          sub: 'Not configured',            on: false },
          { icon: '🔔', name: 'Zero-day banner',   sub: 'Flash banner on dashboard', on: true },
        ].map((t) => <ToggleRow key={t.name} label={t.name} sub={t.sub} on={t.on} icon={t.icon} />)}
      </div>
      <div>
        <div style={card}>
          <div style={cardTitle}>Slack configuration</div>
          <div style={formGroup}>
            <label style={label}>Webhook URL</label>
            <input style={inputStyle} defaultValue="https://hooks.slack.com/services/T0••••••" />
          </div>
          <div style={formGroup}>
            <label style={label}>Alert channel</label>
            <input style={inputStyle} defaultValue="#security-alerts" />
          </div>
          <div style={formGroup}>
            <label style={label}>Alert on severity ≥</label>
            <select style={select} defaultValue="High">
              <option>Critical only</option>
              <option>High</option>
              <option>Any finding</option>
            </select>
          </div>
          <button style={btnPrimary}>Test connection</button>
        </div>
        <div style={{ ...card, marginTop: 16 }}>
          <div style={cardTitle}>Jira configuration</div>
          <div style={formGroup}>
            <label style={label}>Jira project key</label>
            <input style={inputStyle} defaultValue="APPSEC" />
          </div>
          <div style={formGroup}>
            <label style={label}>Auto-create tickets for</label>
            <select style={select}><option>Critical only</option><option>Critical + High</option></select>
          </div>
          <button style={btnPrimary}>Connect Jira</button>
        </div>
      </div>
    </div>
  )
}

// ── Auth & SSO Tab ──
function AuthTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={card}>
        <div style={cardTitle}>Authentication methods</div>
        {[
          { label: 'SAML 2.0 SSO',      sub: 'via Okta',           on: true },
          { label: 'Force SSO login',    sub: 'Disable password',   on: false },
          { label: 'MFA enforcement',    sub: 'All users',          on: true },
          { label: 'GitHub OAuth',       sub: 'For Git integration', on: true },
          { label: 'Google OAuth',       sub: 'For signup',         on: true },
        ].map((t) => <ToggleRow key={t.label} {...t} />)}
        <div style={{ marginTop: 16 }}>
          <div style={cardTitle}>SAML configuration</div>
          <div style={formGroup}>
            <label style={label}>Identity Provider SSO URL</label>
            <input style={inputStyle} placeholder="https://your-okta.com/sso/saml" />
          </div>
          <div style={formGroup}>
            <label style={label}>Entity ID</label>
            <input style={inputStyle} defaultValue="https://app.secureflow.io" />
          </div>
          <button style={btnPrimary}>Save SAML config</button>
        </div>
      </div>
      <div style={card}>
        <div style={cardTitle}>Session settings</div>
        <div style={formGroup}>
          <label style={label}>Session timeout</label>
          <select style={select}><option>8 hours</option><option>24 hours</option><option>7 days</option></select>
        </div>
        <div style={formGroup}>
          <label style={label}>Max failed login attempts</label>
          <input style={{ ...inputStyle, width: 80 }} defaultValue="5" type="number" />
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={cardTitle}>Allowed email domains</div>
          <div style={formGroup}>
            <label style={label}>Restrict signup to domains</label>
            <input style={inputStyle} defaultValue="acmecorp.com, acme.io" />
            <div style={hint}>Comma separated. Leave empty to allow all.</div>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={cardTitle}>Audit log</div>
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { msg: 'Rahul K. signed in', time: '2h ago' },
              { msg: 'API key rotated by Admin', time: '1d ago' },
              { msg: 'New repo connected: api-gateway', time: '2d ago' },
              { msg: 'SAML SSO enabled', time: '1w ago' },
            ].map((log, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: 11 }}>
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>{log.msg}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--mono)' }}>{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Team & RBAC Tab ──
function TeamTab() {
  const members = [
    { name: 'Rahul Kumar',  email: 'rahul@acme.com',  role: 'Admin',  avatar: 'RK', color: '#1B7FFF', lastActive: '2h ago' },
    { name: 'Priya Sharma', email: 'priya@acme.com',  role: 'Dev',    avatar: 'PS', color: '#00E576', lastActive: '1d ago' },
    { name: 'Dev Team',     email: 'dev@acme.com',    role: 'Viewer', avatar: 'DT', color: '#FFB020', lastActive: '3d ago' },
    { name: 'Anjali Mehta', email: 'anjali@acme.com', role: 'Dev',    avatar: 'AM', color: '#FF6B6B', lastActive: '1w ago' },
  ]
  const roleColors: Record<string, { color: string; bg: string }> = {
    Admin:  { color: '#FF6B6B', bg: 'rgba(192,55,42,0.12)' },
    Dev:    { color: '#4D9FFF', bg: 'rgba(27,127,255,0.12)' },
    Viewer: { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.07)' },
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={cardTitle}>Team members</div>
          <button style={btnPrimary}>+ Invite member</button>
        </div>
        {members.map((m) => {
          const rc = roleColors[m.role]
          return (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{m.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{m.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{m.email} · {m.lastActive}</div>
              </div>
              <select defaultValue={m.role} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: rc.bg, color: rc.color, fontSize: 11, cursor: 'pointer', outline: 'none', fontFamily: 'var(--body)' }}>
                <option>Admin</option>
                <option>Dev</option>
                <option>Viewer</option>
              </select>
            </div>
          )
        })}
      </div>
      <div style={card}>
        <div style={cardTitle}>RBAC permissions</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'rgba(255,255,255,0.3)', fontWeight: 500, fontSize: 10 }}>Permission</th>
                {['Admin', 'Dev', 'Viewer'].map((r) => <th key={r} style={{ textAlign: 'center', padding: '8px 8px', color: 'rgba(255,255,255,0.3)', fontWeight: 500, fontSize: 10 }}>{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ['View findings',      true,  true,  true],
                ['Triage findings',    true,  true,  false],
                ['Trigger scans',      true,  true,  false],
                ['Manage projects',    true,  true,  false],
                ['Manage team',        true,  false, false],
                ['Edit settings',      true,  false, false],
                ['Manage API keys',    true,  false, false],
                ['View audit logs',    true,  false, false],
              ].map(([perm, ...vals]) => (
                <tr key={String(perm)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.6)' }}>{String(perm)}</td>
                  {vals.map((v, i) => (
                    <td key={i} style={{ textAlign: 'center', padding: '8px 8px' }}>
                      <span style={{ color: v ? '#00E576' : 'rgba(255,255,255,0.15)', fontSize: 14 }}>{v ? '✓' : '✗'}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── API Keys Tab ──
function APIKeysTab() {
  const [copied, setCopied] = useState(false)
  const keys = [
    { name: 'Production key',  key: 'sf_live_••••••••••••2a9f', created: 'Jan 1, 2025',  lastUsed: '2h ago',   scope: 'Full access' },
    { name: 'CI/CD key',       key: 'sf_live_••••••••••••7b3c', created: 'Feb 15, 2025', lastUsed: '1d ago',   scope: 'Scan only' },
    { name: 'Read-only key',   key: 'sf_live_••••••••••••9d1e', created: 'Mar 1, 2025',  lastUsed: '1w ago',   scope: 'Read only' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={cardTitle}>API keys</div>
          <button style={btnPrimary}>+ Generate key</button>
        </div>
        {keys.map((k) => (
          <div key={k.name} style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{k.name}</span>
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: 'rgba(27,127,255,0.1)', color: '#4D9FFF' }}>{k.scope}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input readOnly value={k.key} style={{ ...inputStyle, flex: 1, fontFamily: 'var(--mono)', fontSize: 11 }} />
              <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ ...btnSecondary, whiteSpace: 'nowrap', padding: '6px 10px' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Created {k.created} · Last used {k.lastUsed}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={cardTitle}>Webhook endpoints</div>
        {[
          { name: 'GitHub Actions',   url: 'https://api.secureflow.io/webhook/github',  active: true },
          { name: 'GitLab CI',        url: 'https://api.secureflow.io/webhook/gitlab',  active: true },
          { name: 'Jenkins',          url: 'https://api.secureflow.io/webhook/jenkins', active: false },
        ].map((w) => (
          <div key={w.name} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{w.name}</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: w.active ? 'rgba(0,229,118,0.1)' : 'rgba(255,255,255,0.07)', color: w.active ? '#00E576' : 'rgba(255,255,255,0.3)' }}>
                {w.active ? '● Active' : '○ Inactive'}
              </span>
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#4D9FFF', wordBreak: 'break-all' }}>{w.url}</div>
          </div>
        ))}
        <div style={{ marginTop: 20 }}>
          <div style={cardTitle}>Rate limits</div>
          {[
            { label: 'API requests / hour',  val: '1,000 / 1,000',  pct: 12 },
            { label: 'Scans / day',          val: '48 / 500',        pct: 10 },
            { label: 'Webhooks / hour',      val: '200 / 500',       pct: 40 },
          ].map((r) => (
            <div key={r.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>{r.val}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.pct}%`, background: '#1B7FFF', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shared components ──
function Toggle({ on: initialOn }: { on: boolean }) {
  const [on, setOn] = useState(initialOn)
  return (
    <div onClick={() => setOn(!on)} style={{ width: 34, height: 18, borderRadius: 9, background: on ? '#1B7FFF' : 'rgba(255,255,255,0.12)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 2, left: on ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  )
}

function ToggleRow({ label, sub, on, icon }: { label: string; sub: string; on: boolean; icon?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F4FF' }}>{label}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{sub}</div>
        </div>
      </div>
      <Toggle on={on} />
    </div>
  )
}

// ── Style constants ──
const card: React.CSSProperties = { background: 'rgba(13,27,46,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 18 }
const cardTitle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#F0F4FF', fontFamily: 'var(--font)', marginBottom: 14 }
const formGroup: React.CSSProperties = { marginBottom: 14 }
const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }
const hint: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#F0F4FF', fontSize: 12, outline: 'none', fontFamily: 'var(--body)' }
const select: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(13,27,46,0.9)', color: '#F0F4FF', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: 'var(--body)' }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', borderRadius: 7, border: 'none', background: '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }
const btnSecondary: React.CSSProperties = { padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--body)', width: '100%', marginTop: 10, textAlign: 'center' as const }

const tabComponents: Record<string, React.ReactNode> = {
  'SCM / Repos':    <ReposTab />,
  'Scan Engines':   <ScanEnginesTab />,
  'Notifications':  <NotificationsTab />,
  'Auth & SSO':     <AuthTab />,
  'Team & RBAC':    <TeamTab />,
  'API Keys':       <APIKeysTab />,
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('SCM / Repos')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--body)' }}>

      {/* TOP BAR */}
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard</Link>
          <span>/</span>
          <span style={{ color: '#F0F4FF', fontWeight: 500 }}>Settings</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Discard</button>
          <button onClick={handleSave} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: saved ? 'rgba(0,229,118,0.8)' : '#1B7FFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .2s' }}>
            {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 20px', background: 'var(--bg)', flexShrink: 0 }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '12px 14px', fontSize: 12, fontWeight: activeTab === t ? 500 : 400, color: activeTab === t ? '#F0F4FF' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? '#1B7FFF' : 'transparent'}`, cursor: 'pointer', fontFamily: 'var(--body)', whiteSpace: 'nowrap' }}>
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'rgba(6,13,24,0.8)' }}>
        {tabComponents[activeTab]}
      </div>
    </div>
  )
}
