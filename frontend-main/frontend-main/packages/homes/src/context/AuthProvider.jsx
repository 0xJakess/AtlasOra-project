import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import resolveUrl from 'library/helpers/resolveURL';

export const AuthContext = React.createContext();

const AuthProvider = (props) => {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });

  const loggedIn = !!user && !!token;

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  // ✅ Move redirect logic here
  useEffect(() => {
    if (loggedIn) {
      const returnTo = localStorage.getItem('returnTo');
      if (returnTo && returnTo !== '/login') {
        console.log('🔁 Redirecting to returnTo:', returnTo);
        localStorage.removeItem('returnTo');
        navigate(returnTo, { replace: true });
      }
    }
  }, [loggedIn]);

  const signIn = async ({ identifier, password }) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}auth/local`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const data = await response.json();
      // data.user.avatar = '/images/favicon.png';

      setUser(data.user);
      setToken(data.jwt);

      // ✅ Do not navigate here
      return { success: true };
    } catch (error) {
      console.error('Sign-in error:', error);
      throw error;
    }
  };

  const signUp = async ({ username, email, password }) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_APP_API_URL}auth/local/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const data = await response.json();
      // data.user.avatar = '/images/favicon.png';

      navigate('/sign-in', { replace: true });
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logOut = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('returnTo');
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider
      value={{
        loggedIn,
        user,
        token,
        signIn,
        signUp,
        logOut,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
