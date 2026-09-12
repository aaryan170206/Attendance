import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { colors } = useTheme();

  const [isSignUp, setIsSignUp] = useState(false);

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      Alert.alert(
        "Missing information",
        "Please enter your email and password."
      );
      return;
    }

    if (isSignUp) {
      if (!fullName.trim()) {
        Alert.alert(
          "Missing information",
          "Please enter your full name."
        );
        return;
      }

      if (password.length < 6) {
        Alert.alert(
          "Password too short",
          "Password must contain at least 6 characters."
        );
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert(
          "Passwords do not match",
          "Please make sure both passwords are the same."
        );
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(
          cleanEmail,
          password,
          fullName.trim()
        );

        if (error) {
          Alert.alert(
            "Sign Up Failed",
            error.message
          );
          return;
        }

        Alert.alert(
          "Account Created",
          "Your account has been created. Check your email if confirmation is required, then sign in."
        );

        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error } = await signIn(
          cleanEmail,
          password
        );

        if (error) {
          Alert.alert(
            "Sign In Failed",
            error.message
          );
        }
      }
    } catch (error) {
      Alert.alert(
        "Something went wrong",
        "Unable to complete the request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.logo,
              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          >
            <Text style={styles.logoText}>
              A
            </Text>
          </View>

          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            Attendance Tracker
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {isSignUp
              ? "Create your account"
              : "Welcome back"}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor:
                colors.card,
              borderColor:
                colors.border,
            },
          ]}
        >
          {isSignUp && (
            <>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Full Name
              </Text>

              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={
                  colors.textSecondary
                }
                autoCapitalize="words"
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor:
                      colors.cardSecondary,
                    borderColor:
                      colors.border,
                  },
                ]}
              />
            </>
          )}

          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={
              colors.textSecondary
            }
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor:
                  colors.cardSecondary,
                borderColor:
                  colors.border,
              },
            ]}
          />

          <Text
            style={[
              styles.label,
              {
                color: colors.text,
              },
            ]}
          >
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={
              colors.textSecondary
            }
            secureTextEntry
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor:
                  colors.cardSecondary,
                borderColor:
                  colors.border,
              },
            ]}
          />

          {isSignUp && (
            <>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Confirm Password
              </Text>

              <TextInput
                value={confirmPassword}
                onChangeText={
                  setConfirmPassword
                }
                placeholder="Confirm your password"
                placeholderTextColor={
                  colors.textSecondary
                }
                secureTextEntry
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor:
                      colors.cardSecondary,
                    borderColor:
                      colors.border,
                  },
                ]}
              />
            </>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[
              styles.button,
              {
                backgroundColor:
                  colors.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={styles.buttonText}
              >
                {isSignUp
                  ? "Create Account"
                  : "Sign In"}
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            setIsSignUp(!isSignUp);
            setPassword("");
            setConfirmPassword("");
          }}
          style={styles.switchButton}
        >
          <Text
            style={[
              styles.switchText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {isSignUp
              ? "Already have an account? "
              : "Don't have an account? "}

            <Text
              style={[
                styles.switchLink,
                {
                  color: colors.primary,
                },
              ]}
            >
              {isSignUp
                ? "Sign In"
                : "Create Account"}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },

  header: {
    alignItems: "center",
    marginBottom: 28,
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
  },

  title: {
    fontSize: 27,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 15,
    marginTop: 6,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 16,
  },

  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  switchButton: {
    alignItems: "center",
    marginTop: 20,
  },

  switchText: {
    fontSize: 14,
  },

  switchLink: {
    fontWeight: "700",
  },
});