import React, { useState, useEffect } from 'react';
import LoginPage from './LoginPage';
import InventorySystem from './InventorySystem'; // your existing component

// ─────────────────────────────────────────────
// AUTH WRAPPER
// Manages the session and bridges Login ↔ App
// ─────────────────────────────────────────────
const SESSION_KEY = 'affluence_session';

const AuthWrapper = () => {
  const [session, setSession] = useState(null); // null = not loaded yet
  const [loaded, setLoaded] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check expiry (8 hours)
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          setSession(parsed);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (_) {
      localStorage.removeItem(SESSION_KEY);
    }
    setLoaded(true);
  }, []);

  const handleLogin = (role) => {
    const sess = {
      role,
      loggedInAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    setSession(sess);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  // While checking localStorage, render nothing (avoids flash)
  if (!loaded) return null;

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Render the existing InventorySystem, injecting:
  //   1. The role so it doesn't need its own role-select dropdown
  //   2. A logout handler
  return (
    <InventorySystemWithLogout
      initialRole={session.role}
      onLogout={handleLogout}
    />
  );
};

// ─────────────────────────────────────────────
// Thin wrapper that adds a Logout button to InventorySystem.
// Because InventorySystem manages its own `userRole` state
// internally (via a <select>), we pass `initialRole` and
// add a logout button in the header via a portal-like trick.
// ─────────────────────────────────────────────
const InventorySystemWithLogout = ({ initialRole, onLogout }) => {
  // Patch localStorage so InventorySystem picks up the correct role
  useEffect(() => {
    localStorage.setItem('userRole', initialRole);
  }, [initialRole]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Logout button — floated over the header */}
      <LogoutButton onLogout={onLogout} role={initialRole} />
      <InventorySystem />
    </div>
  );
};

// ─────────────────────────────────────────────
// Floating Logout Button
// ─────────────────────────────────────────────
const LogoutButton = ({ onLogout, role }) => {
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <style>{`
        .logout-btn-wrap {
          position: fixed;
          top: 14px;
          /* sits just to the left of the existing header icons */
          right: 220px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .logout-session-badge {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 20px;
          background: rgba(47,183,161,0.12);
          color: #2FB7A1;
          border: 1px solid rgba(47,183,161,0.25);
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(220,38,38,0.08);
          color: #f87171;
          border: 1px solid rgba(220,38,38,0.2);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .logout-btn:hover {
          background: rgba(220,38,38,0.15);
          border-color: rgba(220,38,38,0.35);
          color: #ef4444;
        }

        /* Confirm overlay */
        .logout-confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .logout-confirm-card {
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 28px 28px 24px;
          max-width: 360px;
          width: 100%;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7);
          text-align: center;
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
        .logout-confirm-icon {
          width: 48px; height: 48px;
          border-radius: 50%;
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.25);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          font-size: 22px;
        }
        .logout-confirm-title {
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .logout-confirm-sub {
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          margin-bottom: 22px;
          line-height: 1.5;
        }
        .logout-confirm-actions {
          display: flex;
          gap: 10px;
        }
        .logout-cancel-btn {
          flex: 1;
          padding: 11px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          background: transparent;
          color: rgba(255,255,255,0.5);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .logout-cancel-btn:hover {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.75);
        }
        .logout-confirm-btn {
          flex: 1;
          padding: 11px;
          border: none;
          border-radius: 10px;
          background: #dc2626;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .logout-confirm-btn:hover {
          background: #b91c1c;
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .logout-btn-wrap { right: 12px; top: 56px; }
          .logout-session-badge { display: none; }
        }
      `}</style>

      <div className="logout-btn-wrap">
        <span className="logout-session-badge">
          {role === 'admin' ? '🔐 Admin' : '👤 Staff'}
        </span>
        <button className="logout-btn" onClick={() => setConfirm(true)}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Logout
        </button>
      </div>

      {confirm && (
        <div className="logout-confirm-overlay" onClick={() => setConfirm(false)}>
          <div className="logout-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="logout-confirm-icon">🔓</div>
            <div className="logout-confirm-title">Sign out?</div>
            <div className="logout-confirm-sub">
              You'll need to sign in again to access the inventory portal.
            </div>
            <div className="logout-confirm-actions">
              <button className="logout-cancel-btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="logout-confirm-btn" onClick={onLogout}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuthWrapper;