'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  House,
  Sun,
  CalendarDays,
  Lightbulb,
  FileText,
  Images,
  Radio,
  TrendingUp,
  ChartNoAxesCombined,
  MessagesSquare,
  Settings,
  Search,
  Plus,
  PanelLeftClose,
  Menu,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { Button } from './ui/button';
const navigation = [
  ['Home', '/', House],
  ['Morning Review', '/morning-review', Sun],
  ['Calendar', '/calendar', CalendarDays],
  ['Ideas', '/ideas', Lightbulb],
  ['Posts', '/posts', FileText],
  ['Media', '/media', Images],
  ['Intelligence', '/intelligence', Radio],
  ['Trends', '/trends', TrendingUp],
  ['Analytics', '/analytics', ChartNoAxesCombined],
  ['AI Assistant', '/assistant', MessagesSquare],
  ['Settings', '/settings', Settings],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="workspace">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Layers size={20} />
          </span>
          Fieldnotes<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-picker">
          <span className="avatar small">S</span>
          <div>
            <strong>Personal workspace</strong>
            <span>Just you. Your next idea.</span>
          </div>
          <PanelLeftClose size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(([label, href, Icon], index) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-item ${pathname === href ? 'active' : ''} ${index === 6 || index === 10 ? 'nav-divider' : ''}`}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Morning Review' && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-indicator">
            <i /> Local foundation
          </div>
          <p>
            Your ideas stay in your workspace.
            <br />
            Publishing is simulated.
          </p>
          <Link href="/settings" className="user-card">
            <span className="avatar">S</span>
            <span>
              <strong>Shay</strong>
              <small>Personal account</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      {open && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>
              {navigation.find(([, href]) => href === pathname)?.[0] ||
                'Create'}
            </strong>
          </div>
          <form action="/search" className="global-search">
            <Search size={16} />
            <input
              aria-label="Search workspace"
              name="q"
              placeholder="Search your workspace…"
            />
            <kbd>↵</kbd>
          </form>
          <Button asChild size="sm">
            <Link href="/create">
              <Plus size={16} />
              Create
            </Link>
          </Button>
          <Link
            href="/settings"
            className="avatar top-avatar"
            aria-label="Profile and settings"
          >
            S
          </Link>
        </header>
        <main>{children}</main>
        <footer>
          Fieldnotes <span>Private content workspace</span>
          <span className="ml-auto">
            Foundation · Sample intelligence & analytics
          </span>
        </footer>
      </div>
    </div>
  );
}
