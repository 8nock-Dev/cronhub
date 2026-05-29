import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [token,   setToken]   = useState(() => localStorage.getItem('ch_token'));
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => { localStorage.removeItem('ch_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login  = (t, u) => { localStorage.setItem('ch_token', t); setToken(t); setUser(u); };
  const logout = ()     => { localStorage.removeItem('ch_token'); setToken(null); setUser(null); };

  return <Ctx.Provider value={{ token, user, login, logout, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
