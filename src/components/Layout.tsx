import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AppErrorBoundary } from "./AppErrorBoundary";

function navCls({ isActive }: { isActive: boolean }) {
  return isActive ? "active-nav" : undefined;
}

export function Layout() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Career-Ops</div>
        <nav className="nav">
          <NavLink to="/" end className={navCls}>
            Dashboard
          </NavLink>
          <NavLink to="/profile" className={navCls}>
            CV / profile
          </NavLink>
          <NavLink to="/evaluate" className={navCls}>
            Evaluate
          </NavLink>
          <NavLink to="/jobs" className={navCls}>
            Jobs
          </NavLink>
          <NavLink to="/scan" className={navCls}>
            Scan
          </NavLink>
          <NavLink to="/patterns" className={navCls}>
            Patterns
          </NavLink>
          <NavLink to="/tracker" className={navCls}>
            Tracker
          </NavLink>
          <NavLink to="/followups" className={navCls}>
            Follow-ups
          </NavLink>
          <NavLink to="/system" className={navCls}>
            System
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <AppErrorBoundary key={location.pathname}>
          <Outlet />
        </AppErrorBoundary>
      </main>
    </div>
  );
}
