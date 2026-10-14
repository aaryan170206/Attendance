
import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/spacing';
import { useTheme } from '@/context/ThemeContext';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function AppHeader({
  title,
  subtitle,
}: AppHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.title,
          { color: colors.text },
        ]}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 15,
    marginTop: Spacing.xs,
  },
});
