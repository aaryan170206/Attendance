
import { router } from "expo-router";

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

type SettingsItem = {
  title: string;
  description: string;
  icon: string;
  color: string;
  background: string;
};

const settingsItems: SettingsItem[] = [
  {
    title: "Academic Configuration",
    description:
      "Manage academic year, semesters, session dates and holidays.",
    icon: "▦",
    color: "#2563EB",
    background: "#DBEAFE",
  },
  {
    title: "Attendance Settings",
    description:
      "Configure department attendance thresholds and closing time.",
    icon: "✓",
    color: "#16A34A",
    background: "#DCFCE7",
  },
  {
    title: "Account & Profile",
    description:
      "View and edit your profile, manage password and sign out.",
    icon: "♙",
    color: "#2563EB",
    background: "#DBEAFE",
  },
];

export default function AdminSettings() {
  const { colors, isDark } = useTheme();
  const { user, signOut } = useAuth();

  const styles = createStyles(colors, isDark);

  const adminName =
    user?.user_metadata?.full_name ?? "Admin";

  const handleProfile = () => {
    Alert.alert(
      "Admin Profile",
      `Name: ${adminName}\nEmail: ${user?.email ?? "Not available"}`,
      [
        {
          text: "Close",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: handleSignOut,
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of AttendFlow?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            const { error } = await signOut();

            if (error) {
              Alert.alert(
                "Sign Out Failed",
                error.message
              );
            }
          },
        },
      ]
    );
  };

  const handleSettingsPress = (title: string) => {
    switch (title) {
      case "Academic Configuration":
        router.push("/admin-settings/academic");
        break;

      case "Attendance Settings":
        router.push("/admin-settings/attendance");
        break;

      case "Account & Profile":
        handleProfile();
        break;
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>◆</Text>
            </View>

            <View>
              <Text style={styles.brandName}>
                Attend<Text style={styles.brandHighlight}>Flow</Text>
              </Text>

              <Text style={styles.brandSubtitle}>
                Admin Panel
              </Text>
            </View>
          </View>
        </View>

        {/* Page Heading */}
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>
            Settings
          </Text>

          <Text style={styles.subheading}>
            Manage academic and attendance configuration
          </Text>
        </View>

        {/* Settings Cards */}
        <View style={styles.settingsContainer}>
          {settingsItems.map((item) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [
                styles.settingsCard,
                pressed && styles.cardPressed,
              ]}
              onPress={() =>
                handleSettingsPress(item.title)
              }
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isDark
                      ? colors.cardSecondary
                      : item.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryIcon,
                    { color: item.color },
                  ]}
                >
                  {item.icon}
                </Text>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>
                  {item.title}
                </Text>

                <Text style={styles.cardDescription}>
                  {item.description}
                </Text>
              </View>

              <Text style={styles.arrow}>
                ›
              </Text>
            </Pressable>
          ))}
        </View>

        {/* System Information */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              System Settings
            </Text>

            <Text style={styles.infoDescription}>
              Changes made here affect the entire institution.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          AttendFlow • Admin Panel
        </Text>
      </ScrollView>
    </View>
  );
}

// Styles
const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  isDark: boolean
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 68,
      paddingBottom: 30,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 38,
    },

    brandContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    logo: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    logoText: {
      fontSize: 25,
      color: "#FFFFFF",
      fontWeight: "bold",
    },

    brandName: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },

    brandHighlight: {
      color: colors.primary,
    },

    brandSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },

    headingContainer: {
      marginBottom: 28,
    },

    heading: {
      fontSize: 30,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 7,
    },

    subheading: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },

    settingsContainer: {
      gap: 14,
    },

    settingsCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
      minHeight: 125,
      gap: 14,
    },

    cardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.99 }],
    },

    iconContainer: {
      width: 76,
      height: 76,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },

    categoryIcon: {
      fontSize: 35,
      fontWeight: "600",
    },

    cardContent: {
      flex: 1,
      gap: 6,
    },

    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },

    cardDescription: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },

    arrow: {
      fontSize: 30,
      color: colors.textSecondary,
      marginLeft: 2,
    },

    infoCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark
        ? colors.cardSecondary
        : "#E5F0FF",
      borderRadius: 18,
      padding: 17,
      marginTop: 24,
      gap: 13,
    },

    infoIconContainer: {
      width: 36,
      alignItems: "center",
    },

    infoIcon: {
      fontSize: 30,
      color: colors.primary,
      fontWeight: "bold",
    },

    infoContent: {
      flex: 1,
      gap: 3,
    },

    infoTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },

    infoDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },

    footer: {
      textAlign: "center",
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 25,
    },
  });
