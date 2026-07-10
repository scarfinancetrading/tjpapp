import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = "investingforfuture09121110@gmail.com";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profileStatus: string | null;
  profileLoading: boolean;
  hasAccess: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawStatus, setRawStatus] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const isAdmin = !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL;
  const hasAccess = isAdmin || rawStatus === "active";
  const profileStatus = hasAccess ? "approved" : rawStatus;

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("status, admin_notified, email, stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (data) {
      setRawStatus(data.status);

      // Auto-sync subscription status when there's a stripe customer but status not active
      if (data.status !== "active" && (data as any).stripe_customer_id) {
        try {
          const { data: sync } = await supabase.functions.invoke("verify-checkout-session", { body: {} });
          if (sync?.status && sync.status !== data.status) setRawStatus(sync.status);
        } catch { /* ignore */ }
      }
    }
    setProfileLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) setTimeout(() => fetchProfile(session.user.id), 0);
        else { setRawStatus(null); setProfileLoading(false); }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id);
      else setProfileLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl } });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRawStatus(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profileStatus, profileLoading, hasAccess, isAdmin, refreshProfile, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
