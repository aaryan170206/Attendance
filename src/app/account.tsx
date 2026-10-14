
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
        {
          backgroundColor: colors.background,
        },
      ]}
      contentContainerStyle={styles.content}
    >
      {/* Page Heading */}
      <Text
        style={[
          styles.title,
          {
            color: colors.text,
          },
        ]}
      >
        Account
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        Manage your account
      </Text>

      {/* Account Information */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Name
        </Text>

        <Text
          style={[
            styles.value,
            {
              color: colors.text,
            },
          ]}
        >
          {user?.user_metadata?.full_name || "User"}
        </Text>

        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Email
        </Text>

        <Text
          style={[
            styles.value,
            {
              color: colors.text,
            },
          ]}
        >
          {user?.email || "Not available"}
        </Text>

        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          Role
        </Text>

        <Text
          style={[
            styles.value,
            {
              color: colors.text,
              textTransform: "capitalize",
            },
          ]}
        >
          {getRoleName()}
        </Text>
      </View>

      {/* Sign Out Button */}
      <Pressable
        onPress={handleSignOut}
        style={[
          styles.logoutButton,
          {
            backgroundColor: colors.absent,
          },
        ]}
      >
        <Text style={styles.logoutText}>
          Sign Out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    marginTop: 10,
  },

  subtitle: {
    fontSize: 15,
    marginTop: 4,
    marginBottom: 20,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },

  label: {
    fontSize: 12,
    marginTop: 12,
  },

  value: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 4,
  },

  logoutButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },

  logoutText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
