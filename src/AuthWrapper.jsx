import React, { useState, useEffect } from 'react';
import LoginPage, { getRoleFromGoogleProfile } from './LoginPage';
import InventorySystem from './InventorySystem';

const SESSION_KEY = 'affluence_session';

// ─── Token Exchange ────────────────────────────────────────────────────────────
// In production this MUST be done server-side to protect your client_secret.
// Point this at your own backend endpoint (e.g. /api/auth/google/callback).
const TOKEN_EXCHANGE_URL = '/api/auth/google/callback';

async function exchangeCodeForProfile(code) {
  const res = await fetch(TOKEN_EXCHANGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.statusText}`);
  // Expected response: { email, name, picture, ... }
  return res.json();
}

// ─── AuthWrapper ───────────────────────────────────────────────────────────────
const AuthWrapper = () => {
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [oauthError, setOauthError] = useState('');

  // ── 1. On mount: restore existing session OR handle OAuth callback ──────────
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // OAuth error returned by Google
    if (error) {
      setOauthError(`Google sign-in was cancelled or denied. Please try again.`);
      clearURLParams();
      setLoaded(true);
      return;
    }

    // OAuth callback with authorization code
    if (code) {
      // Validate state (CSRF check)
      const savedState = sessionStorage.getItem('oauth_state');
      sessionStorage.removeItem('oauth_state');

      if (!savedState || savedState !== state) {
        setOauthError('Invalid OAuth state. Please try signing in again.');
        clearURLParams();
        setLoaded(true);
        return;
      }

      clearURLParams();
      handleOAuthCode(code);
      return;
    }

    // No callback — try restoring saved session
    restoreSession();
    setLoaded(true);
  }, []);

  function clearURLParams() {
    window.history.replaceState({}, '', window.location.pathname);
  }

  function restoreSession() {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          setSession(parsed);
          return;
        }
      }
    } catch (_) {}
    localStorage.removeItem(SESSION_KEY);
  }

  async function handleOAuthCode(code) {
    try {
      const profile = await exchangeCodeForProfile(code);
      const role = getRoleFromGoogleProfile(profile.email);

      if (!role) {
        setOauthError(
          `Access denied. Your account (${profile.email}) is not authorized for this portal.`
        );
        setLoaded(true);
        return;
      }

      const sess = {
        role,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        loggedInAt: Date.now(),
        expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      localStorage.setItem('userRole', role);
      setSession(sess);
    } catch (err) {
      console.error('OAuth error:', err);
      setOauthError('Sign-in failed. Please try again or contact your administrator.');
    } finally {
      setLoaded(true);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('userRole');
    setSession(null);
    setOauthError('');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!loaded) return null;

  if (!session) {
    return <LoginPage oauthError={oauthError} />;
  }

  return <InventorySystem onLogout={handleLogout} />;
};

export default AuthWrapper;