'use client'
const testimonials = [
  { quote: '"SecureFlow cut our critical finding backlog by 70% in 6 weeks. The AI fix engine alone saves our devs hours every sprint."', name: 'Arjun Kapoor', role: 'Head of AppSec · FinTech Startup', initials: 'AK', avatarBg: '#1B7FFF' },
  { quote: '"We replaced three separate tools — Semgrep, Snyk, and Gitleaks — with SecureFlow. One dashboard, one bill, better coverage."', name: 'Sunita Rao', role: 'VP Engineering · SaaS Platform', initials: 'SR', avatarBg: '#0D8A6A' },
  { quote: '"The SBOM generation and OWASP compliance reports made our ISO 27001 audit painless. Auditors were impressed by the detail."', name: 'Mihail Voicu', role: 'CTO · Healthcare Platform', initials: 'MV', avatarBg: '#B86A00' },
]

export default function Testimonials() {
  return (
    <section style={{ padding: '100px 24px', background: 'var(--bg2)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="reveal" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          // Trusted by teams
        </div>
        <h2 className="reveal" style={{ fontFamily: 'var(--font)', fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
          What security teams say.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 56 }}>
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`reveal${i === 1 ? ' reveal-delay-1' : i === 2 ? ' reveal-delay-2' : ''}`}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, transition: 'border-color .2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(27,127,255,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ color: '#FFB020', fontSize: 12, marginBottom: 12 }}>★★★★★</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic', fontWeight: 300 }}>{t.quote}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: t.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}