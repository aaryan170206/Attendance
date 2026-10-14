
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Alert, Pressable, StyleSheet, Text } from "react-native";

export default function LogoutButton() {
  const { signOut } = useAuth();
  const { colors } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            const { error } = await signOut();

            if (error) {
              Alert.alert("Logout failed", error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={handleLogout}
      style={[
        styles.button,
        { backgroundColor: colors.card }
      ]}
    >
      <Text style={[styles.text, { color: "#EF4444" }]}>
        Logout
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
