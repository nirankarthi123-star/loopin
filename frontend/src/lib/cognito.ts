/**
 * Authentication Service & Token Storage — LoopIn Frontend
 *
 * Implements:
 * 1. BackendJwtAuthService — Calls Lambda Function URL /auth/login and /auth/register
 *    and stores verified JWT token in client storage.
 * 2. DemoAuthService — Standalone offline demo authentication for VITE_APP_MODE=demo.
 */

import { IS_DEMO, API_BASE_URL } from "./env.ts";

export interface AuthSession {
  userId: string;
  email: string;
  displayName: string;
  campusId: string;
  idToken: string;
  accessToken: string;
  emailVerified: boolean;
  campusVerified: boolean;
}

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
  campusId: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

// ── Demo Auth Implementation ──────────────────────────────────────────────────

class DemoAuthService {
  private currentSession: AuthSession | null = {
    userId: "demo-user-001",
    email: "niranjna.karthikeyan@vit.ac.in",
    displayName: "Niranjna Karthikeyan",
    campusId: "campus-vit-chennai",
    idToken: "mock-demo-id-token-niranjna",
    accessToken: "mock-demo-access-token-niranjna",
    emailVerified: false,
    campusVerified: true,
  };

  async getSession(): Promise<AuthSession | null> {
    return this.currentSession;
  }

  async signIn({ email }: SignInParams): Promise<AuthSession> {
    const isCampus = email.endsWith(".ac.in") || email.endsWith(".edu");
    this.currentSession = {
      userId: "demo-user-001",
      email,
      displayName: email.split("@")[0]?.replace(".", " ") ?? "Demo Student",
      campusId: "campus-vit-chennai",
      idToken: `mock-id-token-${Date.now()}`,
      accessToken: `mock-access-token-${Date.now()}`,
      emailVerified: false,
      campusVerified: isCampus,
    };
    return this.currentSession;
  }

  async signUp(_params: SignUpParams): Promise<{ userConfirmed: boolean; userSub: string }> {
    return {
      userConfirmed: true,
      userSub: `demo-sub-${Date.now()}`,
    };
  }

  async confirmSignUp(email: string, _code: string): Promise<boolean> {
    const isCampus = email.endsWith(".ac.in") || email.endsWith(".edu");
    this.currentSession = {
      userId: `demo-user-${Date.now()}`,
      email,
      displayName: email.split("@")[0] ?? "Student",
      campusId: "campus-vit-chennai",
      idToken: `mock-confirmed-id-token-${Date.now()}`,
      accessToken: `mock-confirmed-access-token-${Date.now()}`,
      emailVerified: false,
      campusVerified: isCampus,
    };
    return true;
  }

  async signOut(): Promise<void> {
    this.currentSession = null;
  }
}

// ── Production Backend JWT Auth Service ────────────────────────────────────────

const STORAGE_KEY = "loopin_auth_session";

class BackendJwtAuthService {
  private inMemorySession: AuthSession | null = null;

  async getSession(): Promise<AuthSession | null> {
    if (this.inMemorySession) {
      return this.inMemorySession;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as AuthSession;
      this.inMemorySession = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  async signIn({ email, password }: SignInParams): Promise<AuthSession> {
    const baseUrl = API_BASE_URL?.replace(/\/$/, "") || "";
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = payload?.error?.message || payload?.message || `Sign in failed with status ${res.status}`;
      throw new Error(msg);
    }

    const data = payload?.data ?? payload;
    const session: AuthSession = {
      userId: data.user.userId,
      email: data.user.email,
      displayName: data.user.displayName,
      campusId: data.user.campusId,
      idToken: data.token,
      accessToken: data.token,
      emailVerified: Boolean(data.user.emailVerified),
      campusVerified: Boolean(data.user.campusVerified),
    };

    this.inMemorySession = session;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore localStorage exceptions in private browsing
    }

    return session;
  }

  async signUp(params: SignUpParams): Promise<{ userConfirmed: boolean; userSub: string }> {
    const baseUrl = API_BASE_URL?.replace(/\/$/, "") || "";
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = payload?.error?.message || payload?.message || `Registration failed with status ${res.status}`;
      throw new Error(msg);
    }

    const data = payload?.data ?? payload;
    const session: AuthSession = {
      userId: data.user.userId,
      email: data.user.email,
      displayName: data.user.displayName,
      campusId: data.user.campusId,
      idToken: data.token,
      accessToken: data.token,
      emailVerified: Boolean(data.user.emailVerified),
      campusVerified: Boolean(data.user.campusVerified),
    };

    this.inMemorySession = session;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore localStorage errors
    }

    return {
      userConfirmed: true,
      userSub: data.user.userId,
    };
  }

  async confirmSignUp(_email: string, _code: string): Promise<boolean> {
    return true;
  }

  async signOut(): Promise<void> {
    this.inMemorySession = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

// ── Export singleton based on execution mode ───────────────────────────────────

export const authService = IS_DEMO
  ? new DemoAuthService()
  : new BackendJwtAuthService();
