import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: true, // Default: dark mode

      toggle: () =>
        set((state) => {
          const newDark = !state.isDark;
          applyTheme(newDark);
          return { isDark: newDark };
        }),

      setDark: (dark) => {
        applyTheme(dark);
        set({ isDark: dark });
      },
    }),
    {
      name: 'varun-hotel-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.isDark);
      },
    },
  ),
);

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
