import { supabase } from './supabase';
import { storageService } from './storageService';

const SESSION_KEY = 'auth_session';

export const INITIAL_OWNER_EMAIL = 'fairuzziachmad@gmail.com';

export const DEMO_CREDENTIALS = {
  username: 'admin',
  password: 'adminseatflow2026',
  email: 'fairuzziachmad@gmail.com',
  name: 'Administrator Kelas (Owner)',
};

export const authService = {
  /**
   * Log in via Supabase Auth or fallback demo credentials
   */
  async login(emailOrUsername, password) {
    const trimmedInput = (emailOrUsername || '').trim();

    // 1. Try real Supabase Auth
    try {
      // If user typed username instead of email, treat as admin email
      const email = trimmedInput.includes('@') ? trimmedInput : `${trimmedInput}@seatflow.internal`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data?.user) {
        // Fetch role from admin_profiles
        let role = 'ADMIN';
        if (data.user.email?.toLowerCase() === INITIAL_OWNER_EMAIL.toLowerCase()) {
          role = 'OWNER';
        }

        const { data: profile } = await supabase
          .from('admin_profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.role) {
          role = profile.role;
        }

        const session = {
          token: data.session?.access_token || `token-${Date.now()}`,
          user: {
            id: data.user.id,
            email: data.user.email,
            name: profile?.full_name || (role === 'OWNER' ? 'Achmad Yanuar Fairuzzi (Owner)' : 'Administrator'),
            role,
          },
          loginTime: new Date().toISOString(),
        };

        storageService.set(SESSION_KEY, session);
        return { success: true, user: session.user };
      }
    } catch (err) {
      console.warn('[authService] Supabase Auth sign-in error:', err);
    }

    // 2. Demo fallback authentication for testing & evaluation
    const isUsernameMatch = trimmedInput.toLowerCase() === DEMO_CREDENTIALS.username.toLowerCase();
    const isEmailMatch = trimmedInput.toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase();
    const isPasswordMatch = password === DEMO_CREDENTIALS.password;

    if ((isUsernameMatch || isEmailMatch) && isPasswordMatch) {
      const isOwner = isEmailMatch || trimmedInput.toLowerCase() === INITIAL_OWNER_EMAIL.toLowerCase();
      const session = {
        token: `demo-token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        user: {
          username: DEMO_CREDENTIALS.username,
          email: DEMO_CREDENTIALS.email,
          name: DEMO_CREDENTIALS.name,
          role: isOwner ? 'OWNER' : 'ADMIN',
        },
        loginTime: new Date().toISOString(),
      };
      storageService.set(SESSION_KEY, session);
      return { success: true, user: session.user };
    }

    return {
      success: false,
      message: 'Email/Username atau Kata Sandi salah. Gunakan kredensial demo pengujian yang tertera.',
    };
  },

  /**
   * Log out session
   */
  async logout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    storageService.remove(SESSION_KEY);
  },

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated() {
    const session = storageService.get(SESSION_KEY, null);
    return Boolean(session && session.user);
  },

  /**
   * Get current user profile
   */
  getCurrentUser() {
    const session = storageService.get(SESSION_KEY, null);
    return session ? session.user : null;
  },

  /**
   * Check if current user is OWNER
   */
  isOwner() {
    const user = this.getCurrentUser();
    return user?.role === 'OWNER';
  },

  /**
   * Listen to auth state changes from Supabase
   */
  onAuthStateChange(callback) {
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const role = session.user.email?.toLowerCase() === INITIAL_OWNER_EMAIL.toLowerCase() ? 'OWNER' : 'ADMIN';
          const userObj = {
            id: session.user.id,
            email: session.user.email,
            name: role === 'OWNER' ? 'Achmad Yanuar Fairuzzi (Owner)' : 'Administrator',
            role,
          };
          storageService.set(SESSION_KEY, { token: session.access_token, user: userObj });
          callback(userObj);
        } else if (event === 'SIGNED_OUT') {
          storageService.remove(SESSION_KEY);
          callback(null);
        }
      });
      return () => subscription.unsubscribe();
    } catch {
      return () => {};
    }
  },
};
