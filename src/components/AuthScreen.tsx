
import { Ionicons } from "@expo/vector-icons";
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

import AppCard from "@/components/AppCard";
import { Layout, Spacing } from "@/constants/spacing";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { colors } = useTheme();

  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
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
          Alert.alert("Sign Up Failed", error.message);
          return;
        }

        Alert.alert(
          "Account Created",
          "Your account has been created. Check your email if confirmation is required, then sign in."
        );

        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
      } else {
        const { error } = await signIn(cleanEmail, password);

        if (error) {
          Alert.alert("Sign In Failed", error.message);
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

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    options?: {
      secure?: boolean;
      visible?: boolean;
      toggleVisibility?: () => void;
      keyboardType?: "default" | "email-address";
      autoCapitalize?: "none" | "words";
      autoCorrect?: boolean;
    }
  ) => {
    const isPassword = options?.secure === true;

    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {label}
        </Text>

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.cardSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType={options?.keyboardType ?? "default"}
            autoCapitalize={options?.autoCapitalize ?? "none"}
            autoCorrect={options?.autoCorrect ?? false}
            secureTextEntry={
              isPassword && !options?.visible
            }
            style={[
              styles.input,
              { color: colors.text },
            ]}
          />

          {isPassword && options?.toggleVisibility && (
            <Pressable
              onPress={options.toggleVisibility}
              style={styles.visibilityButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                options.visible ? "Hide password" : "Show password"
              }
            >
              <Ionicons
                name={
                  options.visible
                    ? "eye-off-outline"
                    : "eye-outline"
                }
                size={21}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.logo,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.logoText}>A</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Attendance Tracker
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: colors.textSecondary },
            ]}
          >
            {isSignUp ? "Create your account" : "Welcome back"}
          </Text>
        </View>

        <AppCard padding={22} style={styles.card}>
          {isSignUp &&
            renderInput(
              "Full Name",
              fullName,
              setFullName,
              "Enter your full name",
              { autoCapitalize: "words" }
            )}

          {renderInput(
            "Email",
            email,
            setEmail,
            "Enter your email",
            {
              keyboardType: "email-address",
              autoCapitalize: "none",
              autoCorrect: false,
            }
          )}

          {renderInput(
            "Password",
            password,
            setPassword,
            "Enter your password",
            {
              secure: true,
              visible: showPassword,
              toggleVisibility: () =>
                setShowPassword(!showPassword),
            }
          )}

          {isSignUp &&
            renderInput(
              "Confirm Password",
              confirmPassword,
              setConfirmPassword,
              "Confirm your password",
              {
                secure: true,
                visible: showConfirmPassword,
                toggleVisibility: () =>
                  setShowConfirmPassword(!showConfirmPassword),
              }
            )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? "Create Account" : "Sign In"}
              </Text>
            )}
          </Pressable>
        </AppCard>

        <Pressable
          onPress={() => {
            setIsSignUp(!isSignUp);
            setPassword("");
            setConfirmPassword("");
            setShowPassword(false);
            setShowConfirmPassword(false);
          }}
          style={styles.switchButton}
        >
          <Text
            style={[
              styles.switchText,
              { color: colors.textSecondary },
            ]}
          >
            {isSignUp
              ? "Already have an account? "
              : "Don't have an account? "}

            <Text
              style={[
                styles.switchLink,
                { color: colors.primary },
              ]}
            >
              {isSignUp ? "Sign In" : "Create Account"}
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
    paddingHorizontal: Layout.screenHorizontal,
    paddingVertical: Spacing.xxxl,
  },

  header: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },

  logo: {
    width: 66,
    height: 66,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
  },

  title: {
    fontSize: 27,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    marginTop: Spacing.sm,
  },

  card: {
    borderRadius: 20,
  },

  field: {
    marginBottom: Spacing.lg,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },

  inputContainer: {
    minHeight: Layout.inputHeight,
    borderRadius: Layout.buttonRadius,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    minHeight: Layout.inputHeight - 2,
    paddingHorizontal: Layout.inputPadding,
    fontSize: 15,
  },

  visibilityButton: {
    width: 48,
    height: Layout.inputHeight - 2,
    justifyContent: "center",
    alignItems: "center",
  },

  button: {
    height: Layout.buttonHeight,
    borderRadius: Layout.buttonRadius,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xs,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  switchButton: {
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
  },

  switchText: {
    fontSize: 14,
    textAlign: "center",
  },

  switchLink: {
    fontWeight: "700",
  },
});
