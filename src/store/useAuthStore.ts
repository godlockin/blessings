import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  inviteCode: string | null;
  isAuthenticated: boolean;
  setInviteCode: (code: string) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      inviteCode: null,
      isAuthenticated: false,
      setInviteCode: (code) => set({ inviteCode: code }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      logout: () => set({ inviteCode: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
