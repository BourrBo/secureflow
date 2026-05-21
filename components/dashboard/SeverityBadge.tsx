type Severity = 'critical' | 'high' | 'medium' | 'low' | 'resolved' | 'open' | 'inreview'

const config: Record<Severity, { bg: string; color: string; label: string }> = {
  critical:  { bg: 'rgba(192,55,42,0.15)',  color: '#FF6B6B', label: 'Critical' },
  high:      { bg: 'rgba(184,106,0,0.15)',  color: '#FFB020', label: 'High' },
  medium:    { bg: 'rgba(27,127,255,0.15)', color: '#4D9FFF', label: 'Medium' },
  low:       { bg: 'rgba(255,255,255,0.07)',color: 'rgba(255,255,255,0.4)', label: 'Low' },
  resolved:  { bg: 'rgba(0,229,118,0.12)',  color: '#00E576', label: 'Resolved' },
  open:      { bg: 'rgba(192,55,42,0.12)',  color: '#FF6B6B', label: 'Open' },
  inreview:  { bg: 'rgba(27,127,255,0.12)', color: '#4D9FFF', label: 'In Review' },
}

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const c = config[severity]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 10, fontWeight: 500,
      padding: '2px 8px', borderRadius: 10,
      background: c.bg, color: c.color,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}
