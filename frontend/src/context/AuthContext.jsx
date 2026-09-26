import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMe, loginUser, registerUser } from '../services/auth.js';

const TOKEN_KEY = 'techstore_token';
const USER_KEY = 'techstore_user';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [hydrating, setHydrating] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!token) {
      setHydrating(false);
      return;
    }

    let cancelled = false;
    setHydrating(true);
    fetchMe(token)
      .then((fresh) => {
        if (cancelled) return;
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (credentials) => {
    const data = await loginUser(credentials);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setHydrating(false);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await registerUser(payload);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setHydrating(false);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setHydrating(false);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, hydrating, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
