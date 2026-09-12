import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "leftEarly"
  | "club"
  | "partial"
  | "noClass"
  | "noLab";

type AttendanceRecord = {
  theory?: AttendanceStatus;
  lab?: AttendanceStatus;
};

export type AttendanceData = {
  [date: string]: {
    [subjectName: string]: AttendanceRecord;
  };
};

type AttendanceContextType = {
  attendance: AttendanceData;

  markAttendance: (
    date: string,
    subjectName: string,
    type: "theory" | "lab",
    status: AttendanceStatus
  ) => Promise<void>;

  resetAttendance: () => Promise<void>;

  removeSubjectAttendance: (
    subjectName: string
  ) => Promise<void>;
};

const AttendanceContext = createContext<
  AttendanceContextType | undefined
>(undefined);

const ATTENDANCE_STORAGE_KEY = "@attendance";

export function AttendanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [attendance, setAttendance] =
    useState<AttendanceData>({});

  // Load saved attendance
  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const savedAttendance =
          await AsyncStorage.getItem(
            ATTENDANCE_STORAGE_KEY
          );

        if (savedAttendance) {
          setAttendance(
            JSON.parse(savedAttendance)
          );
        }
      } catch (error) {
        console.log(
          "Error loading attendance:",
          error
        );
      }
    };

    loadAttendance();
  }, []);

  // Mark attendance
  const markAttendance = async (
    date: string,
    subjectName: string,
    type: "theory" | "lab",
    status: AttendanceStatus
  ) => {
    try {
      const updatedAttendance = {
        ...attendance,
      };

      if (!updatedAttendance[date]) {
        updatedAttendance[date] = {};
      }

      if (!updatedAttendance[date][subjectName]) {
        updatedAttendance[date][subjectName] = {};
      }

      const currentStatus =
        updatedAttendance[date][subjectName][type];

      // Tap the same status again → remove it
      if (currentStatus === status) {
        delete updatedAttendance[date][subjectName][
          type
        ];

        // Remove subject if no attendance remains
        if (
          Object.keys(
            updatedAttendance[date][subjectName]
          ).length === 0
        ) {
          delete updatedAttendance[date][subjectName];
        }

        // Remove date if no subjects remain
        if (
          Object.keys(updatedAttendance[date])
            .length === 0
        ) {
          delete updatedAttendance[date];
        }
      } else {
        updatedAttendance[date][subjectName][type] =
          status;
      }

      await AsyncStorage.setItem(
        ATTENDANCE_STORAGE_KEY,
        JSON.stringify(updatedAttendance)
      );

      setAttendance(updatedAttendance);
    } catch (error) {
      console.log(
        "Error marking attendance:",
        error
      );
    }
  };

  // Reset ALL attendance
  const resetAttendance = async () => {
    try {
      await AsyncStorage.removeItem(
        ATTENDANCE_STORAGE_KEY
      );

      setAttendance({});
    } catch (error) {
      console.log(
        "Error resetting attendance:",
        error
      );
    }
  };

  // Remove ALL attendance belonging to one subject
  const removeSubjectAttendance = async (
    subjectName: string
  ) => {
    try {
      const updatedAttendance = {
        ...attendance,
      };

      Object.keys(updatedAttendance).forEach(
        (date) => {
          if (
            updatedAttendance[date]?.[subjectName]
          ) {
            delete updatedAttendance[date][
              subjectName
            ];
          }

          // Remove empty dates
          if (
            updatedAttendance[date] &&
            Object.keys(updatedAttendance[date])
              .length === 0
          ) {
            delete updatedAttendance[date];
          }
        }
      );

      await AsyncStorage.setItem(
        ATTENDANCE_STORAGE_KEY,
        JSON.stringify(updatedAttendance)
      );

      setAttendance(updatedAttendance);
    } catch (error) {
      console.log(
        "Error removing subject attendance:",
        error
      );
    }
  };

  return (
    <AttendanceContext.Provider
      value={{
        attendance,
        markAttendance,
        resetAttendance,
        removeSubjectAttendance,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(
    AttendanceContext
  );

  if (!context) {
    throw new Error(
      "useAttendance must be used inside AttendanceProvider"
    );
  }

  return context;
}