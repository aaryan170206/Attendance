
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

import AppCard from "@/components/AppCard";
import AppHeader from "@/components/AppHeader";
import { Layout, Spacing } from "@/constants/spacing";

export default function AccountScreen() {
  const { user, role, signOut } = useAuth();
  const { colors } = useTheme();

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
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

  const getRoleName = () => {
    switch (role) {
      case "student":
        return "Student";
      case "teacher":
        return "Teacher";
      case "admin":
        return "Admin";
      default:
        return "Not available";
    }
  };

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader
        title="Account"
        subtitle="Manage your account details and preferences"
      />

      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Personal Information
        </Text>

        <View style={styles.infoGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Name
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {user?.user_metadata?.full_name || "User"}
          </Text>
        </View>

        <View style={styles.infoGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Email Address
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {user?.email || "Not available"}
          </Text>
        </View>

        <View style={styles.infoGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Account Role
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {getRoleName()}
          </Text>
        </View>
      </AppCard>

      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [
          styles.logoutButton,
          {
            backgroundColor: colors.absent,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>

      <Text style={[styles.footer, { color: colors.textSecondary }]}>
        AttendFlow
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: Layout.screenHorizontal,
    paddingTop: Layout.screenVertical,
    paddingBottom: Spacing.xxxl,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },

  infoGroup: {
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#80808040",
  },

  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },

  value: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 23,
  },

  logoutButton: {
    minHeight: Layout.buttonHeight,
    borderRadius: Layout.buttonRadius,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },

  logoutText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  footer: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.xxl,
  },
});
