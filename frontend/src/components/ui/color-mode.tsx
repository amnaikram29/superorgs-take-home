import { IconButton } from '@chakra-ui/react';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function ColorModeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange {...props}>
      {children}
    </ThemeProvider>
  );
}

export type ColorMode = 'light' | 'dark';

export function useColorMode(): { colorMode: ColorMode; toggleColorMode: () => void } {
  const { resolvedTheme, setTheme } = useTheme();
  // Default to dark — resolvedTheme is undefined before next-themes hydrates,
  // and we force dark mode globally so this should always be 'dark'.
  const colorMode: ColorMode = resolvedTheme === 'light' ? 'light' : 'dark';
  const toggleColorMode = () => setTheme(colorMode === 'dark' ? 'light' : 'dark');
  return { colorMode, toggleColorMode };
}

export function ColorModeButton() {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <IconButton aria-label="Toggle color mode" variant="ghost" size="sm" onClick={toggleColorMode}>
      {colorMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}
