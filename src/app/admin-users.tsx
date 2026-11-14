
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import {
  getAdminUsers,
  assignStudentRollNumber,
  type AdminUser,
} from "@/services/adminUsers";

type RoleFilter = "all" | "student" | "teacher" | "admin";
type StatusFilter = "all" | "active" | "invited" | "suspended";

export default function AdminUsers() {
  const colors = useTheme();
  const isDark = useColorScheme() === "dark";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Roll number assignment states
  const [rollNumberInput, setRollNumberInput] = useState("");
  const [savingRollNumber, setSavingRollNumber] = useState(false);
  const [rollNumberError, setRollNumberError] = useState<string | null>(null);
  const [rollNumberSuccess, setRollNumberSuccess] = useState(false);

  const borderColor = isDark ? "#383B40" : "#E0E1E6";

  // Load users from Supabase
  const loadUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getAdminUsers();

      if (result.error) {
        setError(result.error);
      } else {
        setUsers(result.data || []);
        setError(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load users."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Calculate user counts
  const counts = useMemo(
    () => ({
      students: users.filter((user) => user.role === "student").length,
      teachers: users.filter((user) => user.role === "teacher").length,
      admins: users.filter((user) => user.role === "admin").length,
    }),
    [users]
  );

  // Search and filters
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchTerm = search.trim().toLowerCase();

      const matchesSearch =
        (user.full_name || "").toLowerCase().includes(searchTerm) ||
        (user.roll_number || "").toLowerCase().includes(searchTerm);

      const matchesRole =
        roleFilter === "all" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Role colors
  const getRoleColor = (role: string) => {
    switch (role) {
      case "student":
        return "#3B82F6";
      case "teacher":
        return "#A855F7";
      case "admin":
        return "#D97706";
      default:
        return colors.textSecondary;
    }
  };

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#16A34A";
      case "invited":
        return "#D97706";
      case "suspended":
        return "#DC2626";
      default:
        return colors.textSecondary;
    }
  };

  // Save or update a student's roll number
  const handleSaveRollNumber = async () => {
    if (!selectedUser || selectedUser.role !== "student") {
      return;
    }

    const normalizedRollNumber = rollNumberInput.trim();

    if (!normalizedRollNumber) {
      setRollNumberError("Please enter a roll number.");
      return;
    }

    setSavingRollNumber(true);
    setRollNumberError(null);
    setRollNumberSuccess(false);

    try {
      const result = await assignStudentRollNumber(
        selectedUser.user_id,
        normalizedRollNumber
      );

      if (result.error) {
        setRollNumberError(result.error);
        return;
      }

      const updatedRollNumber = result.data;

      // Update the users list immediately
      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user.user_id === selectedUser.user_id
            ? {
                ...user,
                roll_number: updatedRollNumber,
              }
            : user
        )
      );

      // Update the selected user in the modal
      setSelectedUser((previousUser: AdminUser | null) =>
        previousUser
          ? {
              ...previousUser,
              roll_number: updatedRollNumber,
            }
          : null
      );

      setRollNumberInput(updatedRollNumber ?? "");
      setRollNumberSuccess(true);
    } catch (err) {
      setRollNumberError(
        err instanceof Error
          ? err.message
          : "Failed to update roll number."
      );
    } finally {
      setSavingRollNumber(false);
    }
  };

  // Reusable filter button
  const FilterButton = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: 20,
        marginRight: 8,
        backgroundColor: selected
          ? colors.backgroundSelected
          : colors.backgroundElement,
        borderWidth: selected ? 1 : 0,
        borderColor: colors.textSecondary,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: 13,
          fontWeight: selected ? "700" : "500",
          textTransform: "capitalize",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  // User card
  const renderUser = ({ item }: { item: AdminUser }) => (
    <Pressable
      onPress={() => {
        setSelectedUser(item);
        setRollNumberInput(item.roll_number ?? "");
        setRollNumberError(null);
        setRollNumberSuccess(false);
        setDetailsVisible(true);
      }}
      style={{
        backgroundColor: colors.backgroundElement,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {item.full_name}
          </Text>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginTop: 5,
            }}
          >
            Joined {new Date(item.created_at).toLocaleDateString()}
          </Text>

          {item.role === "student" && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              Roll Number: {item.roll_number || "Not assigned"}
            </Text>
          )}
        </View>

        <View
          style={{
            backgroundColor: getRoleColor(item.role) + "20",
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              color: getRoleColor(item.role),
              fontSize: 12,
              fontWeight: "700",
              textTransform: "capitalize",
            }}
          >
            {item.role}
          </Text>
        </View>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: borderColor,
          marginVertical: 13,
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: getStatusColor(item.status),
            marginRight: 7,
          }}
        />

        <Text
          style={{
            color: getStatusColor(item.status),
            fontSize: 12,
            fontWeight: "600",
            textTransform: "capitalize",
          }}
        >
          {item.status}
        </Text>

        <View style={{ flex: 1 }} />

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
          }}
        >
          View details →
        </Text>
      </View>
    </Pressable>
  );

  // Loading screen
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.text} />

        <Text
          style={{
            color: colors.textSecondary,
            marginTop: 12,
          }}
        >
          Loading users...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 55,
          paddingBottom: 35,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadUsers(true)}
            tintColor={colors.text}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Page heading */}
            <Text
              style={{
                color: colors.text,
                fontSize: 26,
                fontWeight: "800",
              }}
            >
              Users
            </Text>

            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                marginTop: 5,
                marginBottom: 20,
              }}
            >
              Manage your institution's members
            </Text>

            {/* Error message */}
            {error && (
              <View
                style={{
                  padding: 14,
                  backgroundColor: "#DC262620",
                  borderRadius: 12,
                  marginBottom: 18,
                }}
              >
                <Text style={{ color: "#DC2626" }}>{error}</Text>

                <Pressable
                  onPress={() => loadUsers()}
                  style={{ marginTop: 8 }}
                >
                  <Text
                    style={{
                      color: "#DC2626",
                      fontWeight: "700",
                    }}
                  >
                    Try again
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Overview cards */}
            <View
              style={{
                flexDirection: "row",
                marginBottom: 22,
              }}
            >
              {[
                { label: "Students", value: counts.students },
                { label: "Teachers", value: counts.teachers },
                { label: "Admins", value: counts.admins },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    backgroundColor: colors.backgroundElement,
                    borderRadius: 14,
                    padding: 13,
                    marginRight: 8,
                    borderWidth: 1,
                    borderColor,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                    }}
                  >
                    {stat.label}
                  </Text>

                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 24,
                      fontWeight: "800",
                      marginTop: 5,
                    }}
                  >
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Search */}
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or roll number..."
              placeholderTextColor={colors.textSecondary}
              style={{
                backgroundColor: colors.backgroundElement,
                borderRadius: 13,
                paddingHorizontal: 16,
                paddingVertical: 13,
                color: colors.text,
                borderWidth: 1,
                borderColor,
                fontSize: 14,
                marginBottom: 20,
              }}
            />

            {/* Role filters */}
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: "700",
                marginBottom: 11,
              }}
            >
              Filter by role
            </Text>

            <View
              style={{
                flexDirection: "row",
                marginBottom: 20,
                flexWrap: "wrap",
                rowGap: 8,
              }}
            >
              {(
                ["all", "student", "teacher", "admin"] as RoleFilter[]
              ).map((role) => (
                <FilterButton
                  key={role}
                  label={role}
                  selected={roleFilter === role}
                  onPress={() => setRoleFilter(role)}
                />
              ))}
            </View>

            {/* Status filters */}
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: "700",
                marginBottom: 11,
              }}
            >
              Membership status
            </Text>

            <View
              style={{
                flexDirection: "row",
                marginBottom: 20,
                flexWrap: "wrap",
                rowGap: 8,
              }}
            >
              {(
                ["all", "active", "invited", "suspended"] as StatusFilter[]
              ).map((status) => (
                <FilterButton
                  key={status}
                  label={status}
                  selected={statusFilter === status}
                  onPress={() => setStatusFilter(status)}
                />
              ))}
            </View>

            {/* Members heading */}
            <Text
              style={{
                color: colors.text,
                fontSize: 17,
                fontWeight: "800",
                marginBottom: 14,
              }}
            >
              Members ({filteredUsers.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              paddingVertical: 35,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
              }}
            >
              {error
                ? "Users could not be loaded."
                : "No users match your filters."}
            </Text>
          </View>
        }
      />

      {/* User Details Modal */}
      <Modal
        visible={detailsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingRollNumber) {
            setDetailsVisible(false);
          }
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 20,
              padding: 22,
              borderWidth: 1,
              borderColor,
            }}
          >
            {/* Modal heading */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 22,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 21,
                  fontWeight: "800",
                }}
              >
                User Details
              </Text>

              <Pressable
                disabled={savingRollNumber}
                onPress={() => setDetailsVisible(false)}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 15,
                  }}
                >
                  Close
                </Text>
              </Pressable>
            </View>

            {selectedUser && (
              <>
                {/* Full name */}
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  FULL NAME
                </Text>

                <Text
                  style={{
                    color: colors.text,
                    fontSize: 19,
                    fontWeight: "700",
                    marginTop: 5,
                    marginBottom: 18,
                  }}
                >
                  {selectedUser.full_name}
                </Text>

                {/* User ID */}
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  USER ID
                </Text>

                <Text
                  selectable
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    marginTop: 5,
                    marginBottom: 18,
                  }}
                >
                  {selectedUser.user_id}
                </Text>

                {/* Role */}
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  ROLE
                </Text>

                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: "600",
                    textTransform: "capitalize",
                    marginTop: 5,
                    marginBottom: 18,
                  }}
                >
                  {selectedUser.role}
                </Text>

                {/* Student roll number assignment */}
                {selectedUser.role === "student" && (
                  <>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                      }}
                    >
                      ROLL NUMBER
                    </Text>

                    <TextInput
                      value={rollNumberInput}
                      onChangeText={(value) => {
                        setRollNumberInput(value);
                        setRollNumberError(null);
                        setRollNumberSuccess(false);
                      }}
                      placeholder="Enter college roll number"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!savingRollNumber}
                      style={{
                        backgroundColor: colors.backgroundElement,
                        color: colors.text,
                        borderWidth: 1,
                        borderColor,
                        borderRadius: 10,
                        paddingHorizontal: 13,
                        paddingVertical: 12,
                        fontSize: 15,
                        marginTop: 8,
                        marginBottom: 10,
                      }}
                    />

                    {rollNumberError && (
                      <Text
                        style={{
                          color: "#DC2626",
                          fontSize: 12,
                          marginBottom: 10,
                        }}
                      >
                        {rollNumberError}
                      </Text>
                    )}

                    {rollNumberSuccess && (
                      <Text
                        style={{
                          color: "#16A34A",
                          fontSize: 12,
                          marginBottom: 10,
                        }}
                      >
                        Roll number saved successfully.
                      </Text>
                    )}

                    <Pressable
                      onPress={handleSaveRollNumber}
                      disabled={savingRollNumber}
                      style={{
                        backgroundColor: colors.backgroundSelected,
                        paddingVertical: 12,
                        borderRadius: 10,
                        alignItems: "center",
                        marginBottom: 20,
                        opacity: savingRollNumber ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: "700",
                          fontSize: 14,
                        }}
                      >
                        {savingRollNumber
                          ? "Saving..."
                          : selectedUser.roll_number
                            ? "Update Roll Number"
                            : "Assign Roll Number"}
                      </Text>
                    </Pressable>
                  </>
                )}

                {/* Membership status */}
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  MEMBERSHIP STATUS
                </Text>

                <Text
                  style={{
                    color: getStatusColor(selectedUser.status),
                    fontSize: 15,
                    fontWeight: "700",
                    textTransform: "capitalize",
                    marginTop: 5,
                    marginBottom: 18,
                  }}
                >
                  {selectedUser.status}
                </Text>

                {/* Membership date */}
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  JOINED ON
                </Text>

                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    marginTop: 5,
                  }}
                >
                  {new Date(selectedUser.created_at).toLocaleDateString()}
                </Text>
              </>
            )}

            {/* Close button */}
            <Pressable
              disabled={savingRollNumber}
              onPress={() => setDetailsVisible(false)}
              style={{
                backgroundColor: colors.backgroundSelected,
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: "center",
                marginTop: 25,
                opacity: savingRollNumber ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
