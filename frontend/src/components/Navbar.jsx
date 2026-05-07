import { Link, NavLink } from "react-router-dom";
import WalletButton from "./WalletButton";

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-40 backdrop-blur-md border-b border-white/10 shadow-sm"
         style={{ background: "rgba(10,10,18,0.85)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Brand logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            {/* Animated logo mark */}
            <div className="relative w-9 h-9 flex items-center justify-center rounded-xl overflow-hidden"
                 style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4)" }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white relative z-10" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style={{ background: "linear-gradient(135deg,#818cf8,#a78bfa,#22d3ee)" }} />
            </div>

            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-bold tracking-tight text-white">Cap</span>
              <span className="text-xl font-bold text-transparent bg-clip-text"
                    style={{ backgroundImage: "linear-gradient(135deg,#818cf8,#06b6d4)" }}>DAO</span>
            </div>

            {/* DAO badge */}
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                             text-indigo-300 border border-indigo-500/30"
                  style={{ background: "rgba(99,102,241,0.12)" }}>
              DAO
            </span>
          </Link>

          {/* Nav links + wallet */}
          <div className="flex items-center gap-5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive ? "text-white" : "text-slate-400 hover:text-white"}`
              }
            >
              Explore
            </NavLink>

            <NavLink
              to="/create"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive ? "text-white" : "text-slate-400 hover:text-white"}`
              }
            >
              Launch
            </NavLink>

            <div className="h-5 w-px bg-white/10" aria-hidden="true" />

            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
