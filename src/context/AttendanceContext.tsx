import AsyncStorage from "@react-native-async-storage/async-storage";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  deleteAllAttendance,
  deleteAttendance,
  deleteSubjectAttendance,
  getMyAttendance,
  saveAttendance,
} from "@/lib/attendance";

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

const AttendanceContext =
  createContext<
    AttendanceContextType | undefined
  >(undefined);

const ATTENDANCE_STORAGE_KEY =
  "@attendance";

export function AttendanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [attendance, setAttendance] =
    useState<AttendanceData>({});

  /*
   * Load attendance from local storage.
   *
   * AsyncStorage remains our offline cache.
   */
  useEffect(() => {
  const initializeAttendance = async () => {
    try {
      // 1. Load local attendance first
      const savedAttendance =
        await AsyncStorage.getItem(
          ATTENDANCE_STORAGE_KEY
        );

      if (savedAttendance) {
        setAttendance(
          JSON.parse(savedAttendance)
        );
      }

      // 2. Then load attendance from Supabase
      const {
        data: cloudAttendance,
        error,
      } = await getMyAttendance();

      if (error) {
        console.log(
          "⚠️ Could not load attendance from Supabase:",
          error
        );
        return;
      }

      if (!cloudAttendance) {
        return;
      }

      // 3. Convert cloud data into the
      //    existing AttendanceData structure
      const cloudData: AttendanceData = {};

      cloudAttendance.forEach((record) => {
        if (!record.subject_name) {
          return;
        }

        if (!cloudData[record.attendance_date]) {
          cloudData[record.attendance_date] = {};
        }

        if (
          !cloudData[record.attendance_date][
            record.subject_name
          ]
        ) {
          cloudData[record.attendance_date][
            record.subject_name
          ] = {};
        }

        cloudData[record.attendance_date][
          record.subject_name
        ][record.type] = record.status;
      });

      // 4. Replace local cache with cloud data
      setAttendance(cloudData);

      await AsyncStorage.setItem(
        ATTENDANCE_STORAGE_KEY,
        JSON.stringify(cloudData)
      );

      console.log(
        "✅ Attendance synced from Supabase"
      );
    } catch (error) {
      console.log(
        "Error initializing attendance:",
        error
      );
    }
  };

  initializeAttendance();
}, []);

  /*
   * Mark attendance locally first.
   *
   * Then synchronize the change
   * with Supabase.
   */
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

      if (
        !updatedAttendance[date][
          subjectName
        ]
      ) {
        updatedAttendance[date][
          subjectName
        ] = {};
      }

      const currentStatus =
        updatedAttendance[date][
          subjectName
        ][type];

      /*
       * Tapping the same status again
       * removes the attendance record.
       */
      if (currentStatus === status) {
        delete updatedAttendance[date][
          subjectName
        ][type];

        if (
          Object.keys(
            updatedAttendance[date][
              subjectName
            ]
          ).length === 0
        ) {
          delete updatedAttendance[date][
            subjectName
          ];
        }

        if (
          Object.keys(
            updatedAttendance[date]
          ).length === 0
        ) {
          delete updatedAttendance[date];
        }

        /*
         * Local update first.
         */
        setAttendance(
          updatedAttendance
        );

        await AsyncStorage.setItem(
          ATTENDANCE_STORAGE_KEY,
          JSON.stringify(
            updatedAttendance
          )
        );

        /*
         * Cloud delete.
         */
        const { error } =
          await deleteAttendance(
            date,
            subjectName,
            type
          );

        if (error) {
          console.log(
            "⚠️ Cloud attendance delete failed:",
            error
          );
        } else {
          console.log(
            "✅ Attendance removed from Supabase"
          );
        }

        return;
      }

      /*
       * Add/update local attendance.
       */
      updatedAttendance[date][
        subjectName
      ][type] = status;

      /*
       * Local storage first.
       *
       * This means the app continues
       * working even without internet.
       */
      setAttendance(
        updatedAttendance
      );

      await AsyncStorage.setItem(
        ATTENDANCE_STORAGE_KEY,
        JSON.stringify(
          updatedAttendance
        )
      );

      /*
       * Cloud synchronization.
       */
      const { error } =
        await saveAttendance(
          date,
          subjectName,
          type,
          status
        );

      if (error) {
        console.log(
          "⚠️ Cloud attendance sync failed:",
          error
        );
      } else {
        console.log(
          "✅ Attendance synced to Supabase"
        );
      }
    } catch (error) {
      console.log(
        "Error marking attendance:",
        error
      );
    }
  };

  /*
   * Reset ALL attendance.
   *
   * Local data is cleared first,
   * then cloud data is cleared.
   */
  const resetAttendance = async () => {
    try {
      await AsyncStorage.removeItem(
        ATTENDANCE_STORAGE_KEY
      );

      setAttendance({});

      const { error } =
        await deleteAllAttendance();

      if (error) {
        console.log(
          "⚠️ Cloud attendance reset failed:",
          error
        );
      } else {
        console.log(
          "✅ All attendance removed from Supabase"
        );
      }
    } catch (error) {
      console.log(
        "Error resetting attendance:",
        error
      );
    }
  };

  /*
   * Remove ALL attendance belonging
   * to one subject.
   */
  const removeSubjectAttendance =
    async (subjectName: string) => {
      try {
        const updatedAttendance = {
          ...attendance,
        };

        Object.keys(
          updatedAttendance
        ).forEach((date) => {
          if (
            updatedAttendance[date]?.[
              subjectName
            ]
          ) {
            delete updatedAttendance[
              date
            ][subjectName];
          }

          if (
            updatedAttendance[date] &&
            Object.keys(
              updatedAttendance[date]
            ).length === 0
          ) {
            delete updatedAttendance[
              date
            ];
          }
        });

        await AsyncStorage.setItem(
          ATTENDANCE_STORAGE_KEY,
          JSON.stringify(
            updatedAttendance
          )
        );

        setAttendance(
          updatedAttendance
        );

        /*
         * Remove the same records
         * from Supabase.
         */
        const { error } =
          await deleteSubjectAttendance(
            subjectName
          );

        if (error) {
          console.log(
            "⚠️ Cloud subject attendance deletion failed:",
            error
          );
        } else {
          console.log(
            "✅ Subject attendance removed from Supabase"
          );
        }
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
  const context =
    useContext(AttendanceContext);

  if (!context) {
    throw new Error(
      "useAttendance must be used inside AttendanceProvider"
    );
  }

  return context;
}