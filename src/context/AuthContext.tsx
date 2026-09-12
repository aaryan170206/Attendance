import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;

  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{
    error: any;
  }>;

  signIn: (
    email: string,
    password: string
  ) => Promise<{
    error: any;
  }>;

  signOut: () => Promise<{
    error: any;
  }>;
};

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    const { error } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "student",
          },
        },
      });

    return { error };
  };

  const signIn = async (
    email: string,
    password: string
  ) => {
    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    return { error };
  };

  const signOut = async () => {
    const { error } =
      await supabase.auth.signOut();

    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}