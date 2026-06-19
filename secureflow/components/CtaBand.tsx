export default function CtaBand() {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(27,127,255,0.12) 0%, rgba(0,212,255,0.06) 100%)',
        borderTop: '1px solid rgba(27,127,255,0.2)',
        borderBottom: '1px solid rgba(27,127,255,0.2)',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <h2
        className="reveal"
        style={{
          fontFamily: 'var(--font)', fontSize: 'clamp(28px,4vw,50px)',
          fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 14,
        }}
      >
        Start securing your code<br />
        <span className="gradient-text">in under 3 minutes.</span>
      </h2>
      <p
        className="reveal reveal-delay-1"
        style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 32, fontWeight: 300 }}
      >
        Connect your first repo free. No credit card. No setup calls. Just security.
      </p>
      <div
        className="reveal reveal-delay-2"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}
      >
        <a
          href="/signup"
          style={{
            fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600,
            padding: '14px 28px', borderRadius: 9, textDecoration: 'none',
            background: 'var(--blue)', color: '#fff', border: 'none',
            boxShadow: '0 0 40px rgba(27,127,255,0.35)',
          }}
        >
          Start scanning free →
        </a>
        <a
          href="/login"
          style={{
            fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600,
            padding: '14px 28px', borderRadius: 9, textDecoration: 'none',
            background: 'transparent', color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          Book a demo
        </a>
      </div>
    </div>
  )
}