
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type Assignment = {
  id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
};

type StudentSubmission = {
  assignment_id: string;
  status: 'pending' | 'submitted';
  submitted_at: string | null;
};

type AssignmentItem = Assignment & {
  subjectName: string;
  semester: number | null;
  submissionStatus: 'pending' | 'submitted';
  submittedAt: string | null;
};

export default function AssignmentsScreen() {
  const { colors } = useTheme();

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      setError(null);

      // Get the currently logged-in student
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Unable to identify the logged-in student.');
      }

      // Fetch assignments visible to this student
      const { data: assignmentData, error: assignmentError } =
        await supabase
          .from('assignments')
          .select('*')
          .order('created_at', { ascending: false });

      if (assignmentError) {
        throw assignmentError;
      }

      const assignmentRows = (assignmentData ?? []) as Assignment[];

      if (assignmentRows.length === 0) {
        setAssignments([]);
        return;
      }

      // Collect unique class and subject IDs
      const classIds = [
        ...new Set(assignmentRows.map((item) => item.class_id)),
      ];

      const subjectIds = [
        ...new Set(assignmentRows.map((item) => item.subject_id)),
      ];

      const assignmentIds = assignmentRows.map((item) => item.id);

      // Fetch related class information
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, semester')
        .in('id', classIds);

      if (classError) {
        throw classError;
      }

      // Fetch related subject information
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);

      if (subjectError) {
        throw subjectError;
      }

      // Fetch this student's submission records
      const { data: submissionData, error: submissionError } =
        await supabase
          .from('assignment_submissions')
          .select('assignment_id, status, submitted_at')
          .eq('student_id', user.id)
          .in('assignment_id', assignmentIds);

      if (submissionError) {
        throw submissionError;
      }

      const classMap = new Map(
        (classData ?? []).map((item) => [item.id, item.semester])
      );

      const subjectMap = new Map(
        (subjectData ?? []).map((item) => [item.id, item.name])
      );

      const submissionMap = new Map(
        ((submissionData ?? []) as StudentSubmission[]).map((item) => [
          item.assignment_id,
          item,
        ])
      );

      // Combine all information
      const formattedAssignments: AssignmentItem[] = assignmentRows.map(
        (item) => {
          const submission = submissionMap.get(item.id);

          return {
            ...item,
            subjectName: subjectMap.get(item.subject_id) ?? 'Subject',
            semester: classMap.get(item.class_id) ?? null,
            submissionStatus: submission?.status ?? 'pending',
            submittedAt: submission?.submitted_at ?? null,
          };
        }
      );

      setAssignments(formattedAssignments);
    } catch (err) {
      console.error('Student assignments error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load assignments.'
      );
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await loadAssignments();
      setLoading(false);
    };

    initialize();
  }, [loadAssignments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAssignments();
    setRefreshing(false);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'No due date';

    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderAssignment = ({ item }: { item: AssignmentItem }) => {
    const isSubmitted = item.submissionStatus === 'submitted';

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.subject, { color: colors.primary }]}>
              {item.subjectName}
            </Text>

            <Text style={[styles.title, { color: colors.text }]}>
              {item.title}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isSubmitted
                  ? '#DCFCE7'
                  : '#FEF3C7',
              },
            ]}
          >
            <Text
              style={{
                color: isSubmitted ? '#166534' : '#92400E',
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {isSubmitted ? 'Submitted' : 'Pending'}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text
            style={[
              styles.description,
              { color: colors.textSecondary },
            ]}
            numberOfLines={3}
          >
            {item.description}
          </Text>
        ) : null}

        <View
          style={[
            styles.footer,
            { borderTopColor: colors.border },
          ]}
        >
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Semester
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {item.semester ?? '—'}
            </Text>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Due date
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {formatDate(item.due_date)}
            </Text>
          </View>
        </View>

        {isSubmitted && item.submittedAt ? (
          <Text style={[styles.submittedDate, { color: colors.present }]}>
            Submitted on {formatDate(item.submittedAt)}
          </Text>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading assignments...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>
          Assignments
        </Text>

        <Text style={[styles.subheading, { color: colors.textSecondary }]}>
          View your assigned work and submission status.
        </Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: '#EF4444', textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={assignments}
          renderItem={renderAssignment}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            assignments.length === 0
              ? styles.emptyContainer
              : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No assignments yet
              </Text>

              <Text
                style={[
                  styles.emptySubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Your teachers' assignments will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  heading: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 13,
    marginTop: 5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  subject: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 15,
    paddingTop: 12,
  },
  label: {
    fontSize: 11,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  submittedDate: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
