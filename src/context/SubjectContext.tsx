import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

const SUBJECTS_STORAGE_KEY = "@subjects";

type Subject = {
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
};

const SubjectContext = createContext<SubjectContextType | undefined>(
  undefined
);

export function SubjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const loadSubjects = async () => {
    try {
      const savedSubjects = await AsyncStorage.getItem(
        SUBJECTS_STORAGE_KEY
      );

      if (savedSubjects) {
        setSubjects(JSON.parse(savedSubjects));
      }
    } catch (error) {
      console.log("Error loading subjects:", error);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

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
      console.log("Error saving subject:", error);
    }
  }
  const deleteSubject = async (name: string) => {
    try {
      const updatedSubjects = subjects.filter(
        (subject) => subject.name !== name
      );

      setSubjects(updatedSubjects);

      await AsyncStorage.setItem(
        SUBJECTS_STORAGE_KEY,
        JSON.stringify(updatedSubjects)
      );
    } catch (error) {
      console.log("Error deleting subject:", error);
    }
  };

  return (
    <SubjectContext.Provider
      value={{
        subjects,
        addSubject,
        deleteSubject,
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