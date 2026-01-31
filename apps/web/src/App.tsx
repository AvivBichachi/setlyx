import { useState, useEffect } from 'react';
import { apiFetch, setToken, clearToken, getToken } from './lib/api';

type Program = {
  id: number;
  name: string;
  type: string;
};

export default function App() {
  const [userId, setUserId] = useState('1');
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = !!getToken();

  async function login() {
    setError(null);
    try {
      const res = await apiFetch<{ accessToken: string }>(
        '/auth/dev-login',
        {
          method: 'POST',
          body: JSON.stringify({ userId: Number(userId) }),
        },
      );
      setToken(res.accessToken);
      await loadPrograms();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadPrograms() {
    try {
      const data = await apiFetch<Program[]>('/programs');
      setPrograms(data);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function logout() {
    clearToken();
    setPrograms(null);
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadPrograms();
    }
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>SETLYX – Dev UI</h1>

      {!isLoggedIn ? (
        <>
          <h2>Dev Login</h2>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="userId"
          />
          <button onClick={login} style={{ marginLeft: 8 }}>
            Login
          </button>
        </>
      ) : (
        <>
          <button onClick={logout}>Logout</button>

          <h2>Programs</h2>
          {programs ? (
            <ul>
              {programs.map((p) => (
                <li key={p.id}>
                  #{p.id} — {p.name} ({p.type})
                </li>
              ))}
            </ul>
          ) : (
            <p>Loading…</p>
          )}
        </>
      )}

      {error && (
        <pre style={{ color: 'crimson', marginTop: 16 }}>{error}</pre>
      )}
    </div>
  );
}
