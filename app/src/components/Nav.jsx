import { NavLink } from 'react-router-dom';

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconIdea() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-9.5-8.9A5.3 5.3 0 0 1 12 6.6a5.3 5.3 0 0 1 9.5 4.9c-2 4.4-9.5 9-9.5 9z" />
    </svg>
  );
}

const tabs = [
  { to: '/', label: 'Início', Icon: IconHome, key: null, end: true },
  { to: '/buscar', label: 'Buscar', Icon: IconSearch, key: 'search' },
  { to: '/curiosidades', label: 'Curiosidades', Icon: IconIdea, key: 'curiosities' },
  { to: '/apoiar', label: 'Apoiar', Icon: IconHeart, key: 'support' },
];

export default function Nav({ sections }) {
  return (
    <nav className="nav">
      {tabs
        .filter(t => !t.key || sections[t.key] !== false)
        .map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
    </nav>
  );
}
