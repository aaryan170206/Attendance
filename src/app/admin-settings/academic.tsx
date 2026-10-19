
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

type HolidayScope = "all" | "students" | "teachers" | "selected";

type Holiday = {
  id: string;
  name: string;
  date: string;
  description: string;
  scope: HolidayScope;
  groups: string;
};

type AcademicYearRecord = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
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

const HOLIDAY_STORAGE_KEY = "@attendflow_holidays";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
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

const DEFAULT_WORKING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AcademicConfiguration() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Collapsible admin sections (collapsed by default)
  const [isAcademicYearExpanded, setIsAcademicYearExpanded] =
    useState(false);
  const [isHolidayExpanded, setIsHolidayExpanded] =
    useState(false);

  // Academic year and semester
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);

  const [semester, setSemester] = useState("5");
  const [semesterStartDate, setSemesterStartDate] =
    useState("2026-07-01");
  const [semesterEndDate, setSemesterEndDate] =
    useState("2026-11-30");
  const [isCustomSemesterDates, setIsCustomSemesterDates] =
    useState(false);

  // Full academic-year duration
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2027-06-30");

  const [academicConfigLoaded, setAcademicConfigLoaded] =
    useState(false);
  const [isSavingConfiguration, setIsSavingConfiguration] =
    useState(false);

  // Working days
  const [workingDays, setWorkingDays] =
    useState<string[]>(DEFAULT_WORKING_DAYS);

  // Holiday records
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoaded, setHolidaysLoaded] = useState(false);

  // Holiday form
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDescription, setHolidayDescription] = useState("");
  const [holidayScope, setHolidayScope] =
    useState<HolidayScope>("all");
  const [holidayGroups, setHolidayGroups] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

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
  ) => {
    const firstYear = Number(yearName.slice(0, 4));

    if (semesterNumber % 2 !== 0) {
      return {
        startDate: `${firstYear}-07-01`,
        endDate: `${firstYear}-11-30`,
      };
    }

    return {
      startDate: `${firstYear + 1}-01-12`,
      endDate: `${firstYear + 1}-04-30`,
    };
  };

  const formatDate = (date: string) => {
    const [year, month, day] = date.split("-");
    return `${day}-${month}-${year}`;
  };

  // --------------------------------------------------
  // Load academic year and active semester from Supabase
  // --------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    const loadAcademicConfiguration = async () => {
      try {
        const { data: yearData, error: yearError } = await supabase
          .from("academic_years")
          .select("*")
          .eq("name", "2026-2027")
          .single();

        if (yearError) throw yearError;

        const year = yearData as AcademicYearRecord;

        if (!isMounted) return;

        setAcademicYearId(year.id);
        setAcademicYear(year.name);
        setStartDate(year.start_date);
        setEndDate(year.end_date);

        const { data: semesterData, error: semesterError } =
          await supabase
            .from("semesters")
            .select("*")
            .eq("academic_year_id", year.id)
            .eq("is_active", true)
            .maybeSingle();

        if (semesterError) throw semesterError;

        if (!isMounted) return;

        if (semesterData) {
          const activeSemester = semesterData as SemesterRecord;

          setSemester(String(activeSemester.semester_number));
          setSemesterStartDate(activeSemester.start_date);
          setSemesterEndDate(activeSemester.end_date);
          setIsCustomSemesterDates(
            activeSemester.is_custom_dates ?? false
          );
        } else {
          const defaults = getDefaultSemesterDates(5, year.name);

          setSemester("5");
          setSemesterStartDate(defaults.startDate);
          setSemesterEndDate(defaults.endDate);
          setIsCustomSemesterDates(false);
        }
      } catch (error) {
        console.error("Error loading academic configuration:", error);

        if (isMounted) {
          Alert.alert(
            "Loading Error",
            "Unable to load academic year and semester details from Supabase. Please check your connection and database permissions."
          );
        }
      } finally {
        if (isMounted) {
          setAcademicConfigLoaded(true);
        }
      }
    };

    loadAcademicConfiguration();

    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------------------------------------
  // Select a semester
  // --------------------------------------------------

  const handleSemesterChange = async (value: string) => {
    if (!academicYearId) {
      Alert.alert(
        "Please wait",
        "Academic year details are still loading."
      );
      return;
    }

    const semesterNumber = Number(value);

    setSemester(value);

    try {
      const { data, error } = await supabase
        .from("semesters")
        .select("*")
        .eq("academic_year_id", academicYearId)
        .eq("semester_number", semesterNumber)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const selectedSemester = data as SemesterRecord;

        setSemesterStartDate(selectedSemester.start_date);
        setSemesterEndDate(selectedSemester.end_date);
        setIsCustomSemesterDates(
          selectedSemester.is_custom_dates ?? false
        );
      } else {
        const defaults = getDefaultSemesterDates(
          semesterNumber,
          academicYear
        );

        setSemesterStartDate(defaults.startDate);
        setSemesterEndDate(defaults.endDate);
        setIsCustomSemesterDates(false);
      }
    } catch (error) {
      console.error("Error loading semester:", error);

      Alert.alert(
        "Error",
        "Unable to load the selected semester."
      );
    }
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
  // Holiday storage: AsyncStorage
  // --------------------------------------------------

  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const savedHolidays = await AsyncStorage.getItem(
          HOLIDAY_STORAGE_KEY
        );

        if (savedHolidays) {
          const parsedHolidays: unknown = JSON.parse(savedHolidays);

          if (Array.isArray(parsedHolidays)) {
            setHolidays(parsedHolidays as Holiday[]);
          }
        }
      } catch (error) {
        console.error("Error loading holidays:", error);

        Alert.alert(
          "Loading Error",
          "Unable to load saved holidays."
        );
      } finally {
        setHolidaysLoaded(true);
      }
    };

    loadHolidays();
  }, []);

  useEffect(() => {
    if (!holidaysLoaded) return;

    const saveHolidays = async () => {
      try {
        await AsyncStorage.setItem(
          HOLIDAY_STORAGE_KEY,
          JSON.stringify(holidays)
        );
      } catch (error) {
        console.error("Error saving holidays:", error);

        Alert.alert(
          "Saving Error",
          "Unable to save holidays on this device."
        );
      }
    };

    saveHolidays();
  }, [holidays, holidaysLoaded]);

  const sortedHolidays = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays]
  );

  // --------------------------------------------------
  // Holiday form helpers
  // --------------------------------------------------

  const resetHolidayForm = () => {
    setHolidayName("");
    setHolidayDate("");
    setHolidayDescription("");
    setHolidayScope("all");
    setHolidayGroups("");
    setEditingId(null);
  };

  const handleAddHoliday = () => {
    const cleanName = holidayName.trim();
    const cleanDate = holidayDate.trim();
    const cleanGroups = holidayGroups.trim();

    if (!cleanName) {
      Alert.alert("Required", "Enter a holiday name.");
      return;
    }

    if (!isValidDate(cleanDate)) {
      Alert.alert(
        "Invalid date",
        "Enter a valid date in YYYY-MM-DD format. Example: 2026-08-15"
      );
      return;
    }

    if (holidayScope === "selected" && !cleanGroups) {
      Alert.alert(
        "Groups required",
        "Enter at least one department or class."
      );
      return;
    }

    const duplicate = holidays.some(
      (holiday) =>
        holiday.date === cleanDate &&
        holiday.id !== editingId &&
        holiday.scope === holidayScope &&
        holiday.groups === cleanGroups
    );

    if (duplicate) {
      Alert.alert(
        "Possible duplicate",
        "A holiday with the same date and applicability already exists."
      );
      return;
    }

    const holiday: Holiday = {
      id: editingId ?? `${Date.now()}`,
      name: cleanName,
      date: cleanDate,
      description: holidayDescription.trim(),
      scope: holidayScope,
      groups: holidayScope === "selected" ? cleanGroups : "",
    };

    if (editingId) {
      setHolidays((current) =>
        current.map((item) =>
          item.id === editingId ? holiday : item
        )
      );

      Alert.alert(
        "Updated",
        "Holiday details have been updated."
      );
    } else {
      setHolidays((current) => [...current, holiday]);

      Alert.alert(
        "Added",
        "Holiday has been added successfully."
      );
    }

    resetHolidayForm();
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setHolidayName(holiday.name);
    setHolidayDate(holiday.date);
    setHolidayDescription(holiday.description);
    setHolidayScope(holiday.scope);
    setHolidayGroups(holiday.groups);
    setEditingId(holiday.id);

    // Open the form when editing a holiday.
    setIsHolidayExpanded(true);
  };

  const handleDeleteHoliday = (id: string) => {
    Alert.alert(
      "Delete Holiday",
      "Are you sure you want to remove this holiday?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setHolidays((current) =>
              current.filter((item) => item.id !== id)
            );

            if (editingId === id) {
              resetHolidayForm();
            }
          },
        },
      ]
    );
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
        return holiday.groups;
    }
  };

  // --------------------------------------------------
  // Save academic year and semester to Supabase
  // --------------------------------------------------

  const handleSaveConfiguration = async () => {
    if (!academicYear.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert(
        "Incomplete information",
        "Complete all academic year fields."
      );
      return;
    }

    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate) ||
      !isValidDate(semesterStartDate) ||
      !isValidDate(semesterEndDate)
    ) {
      Alert.alert(
        "Invalid dates",
        "Enter all dates in YYYY-MM-DD format."
      );
      return;
    }

    if (startDate > endDate || semesterStartDate > semesterEndDate) {
      Alert.alert(
        "Invalid dates",
        "An end date cannot be before its start date."
      );
      return;
    }

    if (
      semesterStartDate < startDate ||
      semesterEndDate > endDate
    ) {
      Alert.alert(
        "Invalid semester",
        "Semester dates must fall within the academic year."
      );
      return;
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
      // Find the existing academic year first.
      const { data: existingYear, error: findYearError } =
        await supabase
          .from("academic_years")
          .select("id")
          .eq("name", academicYear.trim())
          .maybeSingle();

      if (findYearError) throw findYearError;

      let yearData: AcademicYearRecord;

      if (existingYear) {
        // Update the existing academic year.
        const { data, error } = await supabase
          .from("academic_years")
          .update({
            start_date: startDate,
            end_date: endDate,
            is_active: true,
          })
          .eq("id", existingYear.id)
          .select("*")
          .single();

        if (error) throw error;

        yearData = data as AcademicYearRecord;
      } else {
        // Create a new academic year.
        const { data, error } = await supabase
          .from("academic_years")
          .insert({
            name: academicYear.trim(),
            start_date: startDate,
            end_date: endDate,
            is_active: true,
          })
          .select("*")
          .single();

        if (error) throw error;

        yearData = data as AcademicYearRecord;
      }

      setAcademicYearId(yearData.id);

      // Deactivate other academic years.
      const { error: deactivateYearError } = await supabase
        .from("academic_years")
        .update({ is_active: false })
        .neq("id", yearData.id)
        .eq("is_active", true);

      if (deactivateYearError) throw deactivateYearError;

      // Deactivate other semesters in this academic year.
      const { error: deactivateSemesterError } = await supabase
        .from("semesters")
        .update({ is_active: false })
        .eq("academic_year_id", yearData.id)
        .eq("is_active", true);

      if (deactivateSemesterError) throw deactivateSemesterError;

      // Save the selected semester.
      const { error: semesterError } = await supabase
        .from("semesters")
        .upsert(
          {
            academic_year_id: yearData.id,
            semester_number: Number(semester),
            start_date: semesterStartDate,
            end_date: semesterEndDate,
            is_active: true,
            is_custom_dates: isCustomSemesterDates,
          },
          {
            onConflict: "academic_year_id,semester_number",
          }
        );

      if (semesterError) throw semesterError;

      Alert.alert(
        "Configuration saved",
        "Academic year and semester details have been saved to Supabase."
      );
    } catch (error) {
      console.error("Error saving academic configuration:", error);

      Alert.alert(
        "Saving Error",
        "Unable to save the academic configuration. Please check your connection and database permissions."
      );
    } finally {
      setIsSavingConfiguration(false);
    }
  };

  // --------------------------------------------------
  // Reset screen values
  // --------------------------------------------------

  const handleReset = () => {
    Alert.alert(
      "Reset configuration",
      "Restore the default academic configuration shown on this screen?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setAcademicYear("2026-2027");
            setSemester("5");

            setStartDate("2026-07-01");
            setEndDate("2027-06-30");

            setSemesterStartDate("2026-07-01");
            setSemesterEndDate("2026-11-30");
            setIsCustomSemesterDates(false);

            setWorkingDays(DEFAULT_WORKING_DAYS);

            resetHolidayForm();
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
          <Text style={styles.backText}>
            ‹  Back to Settings
          </Text>
        </Pressable>

        <Text style={styles.heading}>
          Academic Configuration
        </Text>

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

        {/* Academic Year */}
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
              Academic Year
            </Text>

            <Text style={styles.chevron}>
              {isAcademicYearExpanded ? "⌃" : "⌄"}
            </Text>
          </Pressable>

          {isAcademicYearExpanded && (
            <>
              <Text style={styles.label}>
                Academic year
              </Text>

              <TextInput
                value={academicYear}
                onChangeText={setAcademicYear}
                placeholder="e.g. 2026-2027"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>
                Current semester
              </Text>

              <View style={styles.optionsRow}>
                {["1", "2", "3", "4", "5", "6", "7", "8"].map(
                  (item) => (
                    <Pressable
                      key={item}
                      disabled={!academicConfigLoaded}
                      onPress={() => handleSemesterChange(item)}
                      style={[
                        styles.semesterButton,
                        semester === item && styles.selectedButton,
                        !academicConfigLoaded && styles.disabledButton,
                      ]}
                    >
                      <Text
                        style={[
                          styles.semesterText,
                          semester === item && styles.selectedText,
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </>
          )}
        </View>

        {isAcademicYearExpanded && (
          <>
            {/* Session and Semester Duration */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Academic Year Duration
              </Text>

              <Text style={styles.label}>
                Start date (YYYY-MM-DD)
              </Text>

              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-07-01"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>
                End date (YYYY-MM-DD)
              </Text>

              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2027-06-30"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <View style={styles.listDivider} />

              <Text style={styles.sectionTitle}>
                Semester {semester} Duration
              </Text>

              <Text style={styles.label}>
                Semester start date (YYYY-MM-DD)
              </Text>

              <TextInput
                value={semesterStartDate}
                onChangeText={(value) => {
                  setSemesterStartDate(value);
                  setIsCustomSemesterDates(true);
                }}
                placeholder="2026-07-01"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>
                Semester end date (YYYY-MM-DD)
              </Text>

              <TextInput
                value={semesterEndDate}
                onChangeText={(value) => {
                  setSemesterEndDate(value);
                  setIsCustomSemesterDates(true);
                }}
                placeholder="2026-11-30"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.helper}>
                Odd semesters default to 1 July–30 November. Even semesters
                default to 12 January–30 April. Editing either date marks the
                semester as using custom dates.
              </Text>

              {isCustomSemesterDates && (
                <Text style={styles.customDateNotice}>
                  Custom semester dates
                </Text>
              )}
            </View>

            {/* Working Days */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Working Days
              </Text>

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

        {/* Holiday Management */}
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

          {/* Holiday Form - collapsible */}
          {isHolidayExpanded && (
            <>
              <Text style={styles.label}>
                Holiday name
              </Text>

              <TextInput
                value={holidayName}
                onChangeText={setHolidayName}
                placeholder="e.g. Independence Day"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>
                Holiday date (YYYY-MM-DD)
              </Text>

              <TextInput
                value={holidayDate}
                onChangeText={setHolidayDate}
                placeholder="2026-08-15"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>
                Description (optional)
              </Text>

              <TextInput
                value={holidayDescription}
                onChangeText={setHolidayDescription}
                placeholder="Enter additional details"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.descriptionInput]}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>
                Holiday applicability
              </Text>

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
                  <Text style={styles.label}>
                    Departments / classes
                  </Text>

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
                    <Text style={styles.cancelText}>
                      Cancel
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.addButton}
                  onPress={handleAddHoliday}
                >
                  <Text style={styles.addButtonText}>
                    {editingId ? "Update Holiday" : "+ Add Holiday"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Added Holidays - always visible */}
          <View style={styles.listDivider} />

          <View style={styles.addedHolidaysHeader}>
            <Text style={styles.listTitle}>
              Added Holidays
            </Text>

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

              <Text style={styles.emptyTitle}>
                No holidays added
              </Text>

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
                <View
                  key={holiday.id}
                  style={styles.holidayItem}
                >
                  <View style={styles.holidayDateBox}>
                    <Text style={styles.holidayDateDay}>
                      {holiday.date.slice(8, 10)}
                    </Text>

                    <Text style={styles.holidayDateMonth}>
                      {holiday.date.slice(5, 7)}
                    </Text>
                  </View>

                  <View style={styles.holidayDetails}>
                    <Text style={styles.holidayItemName}>
                      {holiday.name}
                    </Text>

                    <Text style={styles.holidayItemDate}>
                      {formatDate(holiday.date)}
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
                      <Text style={styles.editText}>
                        Edit
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeleteHoliday(holiday.id)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.deleteText}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Configuration Actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.resetButton}
            onPress={handleReset}
          >
            <Text style={styles.resetText}>
              Reset
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.saveButton,
              (isSavingConfiguration || !academicConfigLoaded) &&
                styles.disabledButton,
            ]}
            onPress={handleSaveConfiguration}
            disabled={isSavingConfiguration || !academicConfigLoaded}
          >
            <Text style={styles.saveText}>
              {isSavingConfiguration ? "Saving..." : "Save Configuration"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Academic year and semester details are saved to Supabase.
          Working days and holiday records are currently saved locally
          on this device.
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
    semesterButton: {
      width: 39,
      height: 39,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
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
