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

// Secure storage with encryption simulation
const secureStorage = {
  getItem: (name: string): string | null => {
    try {
      const item = localStorage.getItem(name);
      if (!item) return null;
      
      // Basic obfuscation (not encryption for demo)
      const decoded = atob(item);
      const parsed = JSON.parse(decoded);
      
      // Check if session expired
      if (parsed.sessionExpiry && Date.now() > parsed.sessionExpiry) {
        localStorage.removeItem(name);
        return null;
      }
      
      return item;
    } catch (error) {
      console.warn('Storage access error:', error);
      localStorage.removeItem(name);
      return null;
    }
  },
  
  setItem: (name: string, value: string): void => {
    try {
      // Add session expiry (24 hours)
      const parsed = JSON.parse(value);
      parsed.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000);
      
      const obfuscated = btoa(JSON.stringify(parsed));
      localStorage.setItem(name, obfuscated);
    } catch (error) {
      console.warn('Storage write error:', error);
    }
  },
  
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
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
        
        // Clear any additional sensitive data
        try {
          localStorage.removeItem('auth-storage');
          // Clear any potential cached data
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => {
                if (name.includes('auth') || name.includes('session')) {
                  caches.delete(name);
                }
              });
            });
          }
        } catch (error) {
          console.warn('Cache cleanup error:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        inviteCode: state.inviteCode,
        isAuthenticated: state.isAuthenticated,
        sessionExpiry: state.sessionExpiry,
      }),
    }
  )
);
