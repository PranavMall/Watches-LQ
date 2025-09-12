class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isGuest = false;
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      // Check if Supabase client exists
      if (!window.supabaseClient) {
        console.warn('Supabase client not available, skipping auth initialization');
        return;
      }

      // Check for existing session
      const { data: { session }, error } = await window.supabaseClient.auth.getSession();
      
      if (error) {
        console.error('Auth session error:', error);
        return;
      }

      if (session) {
        this.currentUser = session.user;
        await this.loadUserProfile();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  }

  async loginWithEmail(email, password) {
    try {
      // Check if Supabase is available
      if (!window.supabaseClient) {
        throw new Error('Authentication service not available. Please try guest mode.');
      }

      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      this.currentUser = data.user;
      await this.loadUserProfile();
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  async registerWithEmail(email, password, displayName) {
    try {
      // Check if Supabase is available
      if (!window.supabaseClient) {
        throw new Error('Registration service not available. Please try guest mode.');
      }

      const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create user profile
        await this.createUserProfile(data.user.id, displayName, email);
        this.currentUser = data.user;
        return { success: true, requiresConfirmation: !data.session };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  async createUserProfile(userId, displayName, email) {
    try {
      if (!window.supabaseClient) {
        console.warn('Supabase not available for profile creation');
        return;
      }

      const { error } = await window.supabaseClient
        .from('user_profiles')
        .insert([
          {
            id: userId,
            display_name: displayName,
            email: email,
            total_score: 0,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Profile creation error:', error);
    }
  }

  async loadUserProfile() {
    if (!this.currentUser || !window.supabaseClient) return null;

    try {
      const { data, error } = await window.supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Profile load error:', error);
        return null;
      }

      if (!data) {
        // Create profile if it doesn't exist
        await this.createUserProfile(
          this.currentUser.id,
          this.currentUser.user_metadata?.display_name || 'User',
          this.currentUser.email
        );
        return await this.loadUserProfile();
      }

      return data;
    } catch (error) {
      console.error('Profile load error:', error);
      return null;
    }
  }

  async playAsGuest() {
    this.isGuest = true;
    this.currentUser = {
      id: 'guest_' + Date.now(),
      email: 'guest@local',
      user_metadata: { display_name: 'Guest' }
    };
    
    // Guest mode always succeeds
    console.log('Playing as guest user');
    return { success: true };
  }

  async logout() {
    if (this.isGuest) {
      this.isGuest = false;
      this.currentUser = null;
      return { success: true };
    }

    try {
      if (window.supabaseClient) {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
      }

      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Still log out locally even if Supabase fails
      this.currentUser = null;
      return { success: true };
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  isGuestUser() {
    return this.isGuest;
  }

  getDisplayName() {
    if (!this.currentUser) return 'User';
    return this.currentUser.user_metadata?.display_name || 'User';
  }
}
