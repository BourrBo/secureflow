interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  subUp?: boolean
  subDown?: boolean
  accentColor?: string
}

export default function StatCard({ label, value, sub, subUp, subDown, accentColor = '#1B7FFF' }: StatCardProps) {
  return (
    <div style={{
      background: 'rgba(13,27,46,0.8)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 300, color: '#F0F4FF', letterSpacing: '-1px', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4, color: subUp ? '#00E576' : subDown ? '#FF3B5C' : 'rgba(255,255,255,0.35)' }}>
          {sub}
        </div>
      )}
      <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: accentColor, width: 28 }} />
    </div>
  )
}
