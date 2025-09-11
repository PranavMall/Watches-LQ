// js/leaderboard.js - Complete Leaderboard Management System
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
        await window.supabaseClient
          .from('user_sessions')
          .insert([{
            user_id: isGuest ? null : user?.id,
            session_id: this.sessionId,
            display_name: this.authManager.getDisplayName(),
            is_guest: isGuest,
            device_info: deviceInfo
          }]);
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

  // Update leaderboard entry
  async updateLeaderboardEntry() {
    if (!window.supabaseClient) {
      console.warn('Supabase not available, skipping leaderboard update');
      return;
    }

    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      const progress = this.gameManager.userProgress;
      
      // Calculate total levels completed across all difficulties
      const easyCompleted = (progress.easy?.completedLevels || []).length;
      const mediumCompleted = (progress.medium?.completedLevels || []).length;
      const hardCompleted = (progress.hard?.completedLevels || []).length;
      const totalCompleted = easyCompleted + mediumCompleted + hardCompleted;

      // Get country code from timezone (rough approximation)
      const countryCode = this.getCountryFromTimezone();

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
        country_code: countryCode
      };

      // Check if entry exists
      const { data: existingEntry } = await window.supabaseClient
        .from('leaderboard_entries')
        .select('*')
        .or(`user_id.eq.${user?.id || 'null'},session_id.eq.${this.sessionId}`)
        .single();

      if (existingEntry) {
        // Update existing entry only if score is higher
        if (entryData.total_score > existingEntry.total_score) {
          await window.supabaseClient
            .from('leaderboard_entries')
            .update({
              ...entryData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingEntry.id);
        }
      } else {
        // Create new entry
        await window.supabaseClient
          .from('leaderboard_entries')
          .insert([entryData]);
      }

      console.log('Leaderboard updated successfully');
    } catch (error) {
      console.error('Failed to update leaderboard:', error);
    }
  }

  // Fetch leaderboard data
  async fetchLeaderboard(timeframe = 'all', limit = 100) {
    if (!window.supabaseClient) {
      console.warn('Supabase not available');
      return [];
    }

    this.isLoading = true;

    try {
      let query = window.supabaseClient
        .from('leaderboard_entries')
        .select('*');

      // Apply timeframe filters
      const now = new Date();
      switch (timeframe) {
        case 'daily':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          query = query.gte('updated_at', today.toISOString());
          break;
        case 'weekly':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          query = query.gte('updated_at', weekAgo.toISOString());
          break;
        // 'all' doesn't need additional filtering
      }

      // Order by score and limit results
      query = query
        .order('total_score', { ascending: false })
        .limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      // Add rank to each entry
      const rankedData = data.map((entry, index) => ({
        ...entry,
        rank: index + 1
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
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          countQuery = countQuery.gte('updated_at', weekAgo.toISOString());
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

  // Get statistics for the leaderboard
  async getLeaderboardStats() {
    if (!window.supabaseClient) return null;

    try {
      const { data, error } = await window.supabaseClient
        .from('leaderboard_entries')
        .select('total_score, levels_completed');

      if (error) throw error;

      const totalPlayers = data.length;
      const totalLevelsCompleted = data.reduce((sum, e) => sum + e.levels_completed, 0);
      const averageScore = Math.round(data.reduce((sum, e) => sum + e.total_score, 0) / totalPlayers);
      const highestScore = Math.max(...data.map(e => e.total_score));

      return {
        totalPlayers,
        totalLevelsCompleted,
        averageScore,
        highestScore
      };
    } catch (error) {
      console.error('Failed to get leaderboard stats:', error);
      return null;
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
          .from('leaderboard_entries')
          .delete()
          .eq('session_id', this.sessionId);
        
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
