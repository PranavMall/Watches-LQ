// js/app.js - Complete Version with Leaderboard Integration
class App {
  constructor() {
    this.authManager = null;
    this.gameManager = null;
    this.leaderboardManager = null;
    this.currentScreen = 'loading';
    this.isInitialized = false;
    this.currentDifficultyView = null;
    
    // iOS detection
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    this.init();
  }

// Replace your app.js init() method with this simpler version

async init() {
    try {
      console.log('App init started...');
      
      this.updateLoadingStatus('Initializing...');
      
      // Just check if client exists (config.js creates it)
      console.log('Checking Supabase client...');
      console.log('window.supabaseClient:', window.supabaseClient);
      
      if (!window.supabaseClient) {
        console.warn('Supabase client not available, continuing in offline mode');
      } else {
        console.log('✅ Supabase client is available!');
      }

      this.updateLoadingStatus('Loading game managers...');

      // Initialize managers
      this.authManager = new AuthManager();
      this.gameManager = new GameManager(this.authManager);
      this.leaderboardManager = new LeaderboardManager(this.authManager, this.gameManager);

      this.updateLoadingStatus('Loading game data...');

      // Load game data
      try {
        await Promise.race([
          this.gameManager.loadGameData(),
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
      } catch (error) {
        console.warn('Error loading game data, using defaults:', error);
      }

      this.setupEventListeners();
      this.updateLoadingStatus('Ready to play!');
      this.isInitialized = true;

      // Show start screen
      setTimeout(() => {
        console.log('Showing start screen...');
        console.log('Final Supabase check:', window.supabaseClient ? '✅ Available' : '❌ Not available');
        this.showScreen('start');
      }, 1000);

    } catch (error) {
      console.error('Critical app initialization error:', error);
      this.handleInitError(error);
    }
  }

  updateLoadingStatus(message) {
    const statusElement = document.getElementById('loading-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log('Status:', message);
  }

  handleInitError(error) {
    console.error('Initialization failed:', error);
    
    this.updateLoadingStatus('Starting in offline mode...');
    
    if (!this.authManager) {
      this.authManager = new AuthManager();
    }
    if (!this.gameManager) {
      this.gameManager = new GameManager(this.authManager);
    }
    if (!this.leaderboardManager) {
      this.leaderboardManager = new LeaderboardManager(this.authManager, this.gameManager);
    }
    
    this.setupEventListeners();
    
    setTimeout(() => {
      this.showScreen('start');
    }, 1000);
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Auth events
    const playAsGuestBtn = document.getElementById('play-as-guest');
    if (playAsGuestBtn) {
      playAsGuestBtn.addEventListener('click', () => this.handleGuestPlay());
    }

    const showLoginBtn = document.getElementById('show-login');
    if (showLoginBtn) {
      showLoginBtn.addEventListener('click', () => this.showAuthForms());
    }

    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => this.handleRegister());
    }

    const showRegisterLink = document.getElementById('show-register');
    if (showRegisterLink) {
      showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showRegisterForm();
      });
    }

