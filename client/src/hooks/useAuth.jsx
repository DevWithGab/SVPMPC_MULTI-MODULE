import { useState, useCallback, useMemo, createContext, useContext } from 'react';
import { clearAuthSession, readAuthSession } from '../utils/authSession';

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  // Restore synchronously so routing and API calls see the same tab account.
  const [initialAuth] = useState(readAuthSession);
  const [user, setUser] = useState(initialAuth?.user ?? null);
  const [token, setToken] = useState(initialAuth?.token ?? null);

  // Update auth state when new data is provided
  const updateAuth = useCallback((newUser, newToken) => {
    setUser((prevUser) =>
      prevUser === newUser ? prevUser : newUser,
    );
    setToken((prevToken) =>
      prevToken === newToken ? prevToken : newToken,
    );
    if (newToken && newUser) {
      window.sessionStorage.setItem('token', newToken);
      window.sessionStorage.setItem('user', JSON.stringify(newUser));
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearAuthSession();
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading: false,
      logout,
      setUser,
      setToken,
      updateAuth,
    }),
    [user, token, logout, updateAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
