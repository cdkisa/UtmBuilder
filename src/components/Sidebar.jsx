import { NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

const navItems = [
  { to: '/', label: 'Links', icon: '🔗' },
  { to: '/qr-codes', label: 'QR Codes', icon: '⊞' },
  { to: '/templates', label: 'Templates', icon: '📄' },
  { to: '/parameters', label: 'Parameters', icon: '📋' },
  { to: '/attributes', label: 'Attributes', icon: '🏷️' },
  { to: '/link-shorteners', label: 'Link Shorteners', icon: '✂️' },
  { to: '/rules', label: 'Rules', icon: '📏' },
  { to: '/members', label: 'Members', icon: '👥' },
];

export default function Sidebar({ collapsed, onToggle, open, onClose, pinned, onPinToggle, onNavigate }) {
  const location = useLocation();
  const showLabels = !collapsed || open;

  useEffect(() => {
    onNavigate?.();
  }, [location.pathname]);

  return (
    <aside
      className={`
        flex flex-col h-screen bg-white border-r border-gray-100 shrink-0
        transition-[transform,width] duration-200 ease-out
        fixed md:relative inset-y-0 left-0 z-40
        w-56
        md:transition-[width] md:duration-200
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${collapsed ? 'md:w-16' : 'md:w-56'}
      `}
    >
      {/* Logo */}
      <div className={`h-14 flex items-center border-b border-gray-100 gap-2 shrink-0 ${!showLabels ? 'px-0 justify-center' : 'px-4'}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
          U
        </div>
        {showLabels && <span className="font-display font-bold text-brand-700 text-sm tracking-tight truncate">UTM Builder</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${!showLabels ? 'justify-center px-2' : ''}`
            }
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {showLabels && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer: pin + collapse (desktop) / close (mobile) */}
      <div className="border-t border-gray-100 flex flex-col shrink-0">
        <div className={`flex items-center ${!showLabels ? 'flex-col gap-1 py-2' : 'flex-row gap-2 px-3 py-2'}`}>
          <button
            type="button"
            onClick={onPinToggle}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            className={`flex items-center justify-center text-gray-400 hover:text-brand-600 transition rounded p-2 ${!showLabels ? 'w-full' : ''}`}
            aria-label={pinned ? 'Unpin' : 'Pin'}
          >
            <span className={pinned ? '📌' : '📍'} aria-hidden="true" />
            {showLabels && <span className="text-xs ml-1">{pinned ? 'Unpin' : 'Pin'}</span>}
          </button>
          <button
            type="button"
            onClick={() => { onToggle?.(); onClose?.(); }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="md:flex hidden items-center justify-center text-gray-400 hover:text-gray-600 transition rounded p-2"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close menu"
            className="md:hidden flex items-center justify-center text-gray-400 hover:text-gray-600 transition rounded p-2"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}
