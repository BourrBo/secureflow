const stats = [
  { num: '800+', label: 'Secret patterns detected' },
  { num: '20+',  label: 'Programming languages' },
  { num: '99.6%', label: 'Platform uptime SLA' },
  { num: '3min',  label: 'Avg time to first scan' },
]

export default function StatsBar() {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.num}
            className="reveal"
            style={{
              textAlign: 'center', padding: '0 24px', position: 'relative',
              borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font)', fontSize: 42, fontWeight: 800,
                letterSpacing: '-2px', lineHeight: 1,
                background: 'linear-gradient(135deg,#1B7FFF 0%,#00D4FF 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              {s.num}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
