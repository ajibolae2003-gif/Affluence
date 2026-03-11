import React, { useState, useEffect } from 'react';

// ─── OAuth Configuration ───────────────────────────────────────────────────────
// Replace these with your actual values from Google Cloud Console
const GOOGLE_CLIENT_ID = '194155024600-ns3i7n7n34bgn5em6lfef7l4647m4lcl.apps.googleusercontent.com';
const GOOGLE_REDIRECT_URI = window.location.origin + '/auth/callback';
const GOOGLE_SCOPES = 'openid email profile';

// Role assignment: map allowed Google email domains or specific emails → role
// Customize this to your organization's needs
const ROLE_MAP = {
  // Specific emails take priority
  emails: {
    'admin@affluenceglobaldream.com': 'admin',
    'fasloteam@gmail.com': 'admin',
    "tundee@gmail.com":"admin",
    "talk2austin007@gmail.com":"admin",

    // STaff emails
    'staff1@gmail.com': 'staff',
    'staff2@gmail.com': 'staff',
    'ajibolae2003@gmail.com': 'staff',  // example
  },
  // Domain fallback
  domains: {
    'affluenceglobaldream.com': 'staff',
  },
};

export function getRoleFromGoogleProfile(email = '') {
  if (ROLE_MAP.emails[email]) return ROLE_MAP.emails[email];
  const domain = email.split('@')[1];
  return ROLE_MAP.domains[domain] || null; // null = unauthorized
}

export function buildGoogleOAuthURL(state = '') {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── LoginPage Component ───────────────────────────────────────────────────────
const LoginPage = ({ onLogin, oauthError }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    setLoading(true);
    // Generate random state for CSRF protection
    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth_state', state);
    window.location.href = buildGoogleOAuthURL(state);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f4f3; }

        .login-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f0f4f3;
          font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', -apple-system, sans-serif;
          padding: 20px;
        }

        .login-box {
          background: #ffffff;
          border: 1px solid #d8e4e2;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.07);
        }

        .login-header {
          background: #2FB7A1;
          padding: 28px 32px 24px;
          text-align: center;
          border-bottom: 3px solid #27a090;
        }
        .login-logo {
          width: 58px; height: 58px;
          background: rgba(255,255,255,0.15);
          border: 2px solid rgba(255,255,255,0.4);
          border-radius: 50%;
          margin: 0 auto 12px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; padding: 6px;
        }
        .login-logo img {
          width: 100%; height: 100%; object-fit: contain;
          filter: brightness(0) invert(1);
        }
        .login-org { color: #fff; font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
        .login-system { color: rgba(255,255,255,0.78); font-size: 12px; margin-top: 3px; letter-spacing: 0.3px; }

        .login-body { padding: 32px 32px 28px; }

        .login-subtitle {
          text-align: center;
          font-size: 13px;
          color: #6b9490;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .google-btn {
          width: 100%;
          height: 46px;
          background: #fff;
          border: 1.5px solid #c8dbd8;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #1a2e2b;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.2px;
        }
        .google-btn:hover:not(:disabled) {
          border-color: #2FB7A1;
          background: #f7fdfb;
          box-shadow: 0 2px 8px rgba(47,183,161,0.12);
        }
        .google-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .google-icon { width: 20px; height: 20px; flex-shrink: 0; }

        .divider {
          display: flex; align-items: center; gap: 12px;
          margin: 22px 0; color: #aecbc7; font-size: 11px;
        }
        .divider::before, .divider::after {
          content: ''; flex: 1; height: 1px; background: #ddecea;
        }

        .access-notice {
          background: #f7fafa;
          border: 1px solid #ddecea;
          border-left: 3px solid #2FB7A1;
          padding: 10px 14px;
          font-size: 12px;
          color: #5a7874;
          line-height: 1.6;
        }
        .access-notice strong { color: #2FB7A1; }

        .error-msg {
          background: #fff5f5;
          border: 1px solid #fca5a5;
          border-left: 3px solid #ef4444;
          padding: 10px 14px;
          font-size: 12.5px;
          color: #b91c1c;
          margin-bottom: 18px;
          line-height: 1.5;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid #c8dbd8;
          border-top-color: #2FB7A1;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-footer {
          border-top: 1px solid #e8f0ee;
          padding: 14px 32px;
          background: #f7fafa;
        }
        .security-notice {
          font-size: 11px; color: #9ab8b4;
          text-align: center; line-height: 1.6;
        }

        @media (max-width: 480px) {
          .login-body { padding: 24px 20px 20px; }
          .login-header { padding: 22px 20px 18px; }
          .login-footer { padding: 12px 20px; }
        }
      `}</style>

      <div className="login-root">
        <div className="login-box">

          <div className="login-header">
            <div className="login-logo">
              <img
                src="https://cdn.affluenceglobaldream.com/media/site_logo/1701419965-B88E_crop_-78--p--00_7--p--19_2156--p--00_2148--p--81_0--p--00.png"
                alt="Affluence Global"
              />
            </div>
            <div className="login-org">Affluence Global Dream</div>
            <div className="login-system">Inventory Management Portal</div>
          </div>

          <div className="login-body">
            <p className="login-subtitle">
              Sign in with your organization Google account to continue.
            </p>

            {oauthError && (
              <div className="error-msg">{oauthError}</div>
            )}

            <button
              className="google-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Redirecting to Google…
                </>
              ) : (
                <>
                  <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <div className="divider">Access restricted</div>

            <div className="access-notice">
              Only <strong>@affluenceglobaldream.com</strong> accounts are authorized.
              Role is assigned automatically based on your email.
            </div>
          </div>

          <div className="login-footer">
            <div className="security-notice">
              Authorized personnel only. All access is logged and monitored.
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default LoginPage;