import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/context/AuthContext";
import { getMySubjects } from "@/lib/subjects";

function getSubjectsStorageKey(userId: string): string {
  return `@subjects_${userId}`;
}

type Subject = {
  id?: string;
  classId?: string;
  name: string;
  hasLab: boolean;
};

type SubjectContextType = {
  subjects: Subject[];

  addSubject: (
    name: string,
    hasLab: boolean
  ) => Promise<void>;

  deleteSubject: (
    name: string
  ) => Promise<void>;

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

  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  /*
   * Load subjects from local storage for
   * the currently authenticated user.
   */
  const loadLocalSubjects = async (
    userId: string
  ) => {
    try {
      const storageKey =
        getSubjectsStorageKey(userId);

      const savedSubjects =
        await AsyncStorage.getItem(storageKey);

      if (savedSubjects) {
        setSubjects(
          JSON.parse(savedSubjects)
        );
      } else {
        setSubjects([]);
      }
    } catch (error) {
      console.log(
        "Error loading local subjects:",
        error
      );
    }
  };

  /*
   * Load subjects from Supabase.
   */
  const refreshSubjects = async () => {
    if (!user?.id) {
      setSubjects([]);
      return;
    }

    try {
      const {
        data,
        error,
      } = await getMySubjects();

      if (error) {
        console.log(
          "Could not load subjects from Supabase:",
          error
        );
        return;
      }

      if (!data) {
        return;
      }

      const cloudSubjects: Subject[] =
        data.map((subject) => ({
          id: subject.id,
          classId: subject.class_id,
          name: subject.name,
          hasLab: subject.has_lab,
        }));

      setSubjects(cloudSubjects);

      const storageKey =
        getSubjectsStorageKey(user.id);

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(cloudSubjects)
      );

      console.log(
        "✅ Subjects synced from Supabase"
      );
    } catch (error) {
      console.log(
        "Error syncing subjects:",
        error
      );
    }
  };

  /*
   * Reinitialize whenever the authenticated
   * user changes.
   */
  useEffect(() => {
    let cancelled = false;

    const initializeSubjects =
      async () => {
        if (!user?.id) {
          setSubjects([]);
          return;
        }

        try {
          const storageKey =
            getSubjectsStorageKey(user.id);

          const savedSubjects =
            await AsyncStorage.getItem(
              storageKey
            );

          if (!cancelled) {
            if (savedSubjects) {
              setSubjects(
                JSON.parse(savedSubjects)
              );
            } else {
              setSubjects([]);
            }
          }

          if (!cancelled) {
            await refreshSubjects();
          }
        } catch (error) {
          if (!cancelled) {
            console.log(
              "Error initializing subjects:",
              error
            );
          }
        }
      };

    initializeSubjects();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /*
   * Add a subject to the current user's
   * local subject list.
   */
  const addSubject = async (
    name: string,
    hasLab: boolean
  ): Promise<void> => {
    if (!user?.id) {
      return;
    }

    try {
      const newSubject: Subject = {
        name,
        hasLab,
      };

      const updatedSubjects = [
        ...subjects,
        newSubject,
      ];

      setSubjects(updatedSubjects);

      const storageKey =
        getSubjectsStorageKey(user.id);

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(updatedSubjects)
      );
    } catch (error) {
      console.log(
        "Error saving subject:",
        error
      );
    }
  };

  /*
   * Delete a subject from the current
   * user's local subject list.
   */
  const deleteSubject = async (
    name: string
  ) => {
    if (!user?.id) {
      return;
    }

    try {
      const updatedSubjects =
        subjects.filter(
          (subject) =>
            subject.name !== name
        );

      setSubjects(updatedSubjects);

      const storageKey =
        getSubjectsStorageKey(user.id);

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(updatedSubjects)
      );
    } catch (error) {
      console.log(
        "Error deleting subject:",
        error
      );
    }
  };

  return (
    <SubjectContext.Provider
      value={{
        subjects,
        addSubject,
        deleteSubject,
        refreshSubjects,
      }}
    >
      {children}
    </SubjectContext.Provider>
  );
}

export function useSubjects() {
  const context = useContext(
    SubjectContext
  );

  if (!context) {
    throw new Error(
      "useSubjects must be used inside SubjectProvider"
    );
  }

  return context;
}