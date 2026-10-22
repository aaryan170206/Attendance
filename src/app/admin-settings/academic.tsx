
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

// --------------------------------------------------
// Types
// --------------------------------------------------

type HolidayScope = "all" | "students" | "teachers" | "selected";

type Holiday = {
  id: string;
  name: string;
  holiday_date: string;
  description: string | null;
  scope: HolidayScope;
  groups: string[];
};

type AcademicYearRecord = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  working_days?: string[];
};

type SemesterRecord = {
  id: string;
  academic_year_id: string;
  semester_number: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_custom_dates: boolean;
};

type SemesterDate = {
  startDate: string;
  endDate: string;
  isCustom: boolean;
};

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DEFAULT_WORKING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const scopeOptions: {
  label: string;
  value: HolidayScope;
}[] = [
  { label: "Entire institution", value: "all" },
  { label: "Students only", value: "students" },
  { label: "Teachers only", value: "teachers" },
  { label: "Selected groups", value: "selected" },
];

// --------------------------------------------------
// Date helpers
// --------------------------------------------------

const isValidDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const getDefaultSemesterDates = (
  semesterNumber: number,
  yearName: string
): SemesterDate => {
  const firstYear = Number(yearName.slice(0, 4));

  if (semesterNumber % 2 !== 0) {
    return {
      startDate: `${firstYear}-07-01`,
      endDate: `${firstYear}-11-30`,
      isCustom: false,
    };
  }

  return {
    startDate: `${firstYear + 1}-01-12`,
    endDate: `${firstYear + 1}-04-30`,
    isCustom: false,
  };
};

const formatDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
};

// --------------------------------------------------
// Screen
// --------------------------------------------------

