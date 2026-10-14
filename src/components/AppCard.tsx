
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { Layout } from '@/constants/spacing';
import { useTheme } from '@/context/ThemeContext';

type AppCardProps = ViewProps & {
  children: React.ReactNode;
  padding?: number;
};

export default function AppCard({
  children,
  padding = Layout.cardPadding,
  style,
  ...props
}: AppCardProps) {
  const { colors } = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Layout.cardRadius,
  },
});
