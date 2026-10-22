
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

// --------------------------------------------------
// Types
// --------------------------------------------------

type Department = {
  id: string;
  name: string;
};

type AttendanceSettings = {
  department_id: string;
  theory_threshold: number | null;
  lab_threshold: number | null;
  closing_time: string;
};

const DEFAULT_CLOSING_TIME = "17:00";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const isValidThreshold = (value: string) => {
  if (!value.trim()) return true;

  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0 &&
    number <= 100
  );
};

const isValidTime = (value: string) => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

const formatTime = (value: string | null | undefined) => {
  if (!value) return DEFAULT_CLOSING_TIME;

  return value.slice(0, 5);
};

// --------------------------------------------------
// Screen
// --------------------------------------------------

export default function AttendanceSettings() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { role, loading: authLoading } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] =
    useState<Department | null>(null);

  const [isDepartmentListOpen, setIsDepartmentListOpen] =
    useState(false);

  const [theoryThreshold, setTheoryThreshold] = useState("");
  const [labThreshold, setLabThreshold] = useState("");
  const [closingTime, setClosingTime] =
    useState(DEFAULT_CLOSING_TIME);

  const [isLoadingDepartments, setIsLoadingDepartments] =
    useState(true);

  const [isLoadingSettings, setIsLoadingSettings] =
    useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  // --------------------------------------------------
  // Reset form
  // --------------------------------------------------

  const resetForm = () => {
    setTheoryThreshold("");
    setLabThreshold("");
    setClosingTime(DEFAULT_CLOSING_TIME);
  };

  // --------------------------------------------------
  // Load departments
  // --------------------------------------------------

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;

      const departmentList = (data ?? []) as Department[];

      setDepartments(departmentList);

      if (departmentList.length > 0) {
        setSelectedDepartment((current) => {
          if (
            current &&
            departmentList.some(
              (department) => department.id === current.id
            )
          ) {
            return current;
          }

          return departmentList[0];
        });
      } else {
        setSelectedDepartment(null);
        resetForm();
      }
    } catch (error: any) {
      console.error("Error loading departments:", error);

      setLoadError(
        error?.message || "Unable to load departments."
      );
    } finally {
      setIsLoadingDepartments(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && role === "admin") {
      loadDepartments();
    }
  }, [authLoading, role, loadDepartments]);

  // --------------------------------------------------
  // Load settings for selected department
  // --------------------------------------------------

  useEffect(() => {
    if (!selectedDepartment) return;

    let isMounted = true;

    const loadSettings = async () => {
      setIsLoadingSettings(true);
      setLoadError(null);
      resetForm();

      try {
        const { data, error } = await supabase
          .from("department_attendance_settings")
          .select(
            "department_id, theory_threshold, lab_threshold, closing_time"
          )
          .eq("department_id", selectedDepartment.id)
          .maybeSingle();

        if (error) throw error;

        if (!isMounted) return;

        if (data) {
          const settings = data as AttendanceSettings;

          setTheoryThreshold(
            settings.theory_threshold === null
              ? ""
              : String(settings.theory_threshold)
          );

          setLabThreshold(
            settings.lab_threshold === null
              ? ""
              : String(settings.lab_threshold)
          );

          setClosingTime(
            formatTime(settings.closing_time)
          );
        }
      } catch (error: any) {
        console.error("Error loading attendance settings:", error);

        if (isMounted) {
          setLoadError(
            error?.message ||
              "Unable to load attendance settings."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [selectedDepartment?.id]);

  // --------------------------------------------------
  // Save settings
  // --------------------------------------------------

  const handleSave = async () => {
    if (!selectedDepartment) {
      Alert.alert(
        "Department Required",
        "Please select a department."
      );
      return;
    }

    if (
      !isValidThreshold(theoryThreshold) ||
      !isValidThreshold(labThreshold)
    ) {
      Alert.alert(
        "Invalid Threshold",
        "Attendance thresholds must be between 0 and 100."
      );
      return;
    }

    if (!isValidTime(closingTime)) {
      Alert.alert(
        "Invalid Closing Time",
        "Enter the closing time in 24-hour format (HH:MM), for example 17:00."
      );
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("department_attendance_settings")
        .upsert(
          {
            department_id: selectedDepartment.id,

            theory_threshold: theoryThreshold.trim()
              ? Number(theoryThreshold)
              : null,

            lab_threshold: labThreshold.trim()
              ? Number(labThreshold)
              : null,

            closing_time: `${closingTime}:00`,
          },
          {
            onConflict: "department_id",
          }
        );

      if (error) throw error;

      Alert.alert(
        "Settings Saved",
        `Attendance settings for ${selectedDepartment.name} have been saved successfully.`
      );
    } catch (error: any) {
      console.error("Error saving attendance settings:", error);

      Alert.alert(
        "Saving Failed",
        error?.message ||
          "Unable to save attendance settings. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------
  // Access control
  // --------------------------------------------------

  if (authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>
          Checking administrator access...
        </Text>
      </View>
    );
  }

  if (role !== "admin") {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.sectionTitle}>
          Access Denied
        </Text>

        <Text style={styles.helper}>
          Only administrators can access attendance settings.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          Attendance Settings
        </Text>

        <Text style={styles.subtitle}>
          Configure attendance thresholds and submission deadlines
          separately for each department.
        </Text>

        {/* Department selection */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Department
          </Text>

          <Text style={styles.label}>
            Select department
          </Text>

          {isLoadingDepartments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>
                Loading departments...
              </Text>
            </View>
          ) : departments.length === 0 ? (
            <Text style={styles.helper}>
              No departments found.
            </Text>
          ) : (
            <>
              <Pressable
                style={styles.departmentSelector}
                onPress={() =>
                  setIsDepartmentListOpen((current) => !current)
                }
              >
                <Text style={styles.departmentName}>
                  {selectedDepartment?.name ?? "Select department"}
                </Text>

                <Text style={styles.chevron}>
                  {isDepartmentListOpen ? "⌃" : "⌄"}
                </Text>
              </Pressable>

              {isDepartmentListOpen && (
                <View style={styles.departmentList}>
                  {departments.map((department) => {
                    const isSelected =
                      department.id === selectedDepartment?.id;

                    return (
                      <Pressable
                        key={department.id}
                        style={[
                          styles.departmentOption,
                          isSelected && styles.selectedDepartment,
                        ]}
                        onPress={() => {
                          setSelectedDepartment(department);
                          setIsDepartmentListOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.departmentOptionText,
                            isSelected && styles.selectedText,
                          ]}
                        >
                          {department.name}
                        </Text>

                        {isSelected && (
                          <Text style={styles.selectedText}>
                            ✓
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        {/* Loading settings */}

        {isLoadingSettings && selectedDepartment && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>
              Loading {selectedDepartment.name} settings...
            </Text>
          </View>
        )}

        {!!loadError && (
          <View style={styles.section}>
            <Text style={styles.errorText}>
              {loadError}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadDepartments}
            >
              <Text style={styles.retryText}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {/* Attendance thresholds */}

        {!!selectedDepartment && !isLoadingSettings && !loadError && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Attendance Thresholds
              </Text>

              <Text style={styles.helper}>
                Set the minimum attendance percentage for each
                class type. Leave a field blank to keep its
                threshold unset.
              </Text>

              {/* Theory */}

              <Text style={styles.label}>
                Theory attendance threshold
              </Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  value={theoryThreshold}
                  onChangeText={setTheoryThreshold}
                  placeholder="e.g. 75"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  maxLength={6}
                />

                <Text style={styles.inputSuffix}>%</Text>
              </View>

              {/* Lab */}

              <Text style={styles.label}>
                Lab attendance threshold
              </Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  value={labThreshold}
                  onChangeText={setLabThreshold}
                  placeholder="e.g. 75"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  maxLength={6}
                />

                <Text style={styles.inputSuffix}>%</Text>
              </View>

              <Text style={styles.helper}>
                Both thresholds accept values from 0 to 100.
              </Text>
            </View>

            {/* Closing time */}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Attendance Closing Time
              </Text>

              <Text style={styles.helper}>
                Set the daily deadline for students to submit
                their attendance.
              </Text>

              <Text style={styles.label}>
                Closing time (24-hour format)
              </Text>

              <TextInput
                value={closingTime}
                onChangeText={setClosingTime}
                placeholder="17:00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                style={styles.input}
                maxLength={5}
              />

              <Text style={styles.helper}>
                Format: HH:MM. Default closing time is 17:00 (5:00 PM).
              </Text>
            </View>

            {/* Save */}

            <Pressable
              style={[
                styles.saveButton,
                isSaving && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>
                  Save Attendance Settings
                </Text>
              )}
            </Pressable>

            <Text style={styles.footer}>
              Changes apply to the selected department only.
              Existing attendance records will not be modified.
            </Text>
          </>
        )}
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

    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 25,
      backgroundColor: colors.background,
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

    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      marginTop: 14,
    },

    helper: {
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
      marginTop: 7,
    },

    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginVertical: 12,
    },

    loadingText: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    departmentSelector: {
      minHeight: 49,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      paddingHorizontal: 13,
      backgroundColor: colors.background,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    departmentName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },

    chevron: {
      color: colors.textSecondary,
      fontSize: 21,
      fontWeight: "700",
    },

    departmentList: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      overflow: "hidden",
    },

    departmentOption: {
      minHeight: 46,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    selectedDepartment: {
      backgroundColor: colors.primary,
    },

    departmentOptionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "500",
    },

    selectedText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },

    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      backgroundColor: colors.background,
      paddingRight: 14,
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
      flex: 1,
    },

    inputSuffix: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "600",
      marginLeft: 10,
    },

    saveButton: {
      minHeight: 51,
      borderRadius: 12,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 16,
      marginTop: 3,
    },

    saveText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    disabledButton: {
      opacity: 0.55,
    },

    footer: {
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 17,
    },

    errorText: {
      color: "#DC2626",
      fontSize: 13,
      lineHeight: 19,
    },

    retryButton: {
      marginTop: 12,
      alignSelf: "flex-start",
    },

    retryText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
    },
  });
