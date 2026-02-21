import React, { useState, useEffect } from 'react';
import LoginPage from './LoginPage';
import InventorySystem from './InventorySystem';

const SESSION_KEY = 'affluence_session';

const AuthWrapper = () => {
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
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
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    localStorage.setItem('userRole', role);
    setSession(sess);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (!loaded) return null;
  if (!session) return <LoginPage onLogin={handleLogin} />;

  // Pass onLogout into InventorySystem — it will render the button inside Settings
  return <InventorySystem onLogout={handleLogout} />;
};

export default AuthWrapper;