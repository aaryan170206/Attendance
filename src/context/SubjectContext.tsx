
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { getMySubjects } from "@/lib/subjects";

type Subject = {
  id: string;
  classId: string;
  name: string;
  hasLab: boolean;
};

type SubjectContextType = {
  subjects: Subject[];
  refreshSubjects: () => Promise<void>;
};

const SubjectContext =
  createContext<SubjectContextType | undefined>(
    undefined
  );

export function SubjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const requestId = useRef(0);

  const refreshSubjects = useCallback(async () => {
    const currentRequest = ++requestId.current;

    if (!user?.id) {
      setSubjects([]);
      return;
    }

    try {
      const { data, error } = await getMySubjects();

      // Ignore outdated requests.
      if (currentRequest !== requestId.current) {
        return;
      }

      if (error) {
        console.log(
          "Could not load subjects from Supabase:",
          error
        );

        setSubjects([]);
        return;
      }

      const cloudSubjects: Subject[] = (data ?? []).map(
        (subject) => ({
          id: subject.id,
          classId: subject.class_id,
          name: subject.name,
          hasLab: subject.has_lab,
        })
      );

      setSubjects(cloudSubjects);

      console.log("Subjects loaded from Supabase");
    } catch (error) {
      if (currentRequest !== requestId.current) {
        return;
      }

      console.log("Error loading subjects:", error);
      setSubjects([]);
    }
  }, [user?.id]);

  useEffect(() => {
    // Clear previous user's subjects immediately.
    setSubjects([]);

    if (!user?.id) {
      return;
    }

    refreshSubjects();

    return () => {
      // Prevent an older request from updating state.
      requestId.current++;
    };
  }, [user?.id, refreshSubjects]);

  return (
    <SubjectContext.Provider
      value={{
        subjects,
        refreshSubjects,
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubjects() {
  const context = useContext(SubjectContext);

  if (!context) {
    throw new Error(
      "useSubjects must be used inside SubjectProvider"
    );
  }

  return context;
}
