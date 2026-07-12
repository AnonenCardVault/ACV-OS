"use client";

type SignInWithPasswordArgs = {
  email: string;
  password: string;
};

type AuthResponse = {
  ok?: boolean;
  error?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

type BrowserAuthClient = {
  auth: {
    signInWithPassword(args: SignInWithPasswordArgs): Promise<AuthResponse>;
    signOut(): Promise<AuthResponse>;
  };
};

let browserAuthClient: BrowserAuthClient | undefined;

async function readAuthResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as AuthResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Supabase authentication request failed.");
  }
  return payload;
}

export function getSupabaseBrowserAuthClient() {
  if (browserAuthClient) return browserAuthClient;

  browserAuthClient = {
    auth: {
      async signInWithPassword({ email, password }) {
        const response = await fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        return readAuthResponse(response);
      },
      async signOut() {
        const response = await fetch("/api/auth/sign-out", { method: "POST" });
        return readAuthResponse(response);
      }
    }
  };

  return browserAuthClient;
}

