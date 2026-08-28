interface SummaryCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: 'green' | 'amber' | 'red' | 'default'
}

export default function SummaryCard({ title, value, subtitle, icon, color = 'default' }: SummaryCardProps) {
  const colorClasses = {
    green: 'bg-status-success/10 text-status-success border-status-success/20',
    amber: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    red: 'bg-status-error/10 text-status-error border-status-error/20',
    default: 'bg-cream-beige/50 text-text-dark border-cream-grey',
  }
  
  return (
    <div className={`card border-2 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-70 mb-1">{title}</p>
          <p className="text-3xl font-bold mb-1">{value}</p>
          {subtitle && <p className="text-xs opacity-60">{subtitle}</p>}
        </div>
        {icon && <div className="text-3xl opacity-60">{icon}</div>}
      </div>
    </div>
  )
}

