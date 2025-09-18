// js/leaderboard.js - Fixed Version for Mobile and Guest Users
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
    this.retryCount = 0;
    this.maxRetries = 3;
    
    // Initialize session tracking
    this.initializeSession();
  }

  // Session Management - Fixed for mobile
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('watches_lq_session_id');
    if (!sessionId) {
      // Create more robust session ID for mobile
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
      localStorage.setItem('watches_lq_session_id', sessionId);
      console.log('Created new session ID:', sessionId);
    }
    return sessionId;
  }

  async initializeSession() {
    if (!window.supabaseClient) {
      console.warn('Supabase not available, using offline mode');
      return { success: false, offline: true };
    }

    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      
      console.log('Initializing session:', { 
        sessionId: this.sessionId, 
        isGuest, 
        userId: user?.id 
      });

      // Get device info for better tracking
      const deviceInfo = this.getDeviceInfo();

      // Check if session exists
      const { data: existingSession, error: sessionError } = await window.supabaseClient
        .from('user_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .maybeSingle(); // Use maybeSingle to avoid errors when no record found

      if (sessionError && sessionError.code !== 'PGRST116') {
        console.error('Session check error:', sessionError);
        throw sessionError;
      }

      const sessionData = {
        user_id: isGuest ? null : user?.id,
        session_id: this.sessionId,
        display_name: this.authManager.getDisplayName(),
        is_guest: isGuest,
        device_info: deviceInfo,
        last_active: new Date().toISOString()
      };

      if (!existingSession) {
        // Create new session
        const { error: insertError } = await window.supabaseClient
          .from('user_sessions')
          .insert([sessionData]);

        if (insertError) {
          console.error('Failed to create session:', insertError);
          throw insertError;
        }
        console.log('Session created successfully');
      } else {
        // Update existing session
        const { error: updateError } = await window.supabaseClient
          .from('user_sessions')
          .update({
            display_name: sessionData.display_name,
            last_active: sessionData.last_active,
            user_id: sessionData.user_id,
            is_guest: sessionData.is_guest
          })
          .eq('session_id', this.sessionId);

        if (updateError) {
          console.error('Failed to update session:', updateError);
        } else {
          console.log('Session updated successfully');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Session initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get comprehensive device info for mobile tracking
  getDeviceInfo() {
    const nav = navigator;
    return {
      userAgent: nav.userAgent,
      platform: nav.platform,
      language: nav.language,
      languages: nav.languages,
      screenResolution: `${screen.width}x${screen.height}`,
      screenAvailSize: `${screen.availWidth}x${screen.availHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: nav.cookieEnabled,
      onLine: nav.onLine,
      deviceMemory: nav.deviceMemory || 'unknown',
      hardwareConcurrency: nav.hardwareConcurrency || 'unknown',
      maxTouchPoints: nav.maxTouchPoints || 0,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent),
      isIOS: /iPad|iPhone|iPod/.test(nav.userAgent) && !window.MSStream,
      isAndroid: /Android/i.test(nav.userAgent),
      timestamp: new Date().toISOString()
    };
  }

  // Enhanced leaderboard update with retry logic
  async updateLeaderboardEntry() {
    if (!window.supabaseClient) {
      console.warn('Supabase not available, storing locally');
      this.storeLeaderboardLocally();
      return { success: false, offline: true };
    }

    // Reset retry count for new update
    this.retryCount = 0;
    return await this.attemptLeaderboardUpdate();
  }

  async attemptLeaderboardUpdate() {
    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      const progress = this.gameManager.userProgress;
      
      console.log('Updating leaderboard entry:', { 
        sessionId: this.sessionId, 
        isGuest, 
        userId: user?.id,
        totalScore: this.gameManager.getTotalScore()
      });

      // Ensure session exists first
      await this.ensureSessionExists();
      
      // Calculate stats
      const easyCompleted = (progress.easy?.completedLevels || []).length;
      const mediumCompleted = (progress.medium?.completedLevels || []).length;
      const hardCompleted = (progress.hard?.completedLevels || []).length;
      const totalCompleted = easyCompleted + mediumCompleted + hardCompleted;
      const totalScore = this.gameManager.getTotalScore();

      // Get or create leaderboard entry
      let existingEntry = null;
      
      // First, try to find existing entry
      if (isGuest) {
        const { data } = await window.supabaseClient
          .from('leaderboard_entries')
          .select('*')
          .eq('session_id', this.sessionId)
          .maybeSingle();
        existingEntry = data;
      } else if (user?.id) {
        const { data } = await window.supabaseClient
          .from('leaderboard_entries')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        existingEntry = data;
      }

      const entryData = {
        user_id: isGuest ? null : user?.id,
        session_id: this.sessionId,
        display_name: this.authManager.getDisplayName(),
        total_score: totalScore,
        levels_completed: totalCompleted,
        easy_completed: easyCompleted,
        medium_completed: mediumCompleted,
        hard_completed: hardCompleted,
        total_time_played: this.calculateTotalTimePlayed(),
        perfect_completions: this.calculatePerfectCompletions(),
        hints_used: this.calculateTotalHintsUsed(),
        is_guest: isGuest,
        country_code: this.getCountryFromTimezone(),
        updated_at: new Date().toISOString()
      };

      let result;
      if (existingEntry) {
        // Update existing entry only if score improved or stats changed
        if (totalScore >= existingEntry.total_score || 
            totalCompleted > existingEntry.levels_completed) {
          
          const { error } = await window.supabaseClient
            .from('leaderboard_entries')
            .update(entryData)
            .eq('id', existingEntry.id);

          if (error) throw error;
          result = { success: true, action: 'updated' };
        } else {
          result = { success: true, action: 'no_change' };
        }
      } else {
        // Insert new entry
        const { error } = await window.supabaseClient
          .from('leaderboard_entries')
          .insert([entryData]);

        if (error) throw error;
        result = { success: true, action: 'created' };
      }

      console.log('Leaderboard entry updated:', result);
      return result;

    } catch (error) {
      console.error('Leaderboard update error:', error);
      
      // Retry logic for mobile network issues
      if (this.retryCount < this.maxRetries && this.isRetryableError(error)) {
        this.retryCount++;
        console.log(`Retrying leaderboard update (${this.retryCount}/${this.maxRetries})`);
        
        // Exponential backoff
        const delay = Math.pow(2, this.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return await this.attemptLeaderboardUpdate();
      }

      // Store locally if all retries failed
      this.storeLeaderboardLocally();
      return { success: false, error: error.message, stored_locally: true };
    }
  }

  // Check if error is retryable (network issues, timeouts, etc.)
  isRetryableError(error) {
    const retryableErrors = [
      'fetch',
      'network',
      'timeout',
      'connection',
      'ECONNRESET',
      'ETIMEDOUT'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  // Store leaderboard data locally when offline
  storeLeaderboardLocally() {
    try {
      const localData = {
        sessionId: this.sessionId,
        userId: this.authManager.getCurrentUser()?.id,
        isGuest: this.authManager.isGuestUser(),
        displayName: this.authManager.getDisplayName(),
        totalScore: this.gameManager.getTotalScore(),
        progress: this.gameManager.userProgress,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem('watches_lq_pending_leaderboard', JSON.stringify(localData));
      console.log('Leaderboard data stored locally for later sync');
    } catch (error) {
      console.error('Failed to store leaderboard locally:', error);
    }
  }

  // Sync local leaderboard data when connection is restored
  async syncLocalLeaderboardData() {
    const pendingData = localStorage.getItem('watches_lq_pending_leaderboard');
    if (!pendingData || !window.supabaseClient) return;

    try {
      const data = JSON.parse(pendingData);
      console.log('Syncing local leaderboard data:', data);

      // Update with current data and sync
      await this.updateLeaderboardEntry();
      
      // Remove pending data after successful sync
      localStorage.removeItem('watches_lq_pending_leaderboard');
      console.log('Local leaderboard data synced successfully');
    } catch (error) {
      console.error('Failed to sync local leaderboard data:', error);
    }
  }

  // Calculate additional stats for better leaderboard
  calculateTotalTimePlayed() {
    // This would need to be tracked in game manager
    return 0; // Placeholder
  }

  calculatePerfectCompletions() {
    let perfect = 0;
    Object.values(this.gameManager.userProgress).forEach(progress => {
      if (progress.scores) {
        perfect += progress.scores.filter(score => score >= 100).length;
      }
    });
    return perfect;
  }

  calculateTotalHintsUsed() {
    // This would need to be tracked in game manager
    return 0; // Placeholder
  }

  // Enhanced session existence check
  async ensureSessionExists() {
    try {
      const { data: session, error } = await window.supabaseClient
        .from('user_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!session) {
        console.log('Session not found, creating new one');
        await this.initializeSession();
      }
    } catch (error) {
      console.error('Error ensuring session exists:', error);
      throw error;
    }
  }

  // Enhanced leaderboard fetching with mobile optimization
  async fetchLeaderboard(timeframe = 'all', limit = 100) {
    if (!window.supabaseClient) {
      console.warn('Supabase not available, returning cached data');
      return this.getCachedLeaderboard(timeframe);
    }

    this.isLoading = true;

    try {
      let query;
      const now = new Date();
      
      // Build query based on timeframe
      query = window.supabaseClient
        .from('leaderboard_entries')
        .select('*')
        .order('total_score', { ascending: false })
        .order('levels_completed', { ascending: false })
        .order('updated_at', { ascending: true }) // Earlier completion wins ties
        .limit(limit);

      // Apply timeframe filters
      switch (timeframe) {
        case 'daily':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          query = query.gte('updated_at', today.toISOString());
          break;
        case 'weekly':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          query = query.gte('updated_at', weekStart.toISOString());
          break;
        // 'all' doesn't need additional filters
      }

      const { data, error } = await query;

      if (error) {
        console.error('Leaderboard fetch error:', error);
        throw error;
      }

      // Add rank and process data
      const rankedData = (data || []).map((entry, index) => ({
        ...entry,
        rank: index + 1,
        display_name: entry.display_name || 'Anonymous',
        is_current_user: this.isCurrentUser(entry)
      }));

      // Cache the data
      this.leaderboardData[timeframe] = rankedData;
      this.cacheLeaderboard(timeframe, rankedData);

      // Find current user's rank
      this.findUserRank(rankedData);

      console.log(`Fetched ${rankedData.length} leaderboard entries for ${timeframe}`);
      return rankedData;

    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      
      // Return cached data on error
      const cachedData = this.getCachedLeaderboard(timeframe);
      if (cachedData.length > 0) {
        console.log('Returning cached leaderboard data');
        return cachedData;
      }
      
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  // Check if entry belongs to current user
  isCurrentUser(entry) {
    const user = this.authManager.getCurrentUser();
    const isGuest = this.authManager.isGuestUser();

    if (isGuest) {
      return entry.session_id === this.sessionId;
    } else if (user?.id) {
      return entry.user_id === user.id;
    }
    
    return false;
  }

  // Cache leaderboard data for offline use
  cacheLeaderboard(timeframe, data) {
    try {
      const cacheKey = `watches_lq_leaderboard_${timeframe}`;
      const cacheData = {
        data: data,
        timestamp: new Date().toISOString(),
        timeframe: timeframe
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to cache leaderboard:', error);
    }
  }

  // Get cached leaderboard data
  getCachedLeaderboard(timeframe) {
    try {
      const cacheKey = `watches_lq_leaderboard_${timeframe}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
        
        // Use cached data if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          console.log(`Using cached leaderboard data for ${timeframe}`);
          return cacheData.data || [];
        }
      }
    } catch (error) {
      console.error('Failed to get cached leaderboard:', error);
    }
    
    return [];
  }

  // Find user's rank in leaderboard data
  findUserRank(leaderboardData) {
    const user = this.authManager.getCurrentUser();
    const isGuest = this.authManager.isGuestUser();

    let userEntry = null;

    if (isGuest) {
      userEntry = leaderboardData.find(e => e.session_id === this.sessionId);
    } else if (user?.id) {
      userEntry = leaderboardData.find(e => e.user_id === user.id);
    }

    this.userRank = userEntry ? userEntry.rank : null;
    return this.userRank;
  }

  // Get user's position with enhanced mobile support
  async getUserPosition(timeframe = 'all') {
    if (!window.supabaseClient) {
      return this.getCachedUserPosition(timeframe);
    }

    try {
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      
      // Get user's entry
      let userQuery = window.supabaseClient
        .from('leaderboard_entries')
        .select('*');

      if (isGuest) {
        userQuery = userQuery.eq('session_id', this.sessionId);
      } else if (user?.id) {
        userQuery = userQuery.eq('user_id', user.id);
      } else {
        return null;
      }

      const { data: userEntry, error: userError } = await userQuery.maybeSingle();
      
      if (userError || !userEntry) {
        console.log('User entry not found in leaderboard');
        return null;
      }

      // Count players with higher scores
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

      if (countError) {
        console.error('Error counting higher scores:', countError);
        throw countError;
      }

      const position = {
        rank: (count || 0) + 1,
        entry: userEntry
      };

      // Cache the position
      this.cacheUserPosition(timeframe, position);

      return position;
    } catch (error) {
      console.error('Failed to get user position:', error);
      return this.getCachedUserPosition(timeframe);
    }
  }

  // Cache user position
  cacheUserPosition(timeframe, position) {
    try {
      const cacheKey = `watches_lq_user_position_${timeframe}`;
      const cacheData = {
        position: position,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to cache user position:', error);
    }
  }

  // Get cached user position
  getCachedUserPosition(timeframe) {
    try {
      const cacheKey = `watches_lq_user_position_${timeframe}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
        
        // Use cached data if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          return cacheData.position;
        }
      }
    } catch (error) {
      console.error('Failed to get cached user position:', error);
    }
    
    return null;
  }

  // Enhanced leaderboard stats with caching
  async getLeaderboardStats() {
    if (!window.supabaseClient) {
      return this.getCachedStats();
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('leaderboard_entries')
        .select('total_score, levels_completed, is_guest');

      if (error) {
        console.error('Failed to get leaderboard stats:', error);
        return this.getCachedStats();
      }

      if (!data || data.length === 0) {
        return {
          totalPlayers: 0,
          totalGuests: 0,
          totalRegistered: 0,
          averageScore: 0,
          highestScore: 0,
          totalLevelsCompleted: 0
        };
      }

      const totalPlayers = data.length;
      const totalGuests = data.filter(e => e.is_guest).length;
      const totalRegistered = totalPlayers - totalGuests;
      const totalLevelsCompleted = data.reduce((sum, e) => sum + (e.levels_completed || 0), 0);
      const averageScore = Math.round(data.reduce((sum, e) => sum + (e.total_score || 0), 0) / totalPlayers);
      const scores = data.map(e => e.total_score || 0).filter(s => s > 0);
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;

      const stats = {
        totalPlayers,
        totalGuests,
        totalRegistered,
        averageScore,
        highestScore,
        totalLevelsCompleted
      };

      // Cache the stats
      this.cacheStats(stats);

      return stats;
    } catch (error) {
      console.error('Failed to get leaderboard stats:', error);
      return this.getCachedStats();
    }
  }

  // Cache stats
  cacheStats(stats) {
    try {
      const cacheData = {
        stats: stats,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('watches_lq_leaderboard_stats', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to cache stats:', error);
    }
  }

  // Get cached stats
  getCachedStats() {
    try {
      const cached = localStorage.getItem('watches_lq_leaderboard_stats');
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
        
        // Use cached data if less than 10 minutes old
        if (cacheAge < 10 * 60 * 1000) {
          return cacheData.stats;
        }
      }
    } catch (error) {
      console.error('Failed to get cached stats:', error);
    }
    
    return {
      totalPlayers: 0,
      totalGuests: 0,
      totalRegistered: 0,
      averageScore: 0,
      highestScore: 0,
      totalLevelsCompleted: 0
    };
  }

  // Enhanced guest to user conversion
  async convertGuestToUser(userId) {
    if (!window.supabaseClient) {
      console.warn('Cannot convert guest to user - Supabase not available');
      return false;
    }

    try {
      console.log('Converting guest to registered user:', { sessionId: this.sessionId, userId });

      // Start a transaction-like operation
      const updates = [];

      // Update session
      updates.push(
        window.supabaseClient
          .from('user_sessions')
          .update({
            user_id: userId,
            is_guest: false,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', this.sessionId)
      );

      // Update leaderboard entry
      updates.push(
        window.supabaseClient
          .from('leaderboard_entries')
          .update({
            user_id: userId,
            is_guest: false,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', this.sessionId)
      );

      // Execute all updates
      const results = await Promise.all(updates);
      
      // Check for errors
      for (const result of results) {
        if (result.error) {
          console.error('Conversion error:', result.error);
          throw result.error;
        }
      }

      // Clear cached data to force refresh
      this.clearLeaderboardCache();

      console.log('Guest successfully converted to registered user');
      return true;
    } catch (error) {
      console.error('Failed to convert guest to user:', error);
      return false;
    }
  }

  // Clear all leaderboard cache
  clearLeaderboardCache() {
    const keys = [
      'watches_lq_leaderboard_all',
      'watches_lq_leaderboard_weekly',
      'watches_lq_leaderboard_daily',
      'watches_lq_user_position_all',
      'watches_lq_user_position_weekly',
      'watches_lq_user_position_daily',
      'watches_lq_leaderboard_stats'
    ];

    keys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove cache key ${key}:`, error);
      }
    });

    console.log('Leaderboard cache cleared');
  }

  // Get country from timezone with better mapping
  getCountryFromTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const countryMap = {
      // Middle East
      'Asia/Dubai': 'AE',
      'Asia/Abu_Dhabi': 'AE',
      'Asia/Riyadh': 'SA',
      'Asia/Kuwait': 'KW',
      'Asia/Qatar': 'QA',
      'Asia/Bahrain': 'BH',
      'Asia/Muscat': 'OM',
      
      // Europe
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT',
      'Europe/Madrid': 'ES',
      'Europe/Amsterdam': 'NL',
      'Europe/Zurich': 'CH',
      
      // Americas
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      
      // Asia Pacific
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Asia/Singapore': 'SG',
      'Asia/Hong_Kong': 'HK',
      'Asia/Seoul': 'KR',
      'Asia/Mumbai': 'IN',
      'Asia/Bangkok': 'TH',
      'Australia/Sydney': 'AU',
      'Australia/Melbourne': 'AU'
    };
    
    return countryMap[timezone] || 'XX';
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
    
    // Allow submission if user has played at least one level or has non-default score
    return totalCompleted > 0 || totalScore !== 100;
  }

  // Network status monitoring for mobile
  setupNetworkMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Network connection restored');
        this.syncLocalLeaderboardData();
      });

      window.addEventListener('offline', () => {
        console.log('Network connection lost');
      });
    }
  }

  // Initialize network monitoring
  init() {
    this.setupNetworkMonitoring();
    
    // Try to sync any pending data on initialization
    if (navigator.onLine) {
      setTimeout(() => {
        this.syncLocalLeaderboardData();
      }, 1000);
    }
  }
}