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
        // Validate and sanitize invite code
        const sanitizedCode = code.trim().replace(/[<>'&]/g, '');
        if (sanitizedCode.length > 0 && sanitizedCode.length <= 50) {
          set({ inviteCode: sanitizedCode });
        } else {
          throw new Error('Invalid invite code format');
        }
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
