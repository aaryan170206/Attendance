import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getMySubjects } from "@/lib/subjects";

const SUBJECTS_STORAGE_KEY = "@subjects";

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
  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  /*
   * Load subjects from local storage first.
   * This allows the app to display subjects
   * even when there is no internet connection.
   */
  const loadLocalSubjects = async () => {
    try {
      const savedSubjects =
        await AsyncStorage.getItem(
          SUBJECTS_STORAGE_KEY
        );

      if (savedSubjects) {
        setSubjects(
          JSON.parse(savedSubjects)
        );
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
   *
   * If Supabase succeeds:
   *   - update the app
   *   - update the local cache
   *
   * If Supabase fails:
   *   - keep using the local subjects
   */
  const refreshSubjects = async () => {
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

      await AsyncStorage.setItem(
        SUBJECTS_STORAGE_KEY,
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
   * Load local data immediately.
   * Then try to refresh from Supabase.
   */
  useEffect(() => {
    const initializeSubjects =
      async () => {
        await loadLocalSubjects();
        await refreshSubjects();
      };

    initializeSubjects();
  }, []);

  /*
   * For now, adding subjects remains
   * local-only.
   *
   * Cloud subject management will later
   * be handled through the appropriate
   * class/teacher/admin flow.
   */
  const addSubject = async (
    name: string,
    hasLab: boolean
  ): Promise<void> => {
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

      await AsyncStorage.setItem(
        SUBJECTS_STORAGE_KEY,
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
   * For now, deleting subjects remains
   * local-only.
   */
  const deleteSubject = async (
    name: string
  ) => {
    try {
      const updatedSubjects =
        subjects.filter(
          (subject) =>
            subject.name !== name
        );

      setSubjects(updatedSubjects);

      await AsyncStorage.setItem(
        SUBJECTS_STORAGE_KEY,
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