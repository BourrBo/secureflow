'use client'
const footerCols = [
  {
    title: 'Product',
    links: ['Features', 'Pricing', 'Changelog', 'Roadmap', 'Status'],
  },
  {
    title: 'Developers',
    links: ['Documentation', 'API Reference', 'CLI Guide', 'GitHub Action', 'VS Code Plugin'],
  },
  {
    title: 'Security',
    links: ['OWASP Coverage', 'CWE Reference', 'SBOM Guide', 'Compliance', 'Vulnerability DB'],
  },
  {
    title: 'Company',
    links: ['About', 'Blog', 'Careers', 'Contact', 'Partners'],
  },
]

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        padding: '60px 24px 32px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Top grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: 40,
            marginBottom: 48,
          }}
        >
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, background: 'var(--blue)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                SF
              </div>
              <span style={{ fontFamily: 'var(--font)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                Secure<span style={{ color: 'var(--blue)' }}>Flow</span>
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 10, lineHeight: 1.6, maxWidth: 240 }}>
              Enterprise AppSec platform unifying SAST, SCA, Secrets, IaC, Container, and DAST scanning in one developer-first tool.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {['SOC2 Type II', 'ISO 27001', 'GDPR Ready'].map((b) => (
                <span
                  key={b}
                  style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    padding: '3px 8px', borderRadius: 4,
                    border: '1px solid var(--border)', color: 'var(--text3)',
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerCols.map((col) => (
            <div key={col.title}>
              <div style={{ fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {col.title}
              </div>
              {col.links.map((link) => (
                <a
                  key={link}
                  href="#"
                  style={{ display: 'block', fontSize: 13, color: 'var(--text3)', textDecoration: 'none', marginBottom: 8, transition: 'color .15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text3)')}
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderTop: '1px solid var(--border)', paddingTop: 24,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            © 2025 SecureFlow Technologies. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security'].map((l) => (
              <a
                key={l}
                href="#"
                style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none', transition: 'color .15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text3)')}
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}