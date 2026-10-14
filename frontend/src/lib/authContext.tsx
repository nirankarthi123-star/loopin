/**
 * Authentication Context & Store — LoopIn Frontend
 *
 * React Context providing auth state, sign-in, sign-up, confirmation,
 * session restoration, and token retrieval to all components.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { authService, type AuthSession, type SignInParams, type SignUpParams } from "@/lib/cognito.ts";

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  signIn: (params: SignInParams) => Promise<AuthSession>;
  signUp: (params: SignUpParams) => Promise<{ userConfirmed: boolean; userSub: string }>;
  confirmSignUp: (email: string, code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount
    authService
      .getSession()
      .then((activeSession) => {
        setSession(activeSession);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const signIn = async (params: SignInParams): Promise<AuthSession> => {
    const s = await authService.signIn(params);
    setSession(s);
    return s;
  };

  const signUp = async (params: SignUpParams) => {
    return authService.signUp(params);
  };

  const confirmSignUp = async (email: string, code: string) => {
    const ok = await authService.confirmSignUp(email, code);
    if (ok) {
      // Re-fetch session if automatically signed in
      const s = await authService.getSession();
      setSession(s);
    }
    return ok;
  };

  const signOut = async () => {
    await authService.signOut();
    setSession(null);
  };

  const getToken = (): string | null => {
    return session?.idToken ?? session?.accessToken ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signIn,
        signUp,
        confirmSignUp,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
