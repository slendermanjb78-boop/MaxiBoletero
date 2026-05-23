import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider } from "@/src/theme/theme";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
