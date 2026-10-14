
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout } from '@/constants/spacing';
import { useTheme } from '@/context/ThemeContext';

type ScreenContainerProps = ViewProps & {
  children: React.ReactNode;
  padding?: boolean;
};

export default function ScreenContainer({
  children,
  padding = true,
  style,
  ...props
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Layout.screenVertical,
          paddingLeft: insets.left + (padding ? Layout.screenHorizontal : 0),
          paddingRight: insets.right + (padding ? Layout.screenHorizontal : 0),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
