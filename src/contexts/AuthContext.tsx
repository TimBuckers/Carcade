import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { logger } from '../utils/logger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // Handle redirect result on page load (for mobile browsers)
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        logger.debug('Checking for redirect result...');
        const result = await getRedirectResult(auth);
        if (result) {
          logger.debug('User signed in via redirect:', result.user);
          setUser(result.user);
        } else {
          logger.debug('No redirect result found');
        }
      } catch (error) {
        logger.error('Error handling redirect result:', error);
      } finally {
        setInitializing(false);
      }
    };

    handleRedirectResult();
  }, []);

  useEffect(() => {
    // Only set up auth state listener after checking redirect result
    if (initializing) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      logger.debug('Auth state changed:', user?.email || 'null');
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [initializing]);

  const signInWithGoogle = async () => {
    try {
      // Detect if we're on iOS Safari or any mobile browser
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // Use redirect for iOS and mobile browsers for better compatibility
      if (isMobile || isIOS) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      logger.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      logger.error('Error signing out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};