export default function AcademicConfiguration() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Collapsible sections
  const [isAcademicYearExpanded, setIsAcademicYearExpanded] =
    useState(false);
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);

  // Academic year
  const [academicYear, setAcademicYear] = useState("");
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Multiple semesters
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([5]);

  const [semesterDates, setSemesterDates] = useState<
    Record<number, SemesterDate>
  >({});

  // Loading and saving
  const [academicConfigLoaded, setAcademicConfigLoaded] = useState(false);
  const [academicConfigError, setAcademicConfigError] = useState(false);
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false);

  // Working days
  const [workingDays, setWorkingDays] = useState<string[]>(
    DEFAULT_WORKING_DAYS
  );

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoaded, setHolidaysLoaded] = useState(false);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  // Holiday form
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDescription, setHolidayDescription] = useState("");
  const [holidayScope, setHolidayScope] =
    useState<HolidayScope>("all");
  const [holidayGroups, setHolidayGroups] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // --------------------------------------------------
  // Load academic year, semesters and working days
  // --------------------------------------------------

  const loadAcademicConfiguration = useCallback(async () => {
    setAcademicConfigLoaded(false);
    setAcademicConfigError(false);

    try {
      const { data: yearData, error: yearError } = await supabase
        .from("academic_years")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (yearError) throw yearError;

      if (!yearData) {
        throw new Error("No active academic year was found.");
      }

      const year = yearData as AcademicYearRecord;

      setAcademicYearId(year.id);
      setAcademicYear(year.name);
      setStartDate(year.start_date);
      setEndDate(year.end_date);

      // Load working days
      const { data: workingDayData, error: workingDayError } =
        await supabase
          .from("academic_working_days")
          .select("day_of_week")
          .eq("academic_year_id", year.id);

      if (workingDayError) throw workingDayError;

      const savedWorkingDays = (workingDayData ?? []).map(
        (item: { day_of_week: string }) => item.day_of_week
      );

      setWorkingDays(
        savedWorkingDays.length > 0
          ? savedWorkingDays
          : year.working_days?.length
            ? year.working_days
            : DEFAULT_WORKING_DAYS
      );

      // Load ALL semesters for this academic year.
      // Do not use maybeSingle() here because multiple semesters
      // are allowed to be active at the same time.
      const { data: semesterData, error: semesterError } =
        await supabase
          .from("semesters")
          .select("*")
          .eq("academic_year_id", year.id)
          .order("semester_number", { ascending: true });

      if (semesterError) throw semesterError;

      const records = (semesterData ?? []) as SemesterRecord[];

      const dateMap: Record<number, SemesterDate> = {};

      for (let number = 1; number <= 8; number++) {
        const existing = records.find(
          (item) => item.semester_number === number
        );

        if (existing) {
          dateMap[number] = {
            startDate: existing.start_date,
            endDate: existing.end_date,
            isCustom: existing.is_custom_dates ?? false,
          };
        } else {
          dateMap[number] = getDefaultSemesterDates(number, year.name);
        }
      }

      setSemesterDates(dateMap);

      const activeNumbers = records
        .filter((item) => item.is_active)
        .map((item) => item.semester_number)
        .sort((a, b) => a - b);

      setSelectedSemesters(
        activeNumbers.length > 0 ? activeNumbers : [5]
      );

      setAcademicConfigError(false);
    } catch (error) {
      console.error("Error loading academic configuration:", error);

      setAcademicConfigError(true);

      Alert.alert(
        "Loading Error",
        "Unable to load academic configuration. Please check your connection and database permissions."
      );
    } finally {
      setAcademicConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadAcademicConfiguration();
  }, [loadAcademicConfiguration]);

  // --------------------------------------------------
  // Load holidays
  // --------------------------------------------------

  const loadHolidays = useCallback(async (yearId: string) => {
    setHolidaysLoaded(false);

    try {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .eq("academic_year_id", yearId)
        .order("holiday_date", { ascending: true });

      if (error) throw error;

      setHolidays((data ?? []) as Holiday[]);
    } catch (error) {
      console.error("Error loading holidays:", error);

      Alert.alert(
        "Loading Error",
        "Unable to load holidays from Supabase."
      );
    } finally {
      setHolidaysLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (academicYearId) {
      loadHolidays(academicYearId);
    }
  }, [academicYearId, loadHolidays]);

  const sortedHolidays = useMemo(
    () =>
      [...holidays].sort((a, b) =>
        a.holiday_date.localeCompare(b.holiday_date)
      ),
    [holidays]
  );

  // --------------------------------------------------
  // Multiple semester selection
  // --------------------------------------------------

  const toggleSemester = (semesterNumber: number) => {
    setSelectedSemesters((current) =>
      current.includes(semesterNumber)
        ? current.filter((item) => item !== semesterNumber)
        : [...current, semesterNumber].sort((a, b) => a - b)
    );

    setSemesterDates((current) => {
      if (current[semesterNumber]) return current;

      return {
        ...current,
        [semesterNumber]: getDefaultSemesterDates(
          semesterNumber,
          academicYear
        ),
      };
    });
  };

  const updateSemesterDate = (
    semesterNumber: number,
    field: "startDate" | "endDate",
    value: string
  ) => {
    setSemesterDates((current) => ({
      ...current,
      [semesterNumber]: {
        ...current[semesterNumber],
        [field]: value,
        isCustom: true,
      },
    }));
  };

  // --------------------------------------------------
  // Working days
  // --------------------------------------------------

  const toggleWorkingDay = (day: string) => {
    setWorkingDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
  };

  // --------------------------------------------------
  // Holiday form
  // --------------------------------------------------

  const resetHolidayForm = () => {
    setHolidayName("");
    setHolidayDate("");
    setHolidayDescription("");
    setHolidayScope("all");
    setHolidayGroups("");
    setEditingId(null);
  };

  const getScopeLabel = (holiday: Holiday) => {
    switch (holiday.scope) {
      case "all":
        return "Entire institution";
      case "students":
        return "Students only";
      case "teachers":
        return "Teachers only";
      case "selected":
        return holiday.groups.join(", ");
    }
  };

  // --------------------------------------------------
  // Add / update holiday
  // --------------------------------------------------

  const handleAddHoliday = async () => {
    if (!academicYearId) {
      Alert.alert("Error", "No academic year is selected.");
      return;
    }

    const cleanName = holidayName.trim();
    const cleanDate = holidayDate.trim();
    const cleanDescription = holidayDescription.trim();

    const groups =
      holidayScope === "selected"
        ? holidayGroups
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    if (!cleanName) {
      Alert.alert("Required", "Enter a holiday name.");
      return;
    }

    if (!isValidDate(cleanDate)) {
      Alert.alert(
        "Invalid date",
        "Enter a valid date in YYYY-MM-DD format."
      );
      return;
    }

    if (cleanDate < startDate || cleanDate > endDate) {
      Alert.alert(
        "Invalid holiday date",
        "The holiday must fall within the selected academic year."
      );
      return;
    }

    if (holidayScope === "selected" && groups.length === 0) {
      Alert.alert(
        "Groups required",
        "Enter at least one department or class."
      );
      return;
    }

    const duplicate = holidays.some(
      (holiday) =>
        holiday.holiday_date === cleanDate &&
        holiday.id !== editingId &&
        holiday.scope === holidayScope &&
        JSON.stringify(holiday.groups) === JSON.stringify(groups)
    );

    if (duplicate) {
      Alert.alert(
        "Possible duplicate",
        "A holiday with the same date and applicability already exists."
      );
      return;
    }

    const payload = {
      academic_year_id: academicYearId,
      name: cleanName,
      holiday_date: cleanDate,
      description: cleanDescription || null,
      scope: holidayScope,
      groups,
    };

    setIsSavingHoliday(true);

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from("holidays")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single();

        if (error) throw error;

        setHolidays((current) =>
          current.map((item) =>
            item.id === editingId ? (data as Holiday) : item
          )
        );

        Alert.alert("Updated", "Holiday details have been updated.");
      } else {
        const { data, error } = await supabase
          .from("holidays")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;

        setHolidays((current) => [...current, data as Holiday]);

        Alert.alert("Added", "Holiday has been added successfully.");
      }

      resetHolidayForm();
    } catch (error) {
      console.error("Error saving holiday:", error);

      Alert.alert(
        "Saving Error",
        "Unable to save the holiday. Check your connection and database permissions."
      );
    } finally {
      setIsSavingHoliday(false);
    }
  };

  // --------------------------------------------------
  // Edit holiday
  // --------------------------------------------------

  const handleEditHoliday = (holiday: Holiday) => {
    setHolidayName(holiday.name);
    setHolidayDate(holiday.holiday_date);
    setHolidayDescription(holiday.description ?? "");
    setHolidayScope(holiday.scope);
    setHolidayGroups(holiday.groups.join(", "));
    setEditingId(holiday.id);
    setIsHolidayExpanded(true);
  };

  // --------------------------------------------------
  // Delete holiday
  // --------------------------------------------------

  const handleDeleteHoliday = (id: string) => {
    Alert.alert(
      "Delete Holiday",
      "Are you sure you want to remove this holiday?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("holidays")
                .delete()
                .eq("id", id);

              if (error) throw error;

              setHolidays((current) =>
                current.filter((item) => item.id !== id)
              );

              if (editingId === id) {
                resetHolidayForm();
              }
            } catch (error) {
              console.error("Error deleting holiday:", error);
              Alert.alert("Delete Error", "Unable to delete the holiday.");
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------
  // Save academic configuration
  // --------------------------------------------------

  const handleSaveConfiguration = async () => {
    if (!academicConfigLoaded || academicConfigError) {
      Alert.alert(
        "Cannot save",
        "Academic configuration has not loaded successfully. Please reload it first."
      );
      return;
    }

    const cleanYear = academicYear.trim();

    if (!/^\d{4}-\d{4}$/.test(cleanYear)) {
      Alert.alert(
        "Invalid academic year",
        "Enter the academic year in YYYY-YYYY format, for example 2026-2027."
      );
      return;
    }

    const [firstYear, secondYear] = cleanYear.split("-").map(Number);

    if (secondYear !== firstYear + 1) {
      Alert.alert(
        "Invalid academic year",
        "The second year must be exactly one year after the first."
      );
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      Alert.alert(
        "Invalid dates",
        "Enter valid academic year dates in YYYY-MM-DD format."
      );
      return;
    }

    if (startDate > endDate) {
      Alert.alert(
        "Invalid dates",
        "The academic year end date cannot be before its start date."
      );
      return;
    }

    if (selectedSemesters.length === 0) {
      Alert.alert(
        "Semester required",
        "Select at least one active semester."
      );
      return;
    }

    for (const semesterNumber of selectedSemesters) {
      const dates = semesterDates[semesterNumber];

      if (
        !dates ||
        !isValidDate(dates.startDate) ||
        !isValidDate(dates.endDate)
      ) {
        Alert.alert(
          "Invalid semester dates",
          `Enter valid dates for Semester ${semesterNumber}.`
        );
        return;
      }

      if (dates.startDate > dates.endDate) {
        Alert.alert(
          "Invalid semester dates",
          `Semester ${semesterNumber} end date cannot be before its start date.`
        );
        return;
      }

      if (
        dates.startDate < startDate ||
        dates.endDate > endDate
      ) {
        Alert.alert(
          "Invalid semester",
          `Semester ${semesterNumber} dates must fall within the academic year.`
        );
        return;
      }
    }

    if (workingDays.length === 0) {
      Alert.alert(
        "Working days required",
        "Select at least one working day."
      );
      return;
    }

    setIsSavingConfiguration(true);

    try {
      // Find or create academic year.
      const { data: existingYear, error: findYearError } =
        await supabase
          .from("academic_years")
          .select("*")
          .eq("name", cleanYear)
          .maybeSingle();

      if (findYearError) throw findYearError;

      let yearId: string;

      if (existingYear) {
        yearId = existingYear.id;
      } else {
        const { data, error } = await supabase
          .from("academic_years")
          .insert({
            name: cleanYear,
            start_date: startDate,
            end_date: endDate,
            is_active: false,
            working_days: workingDays,
          })
          .select("id")
          .single();

        if (error) throw error;

        yearId = data.id;
      }

      // Deactivate other academic years first because the database
      // has a partial unique index allowing only one active year.
      const { error: deactivateYearError } = await supabase
        .from("academic_years")
        .update({ is_active: false })
        .eq("is_active", true)
        .neq("id", yearId);

      if (deactivateYearError) throw deactivateYearError;

      // Activate/update the selected academic year.
      const { error: updateYearError } = await supabase
        .from("academic_years")
        .update({
          name: cleanYear,
          start_date: startDate,
          end_date: endDate,
          is_active: true,
          working_days: workingDays,
        })
        .eq("id", yearId);

      if (updateYearError) throw updateYearError;

      // Deactivate every semester in this academic year.
      const { error: deactivateSemesterError } = await supabase
        .from("semesters")
        .update({ is_active: false })
        .eq("academic_year_id", yearId);

      if (deactivateSemesterError) throw deactivateSemesterError;

      // Upsert all selected semesters as active.
      // Unselected semester records are retained but inactive.
      const semesterRecords = selectedSemesters.map((number) => {
        const dates = semesterDates[number];

        return {
          academic_year_id: yearId,
          semester_number: number,
          start_date: dates.startDate,
          end_date: dates.endDate,
          is_active: true,
          is_custom_dates: dates.isCustom,
        };
      });

      const { error: semesterError } = await supabase
        .from("semesters")
        .upsert(semesterRecords, {
          onConflict: "academic_year_id,semester_number",
        });

      if (semesterError) throw semesterError;

      // Persist working days in the separate table.
      const { error: deleteWorkingDaysError } = await supabase
        .from("academic_working_days")
        .delete()
        .eq("academic_year_id", yearId);

      if (deleteWorkingDaysError) throw deleteWorkingDaysError;

      const workingDayRecords = workingDays.map((day) => ({
        academic_year_id: yearId,
        day_of_week: day,
      }));

      const { error: insertWorkingDaysError } = await supabase
        .from("academic_working_days")
        .insert(workingDayRecords);

      if (insertWorkingDaysError) throw insertWorkingDaysError;

      setAcademicYearId(yearId);
      setAcademicConfigError(false);

      Alert.alert(
        "Configuration saved",
        `Academic year, ${selectedSemesters.length} active semester(s), and working days have been saved to Supabase.`
      );
    } catch (error) {
      console.error("Error saving academic configuration:", error);

      Alert.alert(
        "Saving Error",
        "Unable to save the complete academic configuration. Please check your connection and database permissions."
      );
    } finally {
      setIsSavingConfiguration(false);
    }
  };

  // --------------------------------------------------
  // Reset form
  // --------------------------------------------------

  const handleReset = () => {
    Alert.alert(
      "Reset configuration",
      "Restore the values currently stored in Supabase? No database records will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetHolidayForm();
            loadAcademicConfiguration();
            setIsAcademicYearExpanded(false);
            setIsHolidayExpanded(false);
          },
        },
      ]
    );
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹  Back to Settings</Text>
        </Pressable>

        <Text style={styles.heading}>Academic Configuration</Text>

        <Text style={styles.subtitle}>
          Manage the institution's academic calendar and session details.
        </Text>

        {!academicConfigLoaded && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>
              Loading academic configuration...
            </Text>
          </View>
        )}

        {academicConfigError && (
          <View style={styles.section}>
            <Text style={styles.helper}>
              Academic configuration could not be loaded. Saving is
              disabled until the data is loaded successfully.
            </Text>

            <Pressable
              style={styles.addButton}
              onPress={loadAcademicConfiguration}
            >
              <Text style={styles.addButtonText}>Retry Loading</Text>
            </Pressable>
          </View>
        )}

        {/* Academic year and semester selection */}
        <View style={styles.section}>
          <Pressable
            style={styles.collapsibleHeader}
            onPress={() =>
              setIsAcademicYearExpanded((current) => !current)
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: isAcademicYearExpanded }}
          >
            <Text style={[styles.sectionTitle, styles.collapsibleTitle]}>
              Academic Year & Semesters
            </Text>

            <Text style={styles.chevron}>
              {isAcademicYearExpanded ? "⌃" : "⌄"}
            </Text>
          </Pressable>

          {isAcademicYearExpanded && (
            <>
              <Text style={styles.label}>Academic year</Text>

              <TextInput
                value={academicYear}
                onChangeText={setAcademicYear}
                placeholder="e.g. 2026-2027"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>Active semesters</Text>

              <Text style={styles.helper}>
                Select all semesters that should be active for this academic
                year. Multiple semesters can be active simultaneously.
              </Text>

              <View style={styles.semesterColumns}>
                <View style={styles.semesterColumn}>
                  <Text style={styles.semesterColumnTitle}>Odd Semesters</Text>
                  {[1, 3, 5, 7].map((number) => {
                    const selected = selectedSemesters.includes(number);

                    return (
                      <Pressable
                        key={number}
                        disabled={!academicConfigLoaded || academicConfigError}
                        onPress={() => toggleSemester(number)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        style={[
                          styles.semesterOption,
                          selected && styles.selectedButton,
                          (!academicConfigLoaded || academicConfigError) &&
                            styles.disabledButton,
                        ]}
                      >
                        <Text
                          style={[
                            styles.semesterOptionText,
                            selected && styles.selectedText,
                          ]}
                        >
                          Semester {number}
                        </Text>
                        <Text
                          style={[
                            styles.semesterCheck,
                            selected && styles.selectedText,
                          ]}
                        >
                          {selected ? "✓" : "+"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.semesterColumn}>
                  <Text style={styles.semesterColumnTitle}>Even Semesters</Text>
                  {[2, 4, 6, 8].map((number) => {
                    const selected = selectedSemesters.includes(number);

                    return (
                      <Pressable
                        key={number}
                        disabled={!academicConfigLoaded || academicConfigError}
                        onPress={() => toggleSemester(number)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        style={[
                          styles.semesterOption,
                          selected && styles.selectedButton,
                          (!academicConfigLoaded || academicConfigError) &&
                            styles.disabledButton,
                        ]}
                      >
                        <Text
                          style={[
                            styles.semesterOptionText,
                            selected && styles.selectedText,
                          ]}
                        >
                          Semester {number}
                        </Text>
                        <Text
                          style={[
                            styles.semesterCheck,
                            selected && styles.selectedText,
                          ]}
                        >
                          {selected ? "✓" : "+"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Text style={styles.selectedSemesterSummary}>
                Selected:{" "}
                {selectedSemesters.length
                  ? selectedSemesters
                      .map((number) => `Semester ${number}`)
                      .join(", ")
                  : "None"}
              </Text>
            </>
          )}
        </View>

        {isAcademicYearExpanded && (
          <>
            {/* Academic year and semester dates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Academic Year Duration
              </Text>

              <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>

              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-07-01"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>End date (YYYY-MM-DD)</Text>

              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2027-06-30"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <View style={styles.listDivider} />

              <Text style={styles.sectionTitle}>Semester Durations</Text>

              <Text style={styles.helper}>
                Configure the dates separately for every selected semester.
              </Text>

              {selectedSemesters.length === 0 ? (
                <Text style={styles.emptyText}>
                  Select at least one semester above to configure its dates.
                </Text>
              ) : (
                selectedSemesters.map((number) => {
                  const dates = semesterDates[number];

                  if (!dates) return null;

                  return (
                    <View key={number} style={styles.semesterDateCard}>
                      <Text style={styles.semesterDateTitle}>
                        Semester {number} Duration
                      </Text>

                      <Text style={styles.label}>
                        Start date (YYYY-MM-DD)
                      </Text>

                      <TextInput
                        value={dates.startDate}
                        onChangeText={(value) =>
                          updateSemesterDate(number, "startDate", value)
                        }
                        placeholder="2026-07-01"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.input}
                      />

                      <Text style={styles.label}>
                        End date (YYYY-MM-DD)
                      </Text>

                      <TextInput
                        value={dates.endDate}
                        onChangeText={(value) =>
                          updateSemesterDate(number, "endDate", value)
                        }
                        placeholder="2026-11-30"
                        placeholderTextColor={colors.textSecondary}
                        style={styles.input}
                      />

                      {dates.isCustom && (
                        <Text style={styles.customDateNotice}>
                          Custom semester dates
                        </Text>
                      )}
                    </View>
                  );
                })
              )}

              <Text style={styles.helper}>
                Odd semesters default to 1 July–30 November. Even semesters
                default to 12 January–30 April. Editing a date marks that
                semester as using custom dates.
              </Text>
            </View>

            {/* Working days */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Working Days</Text>

              <Text style={styles.helper}>
                Select the days on which classes are normally conducted.
              </Text>

              <View style={styles.daysContainer}>
                {weekdays.map((day) => {
                  const selected = workingDays.includes(day);

                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleWorkingDay(day)}
                      style={[
                        styles.dayButton,
                        selected && styles.selectedButton,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.selectedText,
                        ]}
                      >
                        {day.slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* Holiday management */}
        <View style={styles.section}>
          <Pressable
            style={styles.holidayHeader}
            onPress={() =>
              setIsHolidayExpanded((current) => !current)
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: isHolidayExpanded }}
          >
            <View style={styles.holidayHeadingContent}>
              <Text style={[styles.sectionTitle, styles.collapsibleTitle]}>
                Holiday Management
              </Text>

              <Text style={styles.helper}>
                Maintain the institution's official holiday calendar.
              </Text>
            </View>

            <View style={styles.holidayHeaderRight}>
              <View style={styles.holidayCount}>
                <Text style={styles.holidayCountText}>
                  {holidays.length}
                </Text>
              </View>

              <Text style={styles.chevron}>
                {isHolidayExpanded ? "⌃" : "⌄"}
              </Text>
            </View>
          </Pressable>

          {isHolidayExpanded && (
            <>
              <Text style={styles.label}>Holiday name</Text>

              <TextInput
                value={holidayName}
                onChangeText={setHolidayName}
                placeholder="e.g. Independence Day"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>Holiday date (YYYY-MM-DD)</Text>

              <TextInput
                value={holidayDate}
                onChangeText={setHolidayDate}
                placeholder="2026-08-15"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>Description (optional)</Text>

              <TextInput
                value={holidayDescription}
                onChangeText={setHolidayDescription}
                placeholder="Enter additional details"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.descriptionInput]}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Holiday applicability</Text>

              <View style={styles.scopeContainer}>
                {scopeOptions.map((option) => {
                  const selected = holidayScope === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setHolidayScope(option.value)}
                      style={[
                        styles.scopeOption,
                        selected && styles.selectedScopeOption,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scopeText,
                          selected && styles.selectedText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {holidayScope === "selected" && (
                <>
                  <Text style={styles.label}>Departments / classes</Text>

                  <TextInput
                    value={holidayGroups}
                    onChangeText={setHolidayGroups}
                    placeholder="e.g. BCA, B.Com, Computer Science"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                  />

                  <Text style={styles.helper}>
                    Separate multiple groups with commas.
                  </Text>
                </>
              )}

              <View style={styles.holidayFormActions}>
                {editingId && (
                  <Pressable
                    style={styles.cancelButton}
                    onPress={resetHolidayForm}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                )}

                <Pressable
                  style={[
                    styles.addButton,
                    isSavingHoliday && styles.disabledButton,
                  ]}
                  onPress={handleAddHoliday}
                  disabled={isSavingHoliday}
                >
                  <Text style={styles.addButtonText}>
                    {isSavingHoliday
                      ? "Saving..."
                      : editingId
                        ? "Update Holiday"
                        : "+ Add Holiday"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.listDivider} />

          <View style={styles.addedHolidaysHeader}>
            <Text style={styles.listTitle}>Added Holidays</Text>

            <Text style={styles.addedHolidaysCount}>
              {holidays.length}{" "}
              {holidays.length === 1 ? "holiday" : "holidays"}
            </Text>
          </View>

          {!holidaysLoaded ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.emptyText}>
                Loading saved holidays...
              </Text>
            </View>
          ) : sortedHolidays.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>▦</Text>

              <Text style={styles.emptyTitle}>No holidays added</Text>

              <Text style={styles.emptyText}>
                Expand Holiday Management to add holidays to the calendar.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.holidayListScroll}
              contentContainerStyle={styles.holidayListContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {sortedHolidays.map((holiday) => (
                <View key={holiday.id} style={styles.holidayItem}>
                  <View style={styles.holidayDateBox}>
                    <Text style={styles.holidayDateDay}>
                      {holiday.holiday_date.slice(8, 10)}
                    </Text>

                    <Text style={styles.holidayDateMonth}>
                      {holiday.holiday_date.slice(5, 7)}
                    </Text>
                  </View>

                  <View style={styles.holidayDetails}>
                    <Text style={styles.holidayItemName}>
                      {holiday.name}
                    </Text>

                    <Text style={styles.holidayItemDate}>
                      {formatDate(holiday.holiday_date)}
                    </Text>

                    <Text style={styles.holidayScopeLabel}>
                      {getScopeLabel(holiday)}
                    </Text>

                    {!!holiday.description && (
                      <Text style={styles.holidayDescription}>
                        {holiday.description}
                      </Text>
                    )}
                  </View>

                  <View style={styles.holidayActions}>
                    <Pressable
                      onPress={() => handleEditHoliday(holiday)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.editText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteHoliday(holiday.id)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Configuration actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.resetButton}
            onPress={handleReset}
          >
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>

          <Pressable
            style={[
              styles.saveButton,
              (isSavingConfiguration ||
                !academicConfigLoaded ||
                academicConfigError) &&
                styles.disabledButton,
            ]}
            onPress={handleSaveConfiguration}
            disabled={
              isSavingConfiguration ||
              !academicConfigLoaded ||
              academicConfigError
            }
          >
            <Text style={styles.saveText}>
              {isSavingConfiguration ? "Saving..." : "Save Configuration"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Academic year, active semesters, working days and holidays are
          saved to Supabase.
        </Text>
      </ScrollView>
    </View>
  );
}

// --------------------------------------------------
// Styles
// --------------------------------------------------

const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"]
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingTop: 55,
      paddingBottom: 40,
    },
    backButton: {
      marginBottom: 24,
      alignSelf: "flex-start",
    },
    backText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "600",
    },
    heading: {
      fontSize: 27,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
      marginTop: 7,
      marginBottom: 25,
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 17,
      marginBottom: 17,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
    },
    collapsibleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 30,
    },
    collapsibleTitle: {
      marginBottom: 0,
    },
    chevron: {
      color: colors.textSecondary,
      fontSize: 21,
      fontWeight: "700",
      paddingHorizontal: 4,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      marginTop: 14,
    },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      paddingHorizontal: 13,
      color: colors.text,
      backgroundColor: colors.background,
      fontSize: 14,
    },
    descriptionInput: {
      minHeight: 75,
      paddingTop: 12,
    },
    optionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },
    semesterColumns: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    semesterColumn: {
      flex: 1,
      gap: 9,
    },
    semesterColumnTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 5,
    },
    semesterOption: {
      minHeight: 48,
      paddingHorizontal: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    semesterOptionText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    semesterCheck: {
      color: colors.textSecondary,
      fontSize: 18,
      fontWeight: "700",
    },
    selectedButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    disabledButton: {
      opacity: 0.5,
    },
    semesterText: {
      fontWeight: "600",
      color: colors.text,
    },
    selectedSemesterSummary: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 10,
    },
    semesterDateCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 13,
      marginTop: 12,
      backgroundColor: colors.background,
    },
    semesterDateTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 2,
    },
    selectedText: {
      color: "#FFFFFF",
    },
    helper: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    customDateNotice: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 5,
    },
    daysContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },
    dayButton: {
      minWidth: 47,
      height: 42,
      paddingHorizontal: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    dayText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    holidayHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    holidayHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    holidayHeadingContent: {
      flex: 1,
      paddingRight: 10,
    },
    holidayCount: {
      minWidth: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    holidayCountText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    scopeContainer: {
      gap: 9,
    },
    scopeOption: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      backgroundColor: colors.background,
    },
    selectedScopeOption: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scopeText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    holidayFormActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 17,
    },
    addButton: {
      flex: 1,
      minHeight: 47,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    addButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 14,
    },
    cancelButton: {
      paddingHorizontal: 18,
      minHeight: 47,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    cancelText: {
      color: colors.text,
      fontWeight: "600",
    },
    listDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 22,
    },
    listTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 0,
    },
    addedHolidaysHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    addedHolidaysCount: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    holidayListScroll: {
      maxHeight: 220,
      flexGrow: 0,
      flexShrink: 1,
    },
    holidayListContent: {
      paddingBottom: 4,
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 24,
    },
    emptyIcon: {
      fontSize: 30,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 5,
    },
    holidayItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    holidayDateBox: {
      width: 45,
      height: 50,
      borderRadius: 10,
      backgroundColor: colors.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    holidayDateDay: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    holidayDateMonth: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    holidayDetails: {
      flex: 1,
      gap: 3,
    },
    holidayItemName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    holidayItemDate: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    holidayScopeLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "600",
    },
    holidayDescription: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    holidayActions: {
      alignItems: "flex-end",
      gap: 9,
    },
    actionButton: {
      paddingVertical: 3,
      paddingHorizontal: 5,
    },
    editText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
    },
    deleteText: {
      color: colors.absent,
      fontSize: 12,
      fontWeight: "700",
    },
    actions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 5,
    },
    resetButton: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    resetText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    saveButton: {
      flex: 2,
      height: 50,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    saveText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },
    footer: {
      textAlign: "center",
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 18,
    },
  });
