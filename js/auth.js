class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isGuest = false;
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      
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
      const { data, error } = await supabase.auth.signInWithPassword({
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
      const { data, error } = await supabase.auth.signUp({
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
      const { error } = await supabase
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
    if (!this.currentUser) return null;

    try {
      const { data, error } = await supabase
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
    return { success: true };
  }

  async logout() {
    if (this.isGuest) {
      this.isGuest = false;
      this.currentUser = null;
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
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