    const showLoginLink = document.getElementById('show-login-link');
    if (showLoginLink) {
      showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showLoginForm();
      });
    }

    const backToGuestBtn = document.getElementById('back-to-guest');
    if (backToGuestBtn) {
      backToGuestBtn.addEventListener('click', () => this.hideAuthForms());
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Difficulty selection events
    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.addEventListener('click', () => {
        const difficulty = card.dataset.level;
        this.handleDifficultySelect(difficulty);
      });
    });

    // Level grid back button
    const backFromGridBtn = document.getElementById('back-from-grid');
    if (backFromGridBtn) {
      backFromGridBtn.addEventListener('click', () => this.showLevelSelect());
    }

    // Game screen back buttons
    const backToLevelsBtn = document.getElementById('back-to-levels');
    if (backToLevelsBtn) {
      backToLevelsBtn.addEventListener('click', () => {
        if (this.gameManager) {
          this.gameManager.stopTimer();
        }
        this.showLevelGrid(this.currentDifficultyView);
      });
    }
    
    // Reset game listeners
    const resetGameBtn = document.getElementById('reset-game-btn');
    if (resetGameBtn) {
      resetGameBtn.addEventListener('click', () => this.showResetConfirmation());
    }
    
    const confirmResetBtn = document.getElementById('confirm-reset-btn');
    if (confirmResetBtn) {
      confirmResetBtn.addEventListener('click', () => this.handleResetGame());
    }
    
    const cancelResetBtn = document.getElementById('cancel-reset-btn');
    if (cancelResetBtn) {
      cancelResetBtn.addEventListener('click', () => this.hideResetConfirmation());
    }
    
    // Close modal on background click
    const resetModal = document.getElementById('reset-confirmation-modal');
    if (resetModal) {
      resetModal.addEventListener('click', (e) => {
        if (e.target === resetModal) {
          this.hideResetConfirmation();
        }
      });
    }

    const backToLevelsCompleteBtn = document.getElementById('back-to-levels-complete');
    if (backToLevelsCompleteBtn) {
      backToLevelsCompleteBtn.addEventListener('click', () => this.showLevelGrid(this.currentDifficultyView));
    }

    // Game action events
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => this.handleHint());
    }

    const revealBtn = document.getElementById('reveal-btn');
    if (revealBtn) {
      revealBtn.addEventListener('click', () => this.handleReveal());
    }

    const nextLevelBtn = document.getElementById('next-level-btn');
    if (nextLevelBtn) {
      nextLevelBtn.addEventListener('click', () => this.handleNextLevel());
    }

    // Leaderboard navigation listeners
    const showLeaderboardBtn = document.getElementById('show-leaderboard');
    if (showLeaderboardBtn) {
      showLeaderboardBtn.addEventListener('click', () => this.showLeaderboard());
    }
    
    const backFromLeaderboardBtn = document.getElementById('back-from-leaderboard');
    if (backFromLeaderboardBtn) {
      backFromLeaderboardBtn.addEventListener('click', () => this.showLevelSelect());
    }
    
    // Leaderboard tabs
    document.querySelectorAll('.leaderboard-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const timeframe = tab.dataset.timeframe;
        this.switchLeaderboardTimeframe(timeframe);
      });
    });
    
    // Refresh leaderboard button
    const refreshBtn = document.getElementById('refresh-leaderboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshLeaderboard());
    }
    
    // Share rank button
    const shareBtn = document.getElementById('share-rank');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareRank());
    }
    
    // Register from leaderboard
    const registerLink = document.getElementById('register-from-leaderboard');
    if (registerLink) {
      registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showRegisterFromLeaderboard();
      });
    }

    // Game over listeners
    this.setupGameOverListeners();
  }

  showScreen(screenId) {
    console.log('Showing screen:', screenId);
    
    // Clean up any running timers when switching screens
    if (this.gameManager && screenId !== 'game') {
      this.gameManager.stopTimer();
    }
    
    // iOS-specific screen switching
    if (this.isIOS) {
      // Force layout recalculation on iOS
      document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
        screen.classList.remove('active');
      });

      const targetScreen = document.getElementById(`${screenId}-screen`);
      if (targetScreen) {
        // Force a reflow/repaint on iOS
        targetScreen.style.display = 'block';
        targetScreen.offsetHeight; // Force reflow
        
        // Use RAF for smoother transition on iOS
        requestAnimationFrame(() => {
          targetScreen.classList.add('active');
          this.currentScreen = screenId;

          if (screenId === 'level-select') {
            this.updateLevelSelect();
          } else if (screenId === 'level-grid') {
            this.updateLevelGrid();
          }
          
          // Scroll to top on iOS
          if (this.isIOS) {
            window.scrollTo(0, 0);
            targetScreen.scrollTop = 0;
          }
        });
      } else {
        console.error('Screen not found:', screenId);
      }
    } else {
      // Standard screen switching for non-iOS
      document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
      });

      const targetScreen = document.getElementById(`${screenId}-screen`);
      if (targetScreen) {
        setTimeout(() => {
          targetScreen.classList.add('active');
          this.currentScreen = screenId;

          if (screenId === 'level-select') {
            this.updateLevelSelect();
          } else if (screenId === 'level-grid') {
            this.updateLevelGrid();
          }
        }, 10);
      }
    }
  }

  showResetConfirmation() {
    const modal = document.getElementById('reset-confirmation-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('visible');
    }
  }

  hideResetConfirmation() {
    const modal = document.getElementById('reset-confirmation-modal');
    if (modal) {
      modal.classList.remove('visible');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 300);
    }
  }

  async handleResetGame() {
    console.log('Handling game reset...');
    
    // Show loading state
    const confirmBtn = document.getElementById('confirm-reset-btn');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Resetting...';
    confirmBtn.disabled = true;
    
    try {
      // Reset the game
      const result = await this.gameManager.resetGameProgress();
      
      if (result.success) {
        // Hide modal
        this.hideResetConfirmation();
        
        // Show success message
        this.showMessage(result.message);
        
        // Refresh the level select screen
        setTimeout(() => {
          this.updateLevelSelect();
        }, 100);
      } else {
        this.showError('Failed to reset game. Please try again.');
      }
    } catch (error) {
      console.error('Reset error:', error);
      this.showError('An error occurred while resetting the game.');
    } finally {
      // Restore button state
      confirmBtn.textContent = originalText;
      confirmBtn.disabled = false;
    }
  }

  showAuthForms() {
    document.getElementById('guest-section').classList.add('hidden');
    document.getElementById('auth-forms').classList.remove('hidden');
  }

  hideAuthForms() {
    document.getElementById('guest-section').classList.remove('hidden');
    document.getElementById('auth-forms').classList.add('hidden');
  }

  showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  }

  showRegisterForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  }

  async handleGuestPlay() {
    console.log('Playing as guest...');
    const result = await this.authManager.playAsGuest();
    if (result.success) {
      // Initialize guest session in leaderboard
      if (this.leaderboardManager) {
        await this.leaderboardManager.initializeSession();
      }
      this.showScreen('level-select');
    }
  }

  async handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    const result = await this.authManager.loginWithEmail(email, password);
    
    if (result.success) {
      // Initialize user session in leaderboard
      if (this.leaderboardManager) {
        await this.leaderboardManager.initializeSession();
      }
      this.showScreen('level-select');
    } else {
      this.showError(result.error || 'Login failed');
    }
  }

  async handleRegister() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (!name || !email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    const result = await this.authManager.registerWithEmail(email, password, name);
    
    if (result.success) {
      // Check for guest progress
      const guestProgressStr = localStorage.getItem('watches_lq_guest_progress');
      if (guestProgressStr) {
        try {
          const guestProgress = JSON.parse(guestProgressStr);
          
          // Merge guest progress with new user
          this.gameManager.userProgress = guestProgress.progress;
          this.gameManager.totalScore = guestProgress.score;
          await this.gameManager.saveProgress();
          
          // Convert guest leaderboard entry to user
          if (this.leaderboardManager && result.user) {
            await this.leaderboardManager.convertGuestToUser(result.user.id);
          }
          
          localStorage.removeItem('watches_lq_guest_progress');
          
          this.showMessage('Account created! Your guest progress has been saved.');
        } catch (error) {
          console.error('Failed to transfer guest progress:', error);
        }
      }
      
      if (result.requiresConfirmation) {
        this.showMessage('Please check your email to confirm your account');
      } else {
        this.showScreen('level-select');
      }
    } else {
      this.showError(result.error || 'Registration failed');
    }
  }

  async handleLogout() {
    const result = await this.authManager.logout();
    if (result.success) {
      this.showScreen('start');
    }
  }

  updateLevelSelect() {
    const userName = this.authManager.getDisplayName();
    const totalScore = this.gameManager.getTotalScore();

    document.getElementById('user-name').textContent = userName;
    document.getElementById('total-score').textContent = `${totalScore} pts`;

    ['easy', 'medium', 'hard'].forEach(difficulty => {
      const card = document.querySelector(`.difficulty-card[data-level="${difficulty}"]`);
      if (!card) return;
      
      const progress = this.gameManager.getDifficultyProgress(difficulty);
      const isUnlocked = this.gameManager.isDifficultyUnlocked(difficulty);
      const totalLevels = this.gameManager.gameData[difficulty]?.length || 10;
      const completedCount = (progress.completedLevels || []).length;

      const completedElement = card.querySelector('.completed');
      if (completedElement) {
        completedElement.textContent = `${completedCount}/${totalLevels}`;
      }

      const statusElement = card.querySelector('.status');
      if (isUnlocked) {
        card.classList.remove('locked');
        if (statusElement) {
          if (completedCount === totalLevels) {
            statusElement.textContent = '✅ All Completed!';
            statusElement.style.color = 'var(--success)';
          } else {
            statusElement.textContent = 'Available';
          }
        }
      } else {
        card.classList.add('locked');
        if (statusElement) {
          const requiredDifficulty = difficulty === 'medium' ? 'Easy' : 'Medium';
          const required = GAME_CONFIG.unlockRequirement[difficulty] || 2;
          statusElement.textContent = `Complete ${required} ${requiredDifficulty} levels`;
        }
      }
    });

    // Update leaderboard preview
    this.updateLeaderboardPreview();
  }

  async updateLeaderboardPreview() {
    if (!this.leaderboardManager) return;
    
    try {
      // Fetch top 5 for preview
      const topPlayers = await this.leaderboardManager.fetchLeaderboard('all', 5);
      
      const previewContainer = document.getElementById('leaderboard-preview');
      if (!previewContainer) return;
      
      if (topPlayers.length === 0) {
        previewContainer.innerHTML = `
          <div class="leaderboard-preview-header">
            <h3>🏆 Leaderboard</h3>
          </div>
          <div class="empty-state" style="padding: 2rem;">
            <p style="color: var(--text-secondary);">No rankings yet. Be the first!</p>
          </div>
        `;
      } else {
        previewContainer.innerHTML = `
          <div class="leaderboard-preview-header">
            <h3>🏆 Top Players</h3>
            <button class="btn btn-text" onclick="window.app.showLeaderboard()">View All →</button>
          </div>
          <div class="preview-list">
            ${topPlayers.map(entry => `
              <div class="preview-entry">
                <span class="rank">${this.leaderboardManager.getMedalEmoji(entry.rank)} ${entry.rank}</span>
                <span class="name">${entry.display_name}${entry.is_guest ? ' (Guest)' : ''}</span>
                <span class="score">${entry.total_score} pts</span>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to update leaderboard preview:', error);
    }
  }

  async showLeaderboard() {
    this.showScreen('leaderboard');
    
    // Show loading state
    document.getElementById('leaderboard-loading').classList.remove('hidden');
    document.getElementById('leaderboard-list').innerHTML = '';
    document.getElementById('leaderboard-empty').classList.add('hidden');
    
    // Update user score in header
    const userScore = this.gameManager.getTotalScore();
    document.getElementById('leaderboard-user-score').textContent = `${userScore} pts`;
    
    // Show guest notice if applicable
    const guestNotice = document.getElementById('guest-notice');
    if (this.authManager.isGuestUser()) {
      guestNotice.classList.remove('hidden');
    } else {
      guestNotice.classList.add('hidden');
    }
    
    // Load leaderboard data
    await this.loadLeaderboardData('all');
    
    // Update stats
    await this.updateLeaderboardStats();
  }

  async loadLeaderboardData(timeframe) {
    if (!this.leaderboardManager) return;
    
    try {
      // Update active tab
      document.querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.timeframe === timeframe) {
          tab.classList.add('active');
        }
      });
      
      // Fetch leaderboard
      const entries = await this.leaderboardManager.fetchLeaderboard(timeframe, 100);
      
      // Hide loading
      document.getElementById('leaderboard-loading').classList.add('hidden');
      
      if (entries.length === 0) {
        document.getElementById('leaderboard-empty').classList.remove('hidden');
        document.getElementById('leaderboard-list').innerHTML = '';
        return;
      }
      
      // Get current user info
      const user = this.authManager.getCurrentUser();
      const isGuest = this.authManager.isGuestUser();
      const sessionId = this.leaderboardManager.sessionId;
      
      // Display entries
      const listContainer = document.getElementById('leaderboard-list');
      listContainer.innerHTML = entries.map(entry => {
        const isCurrentUser = (isGuest && entry.session_id === sessionId) || 
                             (!isGuest && user && entry.user_id === user.id);
        
        return `
          <div class="leaderboard-entry ${isCurrentUser ? 'current-user' : ''}">
            <div class="entry-rank ${entry.rank <= 3 ? 'top-three' : ''}">
              ${entry.rank <= 3 ? `<span class="entry-medal">${this.leaderboardManager.getMedalEmoji(entry.rank)}</span>` : entry.rank}
            </div>
            <div class="entry-info">
              <div class="entry-name">
                ${entry.display_name}
                ${entry.is_guest ? '<span class="guest-badge">Guest</span>' : ''}
                ${isCurrentUser ? '<span style="color: var(--primary-color); margin-left: 0.5rem;">← You</span>' : ''}
              </div>
              <div class="entry-details">
                ${entry.levels_completed} levels • 
                Easy: ${entry.easy_completed || 0} • 
                Medium: ${entry.medium_completed || 0} • 
                Hard: ${entry.hard_completed || 0}
              </div>
            </div>
            <div class="entry-score">
              <div class="entry-score-value">${entry.total_score}</div>
              <div class="entry-score-label">Points</div>
            </div>
          </div>
        `;
      }).join('');
      
      // Update user position card
      await this.updateUserPosition(timeframe);
      
      // Show share button if user has a rank
      if (this.leaderboardManager.userRank) {
        document.getElementById('share-rank').classList.remove('hidden');
      } else {
        document.getElementById('share-rank').classList.add('hidden');
      }
      
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      document.getElementById('leaderboard-loading').classList.add('hidden');
      this.showError('Failed to load leaderboard. Please try again.');
    }
  }

  async updateUserPosition(timeframe) {
    const position = await this.leaderboardManager.getUserPosition(timeframe);
    
    if (position) {
      const positionCard = document.getElementById('user-position-card');
      positionCard.classList.remove('hidden');
      
      document.getElementById('user-rank-number').textContent = position.rank;
      document.getElementById('user-medal').textContent = 
        position.rank <= 3 ? this.leaderboardManager.getMedalEmoji(position.rank) : '';
      document.getElementById('user-lb-score').textContent = position.entry.total_score;
      document.getElementById('user-lb-levels').textContent = position.entry.levels_completed;
    } else {
      document.getElementById('user-position-card').classList.add('hidden');
    }
  }

  async updateLeaderboardStats() {
    const stats = await this.leaderboardManager.getLeaderboardStats();
    
    if (stats) {
      document.getElementById('total-players').textContent = stats.totalPlayers || 0;
      document.getElementById('avg-score').textContent = stats.averageScore || 0;
      document.getElementById('top-score').textContent = stats.highestScore || 0;
    }
  }

  switchLeaderboardTimeframe(timeframe) {
    this.loadLeaderboardData(timeframe);
  }

  async refreshLeaderboard() {
    const activeTab = document.querySelector('.leaderboard-tab.active');
    const timeframe = activeTab ? activeTab.dataset.timeframe : 'all';
    
    // Show loading state
    document.getElementById('leaderboard-loading').classList.remove('hidden');
    document.getElementById('leaderboard-list').innerHTML = '';
    
    // Reload data
    await this.loadLeaderboardData(timeframe);
    await this.updateLeaderboardStats();
    
    this.showMessage('Leaderboard refreshed!');
  }

  shareRank() {
    const rank = this.leaderboardManager.userRank;
    const score = this.gameManager.getTotalScore();
    const totalLevels = this.gameManager.getTotalLevelsCompleted();
    
    const shareText = `🏆 I'm ranked #${rank} in Dubai Watch Week Logo Quiz! Score: ${score} pts | Levels: ${totalLevels} completed. Can you beat my score?`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Dubai Watch Week Logo Quiz',
        text: shareText,
        url: window.location.href
      }).catch(err => console.log('Share cancelled'));
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(shareText).then(() => {
        this.showMessage('Rank copied to clipboard!');
      }).catch(() => {
        this.showError('Could not copy to clipboard');
      });
    }
  }

  showRegisterFromLeaderboard() {
    // Store current guest progress
    const guestProgress = {
      score: this.gameManager.getTotalScore(),
      levels: this.gameManager.getTotalLevelsCompleted(),
      progress: this.gameManager.userProgress
    };
    
    localStorage.setItem('watches_lq_guest_progress', JSON.stringify(guestProgress));
    
    // Show registration form
    this.showScreen('start');
    this.showAuthForms();
    this.showRegisterForm();
    
    // Add message about preserving progress
    const registerForm = document.getElementById('register-form');
    if (registerForm && !document.getElementById('progress-notice')) {
      const notice = document.createElement('div');
      notice.id = 'progress-notice';
      notice.className = 'alert alert-info';
      notice.innerHTML = `
        <strong>🎯 Your progress will be saved!</strong><br>
        Score: ${guestProgress.score} pts | Levels: ${guestProgress.levels}
      `;
      notice.style.cssText = `
        background: #d1ecf1;
        border: 1px solid #bee5eb;
        color: #0c5460;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 1rem;
      `;
      registerForm.insertBefore(notice, registerForm.firstChild);
    }
  }

  handleDifficultySelect(difficulty) {
    if (!this.gameManager.isDifficultyUnlocked(difficulty)) {
      this.showError(`Complete more levels to unlock ${difficulty} difficulty`);
      return;
    }

    this.currentDifficultyView = difficulty;
    this.showLevelGrid(difficulty);
  }

  showLevelGrid(difficulty) {
    this.currentDifficultyView = difficulty;
    this.showScreen('level-grid');
    this.updateLevelGrid();
  }

  updateLevelGrid() {
    const difficulty = this.currentDifficultyView;
    const levels = this.gameManager.gameData[difficulty] || [];
    const progress = this.gameManager.getDifficultyProgress(difficulty);
    
    document.getElementById('grid-difficulty-name').textContent = 
      difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    
    const completedCount = (progress.completedLevels || []).length;
    document.getElementById('grid-completed-count').textContent = completedCount;
    document.getElementById('grid-total-count').textContent = levels.length;
    
    const difficultyScore = (progress.scores || []).reduce((sum, score) => sum + (score || 0), 0);
    document.getElementById('grid-difficulty-score').textContent = difficultyScore;
    
    const container = document.getElementById('levels-grid-container');
    container.innerHTML = '';
    
    levels.forEach((level, index) => {
      const isCompleted = this.gameManager.isLevelCompleted(difficulty, index);
      const levelScore = this.gameManager.getLevelScore(difficulty, index);
      const nextUncompleted = this.gameManager.getNextUncompletedLevel(difficulty);
      const isNext = index === nextUncompleted;
      
      const tile = document.createElement('div');
      tile.className = 'level-tile';
      if (isCompleted) tile.classList.add('completed');
      if (isNext && !isCompleted) tile.classList.add('current');
      
      tile.innerHTML = `
        <div class="level-number">${index + 1}</div>
        ${isCompleted ? `
          <div class="level-score">${levelScore} pts</div>
          <div class="level-check">✓</div>
        ` : ''}
      `;
      
      tile.addEventListener('click', () => {
        this.handleLevelSelect(difficulty, index);
      });
      
      container.appendChild(tile);
    });
  }

  handleLevelSelect(difficulty, levelIndex) {
    const result = this.gameManager.startLevel(difficulty, levelIndex);
    
    if (result === true) {
      this.showGameScreen();
    } else if (result.alreadyCompleted) {
      this.showError('This level has already been completed! Play an uncompleted level.');
    } else if (result.allCompleted) {
      this.showError('Congratulations! All levels in this difficulty are completed.');
    } else {
      this.showError('Failed to start level');
    }
  }

  showGameScreen() {
    this.showScreen('game');
    requestAnimationFrame(() => {
      this.updateGameScreen();
    });
  }

  updateGameScreen() {
    const brand = this.gameManager.getCurrentBrand();
    if (!brand) {
      this.showError('No brand data available');
      return;
    }

    const levelInfo = this.gameManager.getCurrentLevelInfo();

    document.getElementById('current-level').textContent = 
      `${levelInfo.difficulty.charAt(0).toUpperCase() + levelInfo.difficulty.slice(1)} ${levelInfo.level}/${levelInfo.total}`;
    document.getElementById('current-score').textContent = `${this.gameManager.getTotalScore()} pts`;

    const logoElement = document.getElementById('brand-logo');
    if (logoElement) {
      logoElement.src = brand.image;
      logoElement.alt = 'Guess the brand';
      logoElement.onerror = () => {
        logoElement.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect fill="%23f0f0f0" width="200" height="150"/><text y="75" font-size="14" text-anchor="middle" x="100" fill="%23999">Image Not Found</text></svg>';
      };
    }

    document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();

    this.updateLetterButtons();

    document.getElementById('hint-display').textContent = '';
    
    for (let i = 1; i <= 3; i++) {
      const strikeEl = document.getElementById(`strike-${i}`);
      if (strikeEl) {
        strikeEl.classList.remove('active');
      }
    }
    
    this.updateActionButtons();
  }

  updateActionButtons() {
    const hintBtn = document.getElementById('hint-btn');
    const revealBtn = document.getElementById('reveal-btn');
    
    if (hintBtn) {
      const canUseHint = this.gameManager.canUseHint();
      const hintCost = this.gameManager.hintsUsed === 0 ? 10 : 15;
      
      if (!canUseHint) {
        hintBtn.style.display = 'none';
      } else {
        hintBtn.style.display = 'inline-block';
        hintBtn.innerHTML = `💡 Hint (-${hintCost} pts)`;
      }
    }
    
    if (revealBtn) {
      const canUseReveal = this.gameManager.canUseReveal();
      
      if (!canUseReveal) {
        revealBtn.style.display = 'none';
      } else {
        revealBtn.style.display = 'inline-block';
        revealBtn.innerHTML = '👁️ Reveal Letter (-15 pts)';
      }
    }
  }

  updateLetterButtons() {
    const container = document.getElementById('letters-container');
    const letters = this.gameManager.generateRandomLetters();

    container.innerHTML = '';
    
    letters.forEach(letter => {
      const button = document.createElement('button');
      button.className = 'letter-btn';
      button.textContent = letter;
      button.addEventListener('click', () => this.handleLetterGuess(letter, button));
      
      if (this.gameManager.guessedLetters.includes(letter)) {
        button.disabled = true;
      }
      
      container.appendChild(button);
    });
  }

  async handleLetterGuess(letter, button) {
    const result = this.gameManager.makeGuess(letter);

    if (!result.success) {
      this.showError(result.message);
      return;
    }

    button.disabled = true;
    
    if (result.correct) {
      button.classList.add('correct');
      document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();
      
      this.updateActionButtons();
      
      if (result.complete) {
        console.log('Level complete detected');
        this.handleLevelCompleteIOS();
      }
    } else {
      button.style.opacity = '0.3';
      button.style.background = '#ffebee';
      
      this.showStrikeFeedback(result.strikes, result.strikesLeft);
      
      if (result.gameOver) {
        document.querySelectorAll('.letter-btn:not(:disabled)').forEach(btn => {
          btn.disabled = true;
          btn.style.opacity = '0.2';
        });
        
        setTimeout(() => {
          this.showGameOver(result);
        }, 1500);
      } else {
        if (result.strikesLeft === 1) {
          this.showError(`⚠️ Careful! Only 1 strike left! (-${result.penalty} pts)`);
        } else {
          this.showError(`Wrong! ${result.strikesLeft} strikes left. (-${result.penalty} pts)`);
        }
      }
      
      document.getElementById('current-score').textContent = `${this.gameManager.getTotalScore()} pts`;
    }
  }

  handleLevelCompleteIOS() {
    console.log('iOS level completion handler');
    
    try {
      // Save progress synchronously
      const stats = this.gameManager.completeLevelSync();
      
      // Update leaderboard in background
      setTimeout(() => {
        if (this.leaderboardManager && this.leaderboardManager.canSubmitToLeaderboard()) {
          this.leaderboardManager.updateLeaderboardEntry();
        }
      }, 300);
      
      // Small delay to ensure state is saved
      setTimeout(() => {
        console.log('Showing level complete screen');
        this.showLevelComplete(stats);
      }, 200);
      
    } catch (error) {
      console.error('Error in iOS level completion:', error);
      // Still try to show the completion screen even if saving failed
      const fallbackStats = {
        score: this.gameManager.currentScore || 0,
        levelScore: this.gameManager.levelScore || 0,
        attempts: this.gameManager.attempts || 0,
        hintsUsed: this.gameManager.hintsUsed || 0,
        revealsUsed: this.gameManager.revealsUsed || 0,
        strikes: this.gameManager.strikes || 0,
        timeTaken: this.gameManager.timeTaken || 0,
        totalScore: this.gameManager.totalScore || 0
      };
      
      setTimeout(() => {
        this.showLevelComplete(fallbackStats);
      }, 200);
    }
  }

  async handleLevelComplete() {
    if (this.isIOS) {
      this.handleLevelCompleteIOS();
      return;
    }
    
    try {
      const stats = await this.gameManager.completeLevel();
      
      // Update leaderboard after level completion
      if (this.leaderboardManager && this.leaderboardManager.canSubmitToLeaderboard()) {
        await this.leaderboardManager.updateLeaderboardEntry();
      }
      
      requestAnimationFrame(() => {
        this.showLevelComplete(stats);
      });
    } catch (error) {
      console.error('Error completing level:', error);
      this.showError('Error saving level progress');
    }
  }

  showStrikeFeedback(strikes, strikesLeft) {
    const strikeEl = document.getElementById(`strike-${strikes}`);
    if (strikeEl) {
      strikeEl.classList.add('active');
      strikeEl.style.animation = 'pulse 0.5s';
      setTimeout(() => {
        strikeEl.style.animation = '';
      }, 500);
    }
  }

  showGameOver(result) {
    const brand = this.gameManager.getCurrentBrand();
    const levelInfo = this.gameManager.getCurrentLevelInfo();
    
    document.getElementById('gameover-logo').src = brand.image;
    document.getElementById('gameover-brand-name').textContent = result.answer;
    document.getElementById('penalty-amount').textContent = result.totalPenalty;
    document.getElementById('retries-left').textContent = levelInfo.retriesLeft;
    
    const retryBtn = document.getElementById('retry-level-btn');
    if (levelInfo.retriesLeft > 0) {
      retryBtn.style.display = 'inline-block';
      retryBtn.innerHTML = `🔄 Retry (-25 pts)`;
    } else {
      retryBtn.style.display = 'none';
    }
    
    this.showScreen('game-over');
  }

  setupGameOverListeners() {
    document.getElementById('retry-level-btn').addEventListener('click', () => {
      const result = this.gameManager.retryLevel();
      
      if (result.success) {
        this.showMessage(result.message);
        this.showGameScreen();
      } else {
        this.showError(result.message);
      }
    });

    document.getElementById('skip-level-btn').addEventListener('click', () => {
      const result = this.gameManager.skipLevel();
      
      if (result.success) {
        this.showMessage(result.message);
        this.handleNextLevel();
      }
    });
    
    document.getElementById('back-to-levels-gameover').addEventListener('click', () => {
      this.showLevelGrid(this.currentDifficultyView);
    });
  }

  showLevelComplete(stats) {
    console.log('showLevelComplete called with stats:', stats);
    
    const brand = this.gameManager.getCurrentBrand();

    document.getElementById('completed-logo').src = brand.image;
    document.getElementById('completed-brand-name').textContent = brand.name;
    document.getElementById('level-score').textContent = `${stats.score} pts`;
    document.getElementById('level-attempts').textContent = stats.attempts;
    document.getElementById('brand-founded').textContent = brand.founded || 'N/A';
    document.getElementById('brand-description').textContent = 
      brand.description || 'A prestigious watch manufacturer.';
    
    const finalTimeEl = document.getElementById('final-time');
    if (finalTimeEl) {
      const minutes = Math.floor(stats.timeTaken / 60);
      const seconds = stats.timeTaken % 60;
      finalTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    const currentDifficulty = this.gameManager.currentDifficulty;
    const nextLevel = this.gameManager.getNextUncompletedLevel(currentDifficulty);
    
    const nextBtn = document.getElementById('next-level-btn');
    if (nextBtn) {
      if (nextLevel !== null) {
        nextBtn.style.display = 'inline-block';
        nextBtn.textContent = 'Next Level';
      } else {
        nextBtn.style.display = 'inline-block';
        nextBtn.textContent = 'All Complete! Back to Levels';
      }
    }

    this.showScreen('level-complete');
  }

  handleNextLevel() {
    const currentDifficulty = this.gameManager.currentDifficulty;
    const nextLevel = this.gameManager.getNextUncompletedLevel(currentDifficulty);

    if (nextLevel !== null) {
      const started = this.gameManager.startLevel(currentDifficulty, nextLevel);
      
      if (started === true) {
        this.showGameScreen();
      } else {
        console.error('Failed to start next level');
        this.showLevelGrid(currentDifficulty);
      }
    } else {
      this.showMessage('Congratulations! You completed all levels in this difficulty.');
      this.showLevelGrid(currentDifficulty);
    }
  }

  showLevelSelect() {
    this.showScreen('level-select');
  }

  handleHint() {
    const result = this.gameManager.useHint();
    
    if (result.success) {
      document.getElementById('hint-display').textContent = result.hint;
      document.getElementById('current-score').textContent = 
        `${result.newTotalScore} pts`;
      this.updateActionButtons();
    } else {
      this.showError(result.message);
    }
  }

  handleReveal() {
    const result = this.gameManager.revealLetter();
    
    if (result.success) {
      document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();
      
      const buttons = document.querySelectorAll('.letter-btn');
      buttons.forEach(button => {
        if (button.textContent === result.letter) {
          button.disabled = true;
          button.classList.add('correct');
        }
      });
      
      document.getElementById('current-score').textContent = 
        `${result.newTotalScore} pts`;
      
      this.updateActionButtons();
      
      if (result.complete) {
        if (this.isIOS) {
          this.handleLevelCompleteIOS();
        } else {
          setTimeout(async () => {
            await this.handleLevelComplete();
          }, 100);
        }
      }
    } else {
      this.showError(result.message);
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 4000);
  }

  showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-toast';
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 4000);
  }
}

// Add toast animation CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, creating app...');
  window.app = new App();
});
