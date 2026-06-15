import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/judge', label: 'Questions', end: false },
  { to: '/themes', label: 'Themes', end: false },
  { to: '/profile', label: 'Profile', end: false },
];

export function Sidebar({ name }: { name: string }) {
  return (
    <aside className="sidebar">
      <div className="logo serif">P</div>

      <nav className="nav">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="dot" />
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-spacer" />
      <div className="vertical-tag">Shape your tastes, shape your world.</div>

      <div className="user-chip">
        <div className="avatar serif">{name.charAt(0).toUpperCase()}</div>
        <div>
          <div className="name">{name}</div>
          <div className="sub">Local mindfile</div>
        </div>
      </div>
    </aside>
  );
}
