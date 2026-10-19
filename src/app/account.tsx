
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

import AppHeader from "@/components/AppHeader";
import { Layout, Spacing } from "@/constants/spacing";

export default function AccountScreen() {
  const { user, role, signOut } = useAuth();
  const { colors } = useTheme();

  const fullName = user?.user_metadata?.full_name || "User";
  const email = user?.email || "Not available";

  const getRoleName = () => {
    switch (role) {
      case "student":
        return "Student";
      case "teacher":
        return "Teacher";
      case "admin":
        return "Administrator";
      default:
        return "Not available";
    }
  };

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
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
              Alert.alert("Sign Out Failed", error.message);
            }
          },
        },
      ]
    );
  };

  const InfoRow = ({
    icon,
    label,
    value,
  }: {
    icon: string;
    label: string;
    value: string;
  }) => (
    <View style={styles.infoRow}>
      <View
        style={[
          styles.infoIcon,
          { backgroundColor: `${colors.primary}15` },
        ]}
      >
        <Text style={styles.infoIconText}>{icon}</Text>
      </View>

      <View style={styles.infoContent}>
        <Text
          style={[
            styles.infoLabel,
            { color: colors.textSecondary },
          ]}
        >
          {label}
        </Text>

        <Text
          style={[
            styles.infoValue,
            { color: colors.text },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <AppHeader
          title="Account"
          subtitle="Manage your account details and preferences"
        />

        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.card },
          ]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.avatarText}>
              {getInitials(fullName)}
            </Text>
          </View>

          <Text
            style={[
              styles.profileName,
              { color: colors.text },
            ]}
          >
            {fullName}
          </Text>

          <Text
            style={[
              styles.profileEmail,
              { color: colors.textSecondary },
            ]}
          >
            {email}
          </Text>

          <View
            style={[
              styles.roleBadge,
              { backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Text
              style={[
                styles.roleText,
                { color: colors.primary },
              ]}
            >
              {getRoleName()}
            </Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.sectionHeading}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text },
            ]}
          >
            Personal Information
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Your registered account details
          </Text>
        </View>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.card },
          ]}
        >
          <InfoRow
            icon="👤"
            label="Full Name"
            value={fullName}
          />

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.textSecondary },
            ]}
          />

          <InfoRow
            icon="✉️"
            label="Email Address"
            value={email}
          />

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.textSecondary },
            ]}
          />

          <InfoRow
            icon="🎓"
            label="Account Role"
            value={getRoleName()}
          />
        </View>

        {/* Account Information */}
        <View style={styles.sectionHeading}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text },
            ]}
          >
            Account
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Application and session details
          </Text>
        </View>

        <View
          style={[
            styles.accountCard,
            { backgroundColor: colors.card },
          ]}
        >
          <View style={styles.accountRow}>
            <View>
              <Text
                style={[
                  styles.accountLabel,
                  { color: colors.text },
                ]}
              >
                Application
              </Text>

              <Text
                style={[
                  styles.accountDescription,
                  { color: colors.textSecondary },
                ]}
              >
                AttendFlow Attendance Manager
              </Text>
            </View>

            <Text
              style={[
                styles.versionText,
                { color: colors.primary },
              ]}
            >
              AttendFlow
            </Text>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            styles.logoutButton,
            {
              backgroundColor: `${colors.absent}12`,
              borderColor: `${colors.absent}45`,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.logoutIcon,
              { color: colors.absent },
            ]}
          >
            ↪
          </Text>

          <Text
            style={[
              styles.logoutText,
              { color: colors.absent },
            ]}
          >
            Sign Out
          </Text>
        </Pressable>

        {/* Footer */}
        <View style={styles.footer}>
          <Text
            style={[
              styles.footerTitle,
              { color: colors.textSecondary },
            ]}
          >
            AttendFlow
          </Text>

          <Text
            style={[
              styles.footerSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Track your attendance. Stay on track.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Layout.screenHorizontal,
    paddingTop: Layout.screenVertical + 48,
    paddingBottom: Spacing.xxxl,
  },

  // Profile
  profileCard: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },

  profileName: {
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },

  profileEmail: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },

  roleBadge: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 14,
  },

  roleText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Section headings
  sectionHeading: {
    marginBottom: Spacing.md,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  sectionSubtitle: {
    fontSize: 12,
    marginTop: 5,
  },

  // Information card
  infoCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: Spacing.xxl,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 17,
  },

  infoIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  infoIconText: {
    fontSize: 18,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 5,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.2,
    marginLeft: 56,
  },

  // Account information
  accountCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: Spacing.xxl,
  },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  accountLabel: {
    fontSize: 14,
    fontWeight: "700",
  },

  accountDescription: {
    fontSize: 11,
    marginTop: 5,
  },

  versionText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Logout
  logoutButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: Spacing.sm,
  },

  logoutIcon: {
    fontSize: 21,
    fontWeight: "700",
  },

  logoutText: {
    fontSize: 14,
    fontWeight: "800",
  },

  // Footer
  footer: {
    alignItems: "center",
    marginTop: Spacing.xxxl,
  },

  footerTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },

  footerSubtitle: {
    fontSize: 11,
    marginTop: 5,
  },
});
