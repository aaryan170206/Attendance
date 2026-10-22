import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";

import {
  getMyAttendance,
  submitStudentAttendance,
  type AttendanceRecordStatus,
  type CloudAttendanceStatus,
} from "@/lib/attendance";

export type AttendanceStatus = AttendanceRecordStatus;

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
  loading: boolean;

  refreshAttendance: () => Promise<{
    error: Error | null;
  }>;

  submitAttendance: (
    sessionId: string,
    status: CloudAttendanceStatus
  ) => Promise<{
    error: Error | null;
  }>;
};

const AttendanceContext =
  createContext<AttendanceContextType | undefined>(
    undefined
  );

const getAttendanceStorageKey = (userId: string) =>
  `@attendance_${userId}`;

export function AttendanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();

  const [attendance, setAttendance] =
    useState<AttendanceData>({});

  const [loading, setLoading] = useState(true);

  /*
   * Convert Supabase records into
   * the existing Calendar structure.
   */
  const convertCloudAttendance = (
    records: {
      attendance_date: string;
      type: "theory" | "lab";
      status: AttendanceStatus;
      subject_name: string;
    }[]
  ): AttendanceData => {
    const result: AttendanceData = {};

    records.forEach((record) => {
      if (!record.subject_name) {
        return;
      }

      if (!result[record.attendance_date]) {
        result[record.attendance_date] = {};
      }

      if (!result[record.attendance_date][record.subject_name]) {
        result[record.attendance_date][record.subject_name] = {};
      }

      result[record.attendance_date][record.subject_name][
        record.type
      ] = record.status;
    });

    return result;
  };

  /*
   * Load authoritative attendance from Supabase
   * and update the local cache.
   */
  const refreshAttendance = useCallback(async () => {
    if (!user) {
      return {
        error: new Error("No authenticated user found."),
      };
    }

    const { data, error } = await getMyAttendance();

    if (error || !data) {
      return {
        error: error ?? new Error("Could not load attendance."),
      };
    }

    const cloudData = convertCloudAttendance(data);

    setAttendance(cloudData);

    await AsyncStorage.setItem(
      getAttendanceStorageKey(user.id),
      JSON.stringify(cloudData)
    );

    return { error: null };
  }, [user?.id]);

  /*
   * Initialize attendance when the user changes.
   */
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (authLoading) {
        return;
      }

      if (!user) {
        setAttendance({});
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const storageKey = getAttendanceStorageKey(user.id);

        const saved = await AsyncStorage.getItem(storageKey);

        if (saved && !cancelled) {
          try {
            setAttendance(JSON.parse(saved));
          } catch {
            setAttendance({});
          }
        }

        if (cancelled) {
          return;
        }

        const { error } = await refreshAttendance();

        if (error) {
          console.log(
            "Could not refresh attendance:",
            error
          );
        }
      } catch (error) {
        console.log("Attendance initialization failed:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading, refreshAttendance]);

  /*
   * Submit through the session RPC.
   * No offline queue is used.
   */
  const submitAttendance = async (
    sessionId: string,
    status: CloudAttendanceStatus
  ) => {
    if (!user) {
      return {
        error: new Error("Please log in to submit attendance."),
      };
    }

    const { error } = await submitStudentAttendance(
      sessionId,
      status
    );

    if (error) {
      return { error };
    }

    /*
     * Refresh after the server confirms
     * the submission.
     */
    const refreshResult = await refreshAttendance();

    if (refreshResult.error) {
      console.log(
        "Attendance submitted, but refresh failed:",
        refreshResult.error
      );
    }

    return { error: null };
  };

  return (
    <AttendanceContext.Provider
      value={{
        attendance,
        loading,
        refreshAttendance,
        submitAttendance,
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