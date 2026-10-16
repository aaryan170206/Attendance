
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type AppRole = "student" | "teacher" | "admin";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  roleError: string | null;

  signUp: (
  email: string,
  password: string,
  fullName: string,
  rollNumber: string
) => Promise<{ error: any }>;

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: any }>;

  signOut: () => Promise<{ error: any }>;
};

const AuthContext =
  createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Prevent outdated role requests from updating the state
  const roleRequestId = useRef(0);

  // Load existing session and listen for authentication changes
  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setRoleError(error.message);
      }

      setSession(session);
      setUser(session?.user ?? null);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        // Clear role when user logs out
        if (!session) {
          roleRequestId.current++;
          setRole(null);
          setRoleError(null);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }
    );

    return () => {
      mounted = false;
      roleRequestId.current++;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch the authenticated user's role from Supabase
  useEffect(() => {
    const requestId = ++roleRequestId.current;

    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setRoleError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setRole(null);
      setRoleError(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // Ignore outdated requests
      if (requestId !== roleRequestId.current) return;

      if (error) {
        setRoleError(error.message);
        setRole(null);
        setLoading(false);
        return;
      }

      const fetchedRole = data?.role;

      if (
        fetchedRole === "student" ||
        fetchedRole === "teacher" ||
        fetchedRole === "admin"
      ) {
        setRole(fetchedRole);
        setRoleError(null);
      } else {
        setRole(null);
        setRoleError("Invalid or missing user role.");
      }

      setLoading(false);
    };

    fetchRole();

    return () => {
      roleRequestId.current++;
    };
  }, [user?.id]);

  // Register new users as students by default
const signUp = async (
  email: string,
  password: string,
  fullName: string,
  rollNumber: string
) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "student",
        roll_number: rollNumber.trim(),
      },
    },
  });

  return { error };
};

  // Login
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

  // Logout
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        loading,
        roleError,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to access authentication context
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
