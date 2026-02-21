import React, { useState } from 'react';

const CREDENTIALS = {
  admin: { username: 'admin', password: 'admin123' },
  staff: { username: 'staff', password: 'staff123' },
};

const LoginPage = ({ onLogin }) => {
  const [role, setRole] = useState('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const creds = CREDENTIALS[role];
    if (username === creds.username && password === creds.password) {
      onLogin(role);
    } else {
      setError('Incorrect username or password. Please try again.');
    }
    setLoading(false);
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

        .login-body { padding: 28px 32px 24px; }

        .role-tabs { display: flex; border: 1px solid #c8dbd8; margin-bottom: 22px; }
        .role-tab {
          flex: 1; padding: 9px 0; border: none;
          background: #f7fafa; color: #7a9b97;
          font-size: 13px; font-weight: 500; cursor: pointer;
          font-family: inherit; transition: all 0.15s;
          border-right: 1px solid #c8dbd8;
        }
        .role-tab:last-child { border-right: none; }
        .role-tab.active { background: #2FB7A1; color: #fff; font-weight: 600; }
        .role-tab:not(.active):hover { background: #e8f4f2; color: #2FB7A1; }

        .field { margin-bottom: 12px; }
        .field label { display: block; font-size: 12px; color: #5a7874; margin-bottom: 5px; font-weight: 500; }
        .field-wrap { position: relative; }
        .field input {
          width: 100%; height: 40px; padding: 0 12px;
          border: 1px solid #c8dbd8; background: #fff;
          font-size: 14px; color: #1a2e2b; font-family: inherit;
          outline: none; transition: border-color 0.15s;
        }
        .field input:focus { border-color: #2FB7A1; background: #f7fdfb; }
        .field input::placeholder { color: #b0c8c4; }

        .pw-toggle {
          position: absolute; right: 0; top: 0; bottom: 0; width: 38px;
          background: none; border: none; cursor: pointer; color: #9ab8b4;
          display: flex; align-items: center; justify-content: center;
        }
        .pw-toggle:hover { color: #2FB7A1; }

        .error-msg {
          background: #fff5f5; border: 1px solid #fca5a5;
          border-left: 3px solid #ef4444;
          padding: 9px 12px; font-size: 12.5px; color: #b91c1c;
          margin-bottom: 14px;
        }

        .submit-btn {
          width: 100%; height: 42px;
          background: #2FB7A1; color: #fff; border: none;
          font-size: 14px; font-weight: 600; font-family: inherit;
          cursor: pointer; letter-spacing: 0.8px;
          transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          margin-top: 18px;
        }
        .submit-btn:hover:not(:disabled) { background: #27a090; }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-footer {
          border-top: 1px solid #e8f0ee;
          padding: 14px 32px; background: #f7fafa;
        }
        .demo-row { font-size: 11.5px; color: #8aada9; line-height: 1.8; }
        .demo-row strong { color: #2FB7A1; }
        .security-notice {
          margin-top: 10px; font-size: 11px; color: #9ab8b4;
          text-align: center; line-height: 1.6;
        }

        @media (max-width: 480px) {
          .login-body { padding: 22px 20px 18px; }
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
            <div className="role-tabs">
              <button
                type="button"
                className={`role-tab ${role === 'admin' ? 'active' : ''}`}
                onClick={() => { setRole('admin'); setError(''); setUsername(''); setPassword(''); }}
              >
                🔐 Admin
              </button>
              <button
                type="button"
                className={`role-tab ${role === 'staff' ? 'active' : ''}`}
                onClick={() => { setRole('staff'); setError(''); setUsername(''); setPassword(''); }}
              >
                👤 Staff
              </button>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="field">
                <label>Username</label>
                <input
                  type="text"
                  placeholder={role === 'admin' ? 'admin' : 'staff'}
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  autoFocus
                  required
                  autoComplete="username"
                />
              </div>

              <div className="field">
                <label>Password</label>
                <div className="field-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: '38px' }}
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                    {showPassword ? (
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <div className="error-msg">{error}</div>}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? <><div className="spinner" /> Signing in...</> : 'LOGIN'}
              </button>
            </form>
          </div>

          <div className="login-footer">
            <div className="demo-row">
              <strong>Admin</strong> → admin / admin123 &nbsp;·&nbsp; <strong>Staff</strong> → staff / staff123
            </div>
            <div className="security-notice">
              Authorized personnel only. All access is logged.
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default LoginPage;