'use client'
const integrations = [
  { icon: '🐙', name: 'GitHub' },   { icon: '🦊', name: 'GitLab' },
  { icon: '🏗', name: 'Jenkins' },  { icon: '🔷', name: 'Azure DevOps' },
  { icon: '🎫', name: 'Jira' },     { icon: '💬', name: 'Slack' },
  { icon: '📋', name: 'MS Teams' }, { icon: '🐳', name: 'Docker' },
  { icon: '☸️', name: 'Kubernetes' },{ icon: '🌿', name: 'Bitbucket' },
  { icon: '🟠', name: 'AWS' },      { icon: '💡', name: 'VS Code' },
]

export default function Integrations() {
  return (
    <section id="integrations" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          // Integrations
        </div>
        <h2 className="reveal" style={{ fontFamily: 'var(--font)', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16 }}>
          Works with your<br />existing stack.
        </h2>
        <p className="reveal" style={{ fontSize: 16, color: 'var(--text2)', maxWidth: 520, lineHeight: 1.65, fontWeight: 300 }}>
          Native plugins for every major CI/CD, SCM, ticketing, and communication tool your team already uses.
        </p>

        <div
          className="reveal"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginTop: 50 }}
        >
          {integrations.map((int) => (
            <div
              key={int.name}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 12px', textAlign: 'center', transition: 'border-color .2s, background .2s', cursor: 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(27,127,255,0.2)'; e.currentTarget.style.background = 'var(--card2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)' }}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }}>{int.icon}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{int.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}