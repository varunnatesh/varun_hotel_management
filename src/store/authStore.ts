import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              set({ user: profile as User, isInitialized: true });
              // Update last_login
              await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', session.user.id);
              return;
            }
          }
          set({ user: null, isInitialized: true });
        } catch {
          set({ user: null, isInitialized: true });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { error: error.message };
          }

          if (!data.user) {
            set({ isLoading: false, error: 'Login failed. Please try again.' });
            return { error: 'Login failed' };
          }

          // Fetch user profile with role
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError || !profile) {
            set({ isLoading: false, error: 'User profile not found.' });
            return { error: 'User profile not found' };
          }

          if (!profile.is_active) {
            await supabase.auth.signOut();
            set({ isLoading: false, error: 'Your account is deactivated. Contact the owner.' });
            return { error: 'Account deactivated' };
          }

          // Update last_login
          await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.user.id);

          set({ user: profile as User, isLoading: false, error: null });
          return {};
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          set({ isLoading: false, error: message });
          return { error: message };
        }
      },

      logout: async () => {
        set({ isLoading: true });
        await supabase.auth.signOut();
        set({ user: null, isLoading: false, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'varun-hotel-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

// ─── Role Guards ──────────────────────────────────────────────────────────────
export const isOwner       = (role?: UserRole) => role === 'owner';
export const isStoreManager= (role?: UserRole) => role === 'store_manager';
export const isKitchen     = (role?: UserRole) => role === 'kitchen';
export const isSupervisor  = (role?: UserRole) => role === 'supervisor';
export const isCashier     = (role?: UserRole) => role === 'cashier';
export const isCaptain     = (role?: UserRole) => role === 'captain';

/** Role → default redirect path */
export const ROLE_HOME: Record<UserRole, string> = {
  owner:         '/owner/dashboard',
  store_manager: '/store/dashboard',
  kitchen:       '/kitchen/display',
  supervisor:    '/supervisor/dashboard',
  cashier:       '/cashier/new-order',
  captain:       '/captain/tables',
  guest:         '/menu',
};
