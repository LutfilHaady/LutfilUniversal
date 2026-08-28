import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/scan', label: 'Scan / Search' },
  { to: '/main-batch', label: 'Main Batch' },
  { to: '/finished-lots', label: 'Finished Lots' },
  { to: '/recall', label: 'Recall' },
  { to: '/reports', label: 'Reports' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="header-accent" aria-hidden />
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <div className="brand-title">Flint Traceability</div>
            <div className="brand-sub">Linear production · MES prototype</div>
          </div>
        </div>
        <nav className="nav-pills" aria-label="Primary">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `btn-pill nav-link${isActive ? ' active' : ''}`
              }
              end={to === '/'}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
