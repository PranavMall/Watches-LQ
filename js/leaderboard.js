// js/leaderboard.js - Updated for new schema
class LeaderboardManager {
  constructor(authManager, gameManager) {
    this.authManager = authManager;
    this.gameManager = gameManager;
    this.sessionId = this.getOrCreateSessionId();
    this.currentTimeframe = 'all';
    this.leaderboardData = {
      all: [],
      weekly: [],
      daily: []
    };
    this.userRank = null;
    this.isLoading = false;
    
    // Initialize session tracking
    this.initializeSession();
  }

  // Session Management
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('watches_lq_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('watches_lq_session_id', sessionId);
    }
    return sessionId;
  }

  async initializeSession() {
    if (!window.supabaseClient) {
      console.warn('Supabase not available, skipping session initialization');
      return;
    }

    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      
      // Set session context for RLS policies
      await this.setSessionContext();
      
      // Get device info for analytics
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      // Check if session exists
      const { data: existingSession } = await window.supabaseClient
        .from('user_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .single();

      if (!existingSession) {
        // Create new session
        const { error } = await window.supabaseClient
          .from('user_sessions')
          .insert([{
            user_id: isGuest ? null : user?.id,
            session_id: this.sessionId,
            display_name: this.authManager.getDisplayName(),
            is_guest: isGuest,
            device_info: deviceInfo
          }]);

        if (error) {
          console.error('Failed to create session:', error);
          return;
        }
      } else {
        // Update last active time
        await window.supabaseClient
          .from('user_sessions')
          .update({ 
            last_active: new Date().toISOString(),
            display_name: this.authManager.getDisplayName()
          })
          .eq('session_id', this.sessionId);
      }
    } catch (error) {
      console.error('Session initialization error:', error);
    }
  }

  // Set session context for RLS policies
  async setSessionContext() {
    if (!window.supabaseClient) return;
    
    try {
      await window.supabaseClient.rpc('set_config', {
        setting_name: 'app.session_id',
        setting_value: this.sessionId,
        is_local: true
      });
    } catch (error) {
      console.warn('Failed to set session context:', error);
    }
  }

  async updateLeaderboardEntry() {
    if (!window.supabaseClient) {
      console.warn('Supabase not available, skipping leaderboard update');
      return;
    }

    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      const progress = this.gameManager.userProgress;
      
      // Ensure session exists first
      await this.ensureSessionExists();
      
      // Set session context for RLS
      await this.setSessionContext();
      
      // Calculate total levels completed across all difficulties
      const easyCompleted = (progress.easy?.completedLevels || []).length;
      const mediumCompleted = (progress.medium?.completedLevels || []).length;
      const hardCompleted = (progress.hard?.completedLevels || []).length;
      const totalCompleted = easyCompleted + mediumCompleted + hardCompleted;

      // Get country code from timezone (rough approximation)
      const countryCode = this.getCountryFromTimezone();

      // Use the upsert function from your schema
      const { error } = await window.supabaseClient.rpc('upsert_leaderboard_entry', {
        p_user_id: isGuest ? null : user?.id,
        p_session_id: this.sessionId,
        p_display_name: this.authManager.getDisplayName(),
        p_total_score: this.gameManager.getTotalScore(),
        p_levels_completed: totalCompleted,
        p_easy_completed: easyCompleted,
        p_medium_completed: mediumCompleted,
        p_hard_completed: hardCompleted,
        p_is_guest: isGuest,
        p_country_code: countryCode
      });

      if (error) {
        console.error('Failed to update leaderboard entry:', error);
        
        // Fallback: try direct insert/update
        await this.fallbackLeaderboardUpdate();
      } else {
        console.log('Leaderboard entry updated successfully');
      }
    } catch (error) {
      console.error('Failed to update leaderboard:', error);
    }
  }

  // Fallback method if the upsert function fails
  async fallbackLeaderboardUpdate() {
    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      const progress = this.gameManager.userProgress;
      
      const easyCompleted = (progress.easy?.completedLevels || []).length;
      const mediumCompleted = (progress.medium?.completedLevels || []).length;
      const hardCompleted = (progress.hard?.completedLevels || []).length;
      const totalCompleted = easyCompleted + mediumCompleted + hardCompleted;

      const entryData = {
        user_id: isGuest ? null : user?.id,
        session_id: this.sessionId,
        display_name: this.authManager.getDisplayName(),
        total_score: this.gameManager.getTotalScore(),
        levels_completed: totalCompleted,
        easy_completed: easyCompleted,
        medium_completed: mediumCompleted,
        hard_completed: hardCompleted,
        is_guest: isGuest,
        country_code: this.getCountryFromTimezone(),
        updated_at: new Date().toISOString()
      };

      // Check if entry exists
      let existingQuery = window.supabaseClient
        .from('leaderboard_entries')
        .select('*');

      if (isGuest) {
        existingQuery = existingQuery.eq('session_id', this.sessionId);
      } else {
        existingQuery = existingQuery.eq('user_id', user.id);
      }

      const { data: existingEntry } = await existingQuery.single();

      if (existingEntry) {
        // Update existing entry only if score is higher
        if (entryData.total_score >= existingEntry.total_score) {
          const { error } = await window.supabaseClient
            .from('leaderboard_entries')
            .update(entryData)
            .eq('id', existingEntry.id);

          if (error) throw error;
        }
      } else {
        // Insert new entry
        const { error } = await window.supabaseClient
          .from('leaderboard_entries')
          .insert([entryData]);

        if (error) throw error;
      }

      console.log('Fallback leaderboard update successful');
    } catch (error) {
      console.error('Fallback leaderboard update failed:', error);
    }
  }

  // Ensure session exists before creating leaderboard entry
  async ensureSessionExists() {
    try {
      const { data: session } = await window.supabaseClient
        .from('user_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .single();

      if (!session) {
        // Create session
        const user = this.authManager.getCurrentUser();
        const isGuest = this.authManager.isGuestUser();

        const { error } = await window.supabaseClient
          .from('user_sessions')
          .insert([{
            user_id: isGuest ? null : user?.id,
            session_id: this.sessionId,
            display_name: this.authManager.getDisplayName(),
            is_guest: isGuest,
            device_info: {}
          }]);

        if (error) {
          console.error('Failed to create session:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error ensuring session exists:', error);
      throw error;
    }
  }

  // Fetch leaderboard data using views for better performance
  async fetchLeaderboard(timeframe = 'all', limit = 100) {
    if (!window.supabaseClient) {
      console.warn('Supabase not available');
      return [];
    }

    this.isLoading = true;

    try {
      let query;
      
      // Use views for weekly and daily leaderboards
      if (timeframe === 'weekly') {
        query = window.supabaseClient
          .from('weekly_leaderboard')
          .select('*')
          .limit(limit);
      } else if (timeframe === 'daily') {
        query = window.supabaseClient
          .from('daily_leaderboard')
          .select('*')
          .limit(limit);
      } else {
        // All-time leaderboard
        query = window.supabaseClient
          .from('leaderboard_entries')
          .select('*')
          .order('total_score', { ascending: false })
          .limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Add rank if not already present
      const rankedData = data.map((entry, index) => ({
        ...entry,
        rank: entry.rank || (index + 1)
      }));

      this.leaderboardData[timeframe] = rankedData;

      // Find current user's rank
      this.findUserRank(rankedData);

      return rankedData;
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  // Find user's rank in leaderboard
  findUserRank(leaderboardData) {
    const user = this.authManager.getCurrentUser();
    const isGuest = this.authManager.isGuestUser();

    if (isGuest) {
      // Find by session ID for guests
      const entry = leaderboardData.find(e => e.session_id === this.sessionId);
      this.userRank = entry ? entry.rank : null;
    } else if (user) {
      // Find by user ID for authenticated users
      const entry = leaderboardData.find(e => e.user_id === user.id);
      this.userRank = entry ? entry.rank : null;
    }

    return this.userRank;
  }

  // Get user's position even if not in top 100
  async getUserPosition(timeframe = 'all') {
    if (!window.supabaseClient) return null;

    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      
      // Get user's entry
      let userQuery = window.supabaseClient
        .from('leaderboard_entries')
        .select('*');

      if (isGuest) {
        userQuery = userQuery.eq('session_id', this.sessionId);
      } else if (user) {
        userQuery = userQuery.eq('user_id', user.id);
      } else {
        return null;
      }

      const { data: userEntry, error: userError } = await userQuery.single();
      
      if (userError || !userEntry) return null;

      // Count how many players have higher scores
      let countQuery = window.supabaseClient
        .from('leaderboard_entries')
        .select('id', { count: 'exact', head: true })
        .gt('total_score', userEntry.total_score);

      // Apply timeframe filter
      const now = new Date();
      switch (timeframe) {
        case 'daily':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          countQuery = countQuery.gte('updated_at', today.toISOString());
          break;
        case 'weekly':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          countQuery = countQuery.gte('updated_at', weekStart.toISOString());
          break;
      }

      const { count, error: countError } = await countQuery;

      if (countError) throw countError;

      return {
        rank: (count || 0) + 1,
        entry: userEntry
      };
    } catch (error) {
      console.error('Failed to get user position:', error);
      return null;
    }
  }

  async getLeaderboardStats() {
    if (!window.supabaseClient) {
      console.warn('Supabase not available for stats');
      return {
        totalPlayers: 0,
        totalLevelsCompleted: 0,
        averageScore: 0,
        highestScore: 0
      };
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('leaderboard_entries')
        .select('total_score, levels_completed');

      if (error) {
        console.error('Failed to get leaderboard stats:', error);
        return {
          totalPlayers: 0,
          totalLevelsCompleted: 0,
          averageScore: 0,
          highestScore: 0
        };
      }

      // Handle empty data
      if (!data || data.length === 0) {
        return {
          totalPlayers: 0,
          totalLevelsCompleted: 0,
          averageScore: 0,
          highestScore: 0
        };
      }

      const totalPlayers = data.length;
      const totalLevelsCompleted = data.reduce((sum, e) => sum + (e.levels_completed || 0), 0);
      const averageScore = Math.round(data.reduce((sum, e) => sum + (e.total_score || 0), 0) / totalPlayers);
      const scores = data.map(e => e.total_score || 0).filter(s => s > 0);
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;

      return {
        totalPlayers,
        totalLevelsCompleted,
        averageScore,
        highestScore
      };
    } catch (error) {
      console.error('Failed to get leaderboard stats:', error);
      return {
        totalPlayers: 0,
        totalLevelsCompleted: 0,
        averageScore: 0,
        highestScore: 0
      };
    }
  }

  // Get country from timezone (rough approximation)
  getCountryFromTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const countryMap = {
      'Asia/Dubai': 'AE',
      'Asia/Abu_Dhabi': 'AE',
      'Asia/Riyadh': 'SA',
      'Asia/Kuwait': 'KW',
      'Asia/Doha': 'QA',
      'Asia/Bahrain': 'BH',
      'Asia/Muscat': 'OM',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Asia/Singapore': 'SG',
      'Asia/Hong_Kong': 'HK'
    };
    
    return countryMap[timezone] || 'XX';
  }

  // Format display name for leaderboard
  formatDisplayName(name, isGuest) {
    if (isGuest) {
      return `${name} (Guest)`;
    }
    return name;
  }

  // Get medal emoji based on rank
  getMedalEmoji(rank) {
    switch(rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '';
    }
  }

  // Check if user can submit to leaderboard
  canSubmitToLeaderboard() {
    const totalScore = this.gameManager.getTotalScore();
    const totalCompleted = this.gameManager.getTotalLevelsCompleted();
    
    // Require at least 1 completed level or minimum score
    return totalCompleted > 0 || totalScore > 100;
  }

  // Clear guest data (for privacy)
  async clearGuestData() {
    if (this.authManager.isGuestUser() && window.supabaseClient) {
      try {
        await window.supabaseClient
          .from('user_sessions')
          .delete()
          .eq('session_id', this.sessionId);
        
        localStorage.removeItem('watches_lq_session_id');
        this.sessionId = this.getOrCreateSessionId();
        
        console.log('Guest data cleared');
        return true;
      } catch (error) {
        console.error('Failed to clear guest data:', error);
        return false;
      }
    }
    return false;
  }

  // Convert guest to registered user
  async convertGuestToUser(userId) {
    if (!window.supabaseClient) return false;

    try {
      // Update session
      await window.supabaseClient
        .from('user_sessions')
        .update({
          user_id: userId,
          is_guest: false
        })
        .eq('session_id', this.sessionId);

      // Update leaderboard entry
      await window.supabaseClient
        .from('leaderboard_entries')
        .update({
          user_id: userId,
          is_guest: false
        })
        .eq('session_id', this.sessionId);

      console.log('Guest converted to registered user');
      return true;
    } catch (error) {
      console.error('Failed to convert guest:', error);
      return false;
    }
  }
}
