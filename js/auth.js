// Complete auth.js with fixed login and better error handling

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

      console.log('Attempting login for:', email);

      // Add timeout to prevent hanging
      const loginPromise = window.supabaseClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(), // Ensure email is trimmed and lowercase
        password: password
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout - please check your connection')), 10000)
      );

      const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

      if (error) {
        console.error('Supabase login error:', error);
        // Provide more user-friendly error messages
        if (error.message.includes('fetch')) {
          throw new Error('Connection error. Please check your internet and try again.');
        } else if (error.message.includes('Invalid login')) {
          throw new Error('Invalid email or password.');
        } else {
          throw error;
        }
      }

      this.currentUser = data.user;
      await this.loadUserProfile();
      console.log('Login successful!');
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

      console.log('Attempting registration for:', email);

      const { data, error } = await window.supabaseClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) {
        console.error('Supabase registration error:', error);
        if (error.message.includes('fetch')) {
          throw new Error('Connection error. Please check your internet and try again.');
        }
        throw error;
      }

      if (data.user) {
      // Create user profile AND initialize progress
      await this.createUserProfile(data.user.id, displayName, email);
      this.currentUser = data.user;
      
      // ✅ NEW: Load the newly created progress records
      await this.loadUserProfile();
      
      console.log('Registration successful!');
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

    // Create user profile
    const { error: profileError } = await window.supabaseClient
      .from('user_profiles')
      .insert([{
        id: userId,
        display_name: displayName,
        email: email.trim().toLowerCase(),
        total_score: 100,
        created_at: new Date().toISOString()
      }]);

    if (profileError && profileError.code !== '23505') {
      console.error('Profile creation error:', profileError);
    }

    // ✅ NEW: Initialize user_progress for all difficulties
    const difficulties = ['easy', 'medium', 'hard'];
    const progressRecords = difficulties.map(difficulty => ({
      user_id: userId,
      difficulty: difficulty,
      completed_levels: 0,
      level_scores: [],
      failed_levels: [],
      completed_levels_array: [],
      total_score: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: progressError } = await window.supabaseClient
      .from('user_progress')
      .insert(progressRecords);

    if (progressError && progressError.code !== '23505') {
      console.error('Progress initialization error:', progressError);
    }

    console.log('✅ User profile and progress initialized successfully');
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
