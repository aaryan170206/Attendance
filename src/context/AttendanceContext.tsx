import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  addPendingAttendance,
  addPendingAttendanceDelete,
  deleteAllAttendance,
  deleteAttendance,
  deleteSubjectAttendance,
  getMyAttendance,
  saveAttendance,
  syncPendingAttendance,
  syncPendingAttendanceDeletes,
} from "@/lib/attendance";

import { useAuth } from "@/context/AuthContext";

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
  createContext<AttendanceContextType | undefined>(
    undefined
  );

export function AttendanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();

  const [attendance, setAttendance] =
    useState<AttendanceData>({});

  /*
   * Create a storage key that belongs
   * only to the currently logged-in user.
   */
  const getAttendanceStorageKey = (
    userId: string
  ) => {
    return `@attendance_${userId}`;
  };

  /*
   * Initialize attendance whenever
   * the authenticated user changes.
   */
  useEffect(() => {
    let cancelled = false;

    const initializeAttendance = async () => {
      /*
       * Wait until authentication has finished.
       */
      if (authLoading) {
        return;
      }

      /*
       * No logged-in user.
       * Clear the in-memory attendance.
       */
      if (!user) {
        setAttendance({});
        return;
      }

      try {
        const storageKey =
          getAttendanceStorageKey(user.id);

        /*
         * 1. Load attendance belonging
         *    only to this user.
         */
        const savedAttendance =
          await AsyncStorage.getItem(storageKey);

        let localAttendance: AttendanceData = {};

        if (savedAttendance) {
          try {
            localAttendance =
              JSON.parse(savedAttendance);
          } catch (error) {
            console.log(
              "⚠️ Could not parse local attendance:",
              error
            );

            localAttendance = {};
          }
        }

        if (!cancelled) {
          setAttendance(localAttendance);
        }

        /*
         * 2. Load this user's latest
         *    attendance from Supabase.
         */
        const {
          data: cloudAttendance,
          error,
        } = await getMyAttendance();

        if (cancelled) {
          return;
        }

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

        /*
         * 3. Convert cloud attendance
         *    into our existing AttendanceData
         *    structure.
         */
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

        /*
         * 4. Cloud data belongs to the
         *    currently authenticated user.
         */
        setAttendance(cloudData);

        /*
         * 5. Cache this user's cloud data
         *    under this user's own key.
         */
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify(cloudData)
        );

        console.log(
          "✅ Attendance synced from Supabase"
        );
      } catch (error) {
        if (!cancelled) {
          console.log(
            "Error initializing attendance:",
            error
          );
        }
      }
    };

    initializeAttendance();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  /*
   * Listen for internet connectivity changes.
   *
   * Wait until authentication is complete
   * and a user is logged in before syncing.
   */
  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const unsubscribe =
      NetInfo.addEventListener(
        async (state) => {
          if (state.isConnected) {
            console.log(
              "🌐 Internet connection detected"
            );

            /*
             * Sync pending attendance
             * create/update operations.
             */
            const {
              error: attendanceSyncError,
            } = await syncPendingAttendance();

            if (attendanceSyncError) {
              console.log(
                "⚠️ Pending attendance sync failed:",
                attendanceSyncError
              );
            }

            /*
             * Sync pending attendance
             * deletion operations.
             */
            const {
              error: deletionSyncError,
            } = await syncPendingAttendanceDeletes();

            if (deletionSyncError) {
              console.log(
                "⚠️ Pending attendance deletion sync failed:",
                deletionSyncError
              );
            }
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, [user?.id, authLoading]);

  /*
   * Mark attendance locally first.
   * Then synchronize the change with Supabase.
   */
  const markAttendance = async (
    date: string,
    subjectName: string,
    type: "theory" | "lab",
    status: AttendanceStatus
  ) => {
    if (!user) {
      console.log(
        "⚠️ Cannot mark attendance without a logged-in user."
      );
      return;
    }

    try {
      const updatedAttendance = {
        ...attendance,
      };

      const storageKey =
        getAttendanceStorageKey(user.id);

      /*
       * Create date if it doesn't exist.
       */
      if (!updatedAttendance[date]) {
        updatedAttendance[date] = {};
      }

      /*
       * Create subject if it doesn't exist.
       */
      if (
        !updatedAttendance[date][subjectName]
      ) {
        updatedAttendance[date][subjectName] = {};
      }

      const currentStatus =
        updatedAttendance[date][subjectName][type];

      /*
       * Tapping the same status again
       * removes the attendance record.
       */
      if (currentStatus === status) {
        delete updatedAttendance[date][subjectName][type];

        /*
         * Remove empty subject.
         */
        if (
          Object.keys(
            updatedAttendance[date][subjectName]
          ).length === 0
        ) {
          delete updatedAttendance[date][subjectName];
        }

        /*
         * Remove empty date.
         */
        if (
          Object.keys(updatedAttendance[date]).length === 0
        ) {
          delete updatedAttendance[date];
        }

        /*
         * Update local state first.
         */
        setAttendance(updatedAttendance);

        /*
         * Save to this user's local cache.
         */
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify(updatedAttendance)
        );

        /*
         * Remove the record from Supabase.
         */
        const { error } = await deleteAttendance(
          date,
          subjectName,
          type
        );

        if (error) {
          console.log(
            "⚠️ Cloud attendance delete failed:",
            error
          );

          await addPendingAttendanceDelete({
            date,
            subjectName,
            type,
          });
        } else {
          console.log(
            "✅ Attendance removed from Supabase"
          );
        }

        return;
      }

      /*
       * Add or update local attendance.
       */
      updatedAttendance[date][subjectName][type] =
        status;

      /*
       * Save locally first.
       */
      setAttendance(updatedAttendance);

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(updatedAttendance)
      );

      /*
       * Try to synchronize with Supabase.
       */
      const { error } = await saveAttendance(
        date,
        subjectName,
        type,
        status
      );

      if (error) {
        /*
         * Keep attendance locally and
         * add it to the offline queue.
         */
        console.log(
          "⚠️ Cloud attendance sync failed:",
          error
        );

        await addPendingAttendance({
          date,
          subjectName,
          type,
          status,
        });
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
   */
  const resetAttendance = async () => {
    if (!user) {
      return;
    }

    try {
      const storageKey =
        getAttendanceStorageKey(user.id);

      /*
       * Clear this user's local attendance.
       */
      await AsyncStorage.removeItem(storageKey);

      setAttendance({});

      /*
       * Clear this user's cloud attendance.
       */
      const { error } = await deleteAllAttendance();

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
      if (!user) {
        return;
      }

      try {
        const storageKey =
          getAttendanceStorageKey(user.id);

        const updatedAttendance = {
          ...attendance,
        };

        /*
         * Remove subject from every local date.
         */
        Object.keys(updatedAttendance).forEach(
          (date) => {
            if (
              updatedAttendance[date]?.[subjectName]
            ) {
              delete updatedAttendance[date][subjectName];
            }

            /*
             * Remove empty dates.
             */
            if (
              updatedAttendance[date] &&
              Object.keys(updatedAttendance[date]).length === 0
            ) {
              delete updatedAttendance[date];
            }
          }
        );

        /*
         * Save updated local data.
         */
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify(updatedAttendance)
        );

        setAttendance(updatedAttendance);

        /*
         * Remove the same attendance
         * from Supabase.
         */
        const { error } = await deleteSubjectAttendance(
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
  const context = useContext(AttendanceContext);

  if (!context) {
    throw new Error(
      "useAttendance must be used inside AttendanceProvider"
    );
  }

  return context;
}