import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  inviteCode: string | null;
  isAuthenticated: boolean;
  sessionExpiry: number | null;
  setInviteCode: (code: string) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  logout: () => void;
  checkSessionValidity: () => boolean;
}

/**
 * Strict validation pattern for invite codes.
 * Allows alphanumeric characters, hyphens, and underscores.
 * Minimum 8 characters, maximum 32 characters.
 */
const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

// Simple wrapper for storage to handle session expiry logic
const authStorage = {
  getItem: (name: string): string | null => {
    try {
      const item = sessionStorage.getItem(name);
      if (!item) return null;
      
      const parsed = JSON.parse(item);
      
      // Check if session expired
      if (parsed.state?.sessionExpiry && Date.now() > parsed.state.sessionExpiry) {
        sessionStorage.removeItem(name);
        return null;
      }
      
      return item;
    } catch (error) {
      console.warn('Storage access error:', error);
      sessionStorage.removeItem(name);
      return null;
    }
  },
  
  setItem: (name: string, value: string): void => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn('Storage write error:', error);
    }
  },
  
  removeItem: (name: string): void => {
    sessionStorage.removeItem(name);
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      inviteCode: null,
      isAuthenticated: false,
      sessionExpiry: null,
      
      setInviteCode: (code: string) => {
        // Validate invite code with strict pattern
        const trimmedCode = code.trim();

        if (!INVITE_CODE_PATTERN.test(trimmedCode)) {
          throw new Error(
            'Invalid invite code format. Code must be 8-32 characters and ' +
            'contain only letters, numbers, hyphens, and underscores.'
          );
        }

        set({ inviteCode: trimmedCode });
      },
      
      setAuthenticated: (isAuthenticated: boolean) => {
        set({ 
          isAuthenticated,
          sessionExpiry: isAuthenticated ? Date.now() + (24 * 60 * 60 * 1000) : null
        });
      },
      
      checkSessionValidity: (): boolean => {
        const { isAuthenticated, sessionExpiry } = get();
        if (!isAuthenticated || !sessionExpiry) return false;
        
        if (Date.now() > sessionExpiry) {
          set({ isAuthenticated: false, sessionExpiry: null, inviteCode: null });
          return false;
        }
        
        return true;
      },
      
      logout: () => {
        set({ 
          inviteCode: null, 
          isAuthenticated: false, 
          sessionExpiry: null 
        });
        sessionStorage.removeItem('auth-storage');
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => authStorage),
      partialize: (state) => ({
        inviteCode: state.inviteCode,
        isAuthenticated: state.isAuthenticated,
        sessionExpiry: state.sessionExpiry,
      }),
    }
  )
);
