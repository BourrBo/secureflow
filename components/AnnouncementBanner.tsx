export default function AnnouncementBanner() {
  return (
    <div
      style={{
        background:
          'linear-gradient(90deg, rgba(27,127,255,0.15), rgba(0,212,255,0.1), rgba(27,127,255,0.15))',
        borderBottom: '1px solid rgba(27,127,255,0.2)',
        padding: '8px 24px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text2)',
      }}
    >
      🎉 SecureFlow v2.0 is now GA — AI-powered fix engine + zero-day SBOM alerts.{' '}
      <a
        href="#pricing"
        style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 500 }}
      >
        See what&apos;s new →
      </a>
    </div>
  )
}
