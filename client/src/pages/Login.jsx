import React, { useState } from 'react';
import { api } from '../api.js';

export function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await api.post('/api/auth/login', { name, password }));
    } catch {
      setError('Nome o password non validi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>Il nostro calendario</h1>
      <p className="login__sub">un giorno alla volta, insieme</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome"
        autoComplete="username"
        autoCapitalize="none"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
      />
      <button disabled={busy || !name || !password}>
        {busy ? 'Un attimo…' : 'Entra'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
