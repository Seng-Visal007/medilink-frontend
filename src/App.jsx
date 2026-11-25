import { useState } from 'react';
import { api } from './api';
import Patient from './Patient';
import Doctor from './Doctor';
import Admin from './Admin';

export default function App() {
  const [session, setSession] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async event => {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      if (/^\d+$/.test(identifier.trim())) {
        const result = await api('/auth/patient', { method: 'POST', body: { national_id: identifier.trim(), otp: credential } });
        setSession({ role: 'patient', token: result.token, user: result.patient });
      } else {
        const result = await api('/auth/staff', { method: 'POST', body: { username: identifier.trim(), password: credential } });
        setSession({ role: result.staff.role, token: result.token, user: result.staff });
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const logout = () => setSession(null);
  if (session?.role === 'patient') return <Patient session={session} logout={logout} />;
  if (session?.role === 'doctor') return <Doctor session={session} logout={logout} />;
  if (session?.role === 'admin') return <Admin session={session} logout={logout} />;

  return <div className="login-shell">
    <main className="login-main">
      <span className="login-mark">◇</span>
      <h1>MediLink Health</h1>
      <p className="mut">Ministry of Health · National Digital Health Wallet</p>
      <form className="login-form" onSubmit={login}>
        <label htmlFor="identifier">National ID or username</label>
        <input id="identifier" autoComplete="username" value={identifier}
          onChange={event => setIdentifier(event.target.value)} placeholder="Enter your National ID or username" required />
        <label htmlFor="credential">OTP or password</label>
        <input id="credential" type="password" autoComplete="current-password" value={credential}
          onChange={event => setCredential(event.target.value)} placeholder="Patient OTP or staff password" required />
        <p className="mut">Patients: enter any 6-digit demo OTP. Staff: use your assigned password.</p>
        {error && <p className="err">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Verify & Sign In →'}</button>
      </form>
    </main>
    <footer className="login-footer">♙ &nbsp;End-to-end consent protected by CamDX National Identity</footer>
  </div>;
}
