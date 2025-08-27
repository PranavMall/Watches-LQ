class App {
  constructor() {
    this.authManager = null;
    this.gameManager = null;
    this.currentScreen = 'loading';
    this.isInitialized = false;
    
    // Start initialization
    this.init();
  }

  async init() {
    try {
      console.log('App init started...');
      
      // Update loading status
      this.updateLoadingStatus('Initializing Supabase...');
      
      // Initialize Supabase with a timeout
      const supabaseInit = new Promise((resolve, reject) => {
        setTimeout(() => {
          if (typeof window.supabase !== 'undefined') {
            try {
              window.supabaseClient = window.supabase.createClient(
                SUPABASE_CONFIG.url, 
                SUPABASE_CONFIG.anonKey
              );
              console.log('Supabase initialized successfully');
              resolve();
            } catch (error) {
              console.error('Supabase init error:', error);
              reject(error);
            }
          } else {
            console.warn('Supabase not available, continuing without it');
            resolve(); // Continue without Supabase
          }
        }, 100);
      });

      await Promise.race([
        supabaseInit,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 3000))
      ]).catch(err => {
        console.warn('Supabase initialization failed, continuing offline:', err);
      });

      // Update loading status
      this.updateLoadingStatus('Loading game managers...');

      // Initialize managers (they should handle missing Supabase gracefully)
      this.authManager = new AuthManager();
      this.gameManager = new GameManager(this.authManager);

      // Update loading status
      this.updateLoadingStatus('Loading game data...');

      // Load game data with timeout
      await Promise.race([
        this.gameManager.loadGameData(),
        new Promise((resolve) => setTimeout(() => {
          console.warn('Game data loading timeout, using defaults');
          resolve();
        }, 3000))
      ]);

      // Register service worker (non-blocking)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => 
          console.warn('Service worker registration failed:', err)
        );
      }

      // Setup event listeners
      this.setupEventListeners();

      // Update loading status
      this.updateLoadingStatus('Ready to play!');

      // Mark as initialized
      this.isInitialized = true;

      // Show start screen after a short delay
      setTimeout(() => {
        console.log('Showing start screen...');
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
    
    // Try to continue anyway
    this.updateLoadingStatus('Starting in offline mode...');
    
    // Initialize with defaults
    if (!this.authManager) {
      this.authManager = new AuthManager();
    }
    if (!this.gameManager) {
      this.gameManager = new GameManager(this.authManager);
    }
    
    // Setup listeners
    this.setupEventListeners();
    
    // Show start screen
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

    // Game events
    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.addEventListener('click', () => {
        this.handleDifficultySelect(card.dataset.level);
      });
    });

    const backToLevelsBtn = document.getElementById('back-to-levels');
    if (backToLevelsBtn) {
      backToLevelsBtn.addEventListener('click', () => this.showLevelSelect());
    }

    const backToLevelsCompleteBtn = document.getElementById('back-to-levels-complete');
    if (backToLevelsCompleteBtn) {
      backToLevelsCompleteBtn.addEventListener('click', () => this.showLevelSelect());
    }

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
    // Add game over listeners
  this.setupGameOverListeners();
  }

  showScreen(screenId) {
    console.log('Showing screen:', screenId);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(`${screenId}-screen`);
    if (targetScreen) {
      targetScreen.classList.add('active');
      this.currentScreen = screenId;

      // Update screen-specific content
      if (screenId === 'level-select') {
        this.updateLevelSelect();
      }
    } else {
      console.error('Screen not found:', screenId);
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

    // Update difficulty cards
    ['easy', 'medium', 'hard'].forEach(difficulty => {
      const card = document.querySelector(`.difficulty-card[data-level="${difficulty}"]`);
      if (!card) return;
      
      const progress = this.gameManager.getDifficultyProgress(difficulty);
      const isUnlocked = this.gameManager.isDifficultyUnlocked(difficulty);
      const totalLevels = this.gameManager.gameData[difficulty]?.length || 10;

      // Update completion count
      const completedElement = card.querySelector('.completed');
      if (completedElement) {
        completedElement.textContent = `${progress.completed}/${totalLevels}`;
      }

      // Update lock status
      const statusElement = card.querySelector('.status');
      if (isUnlocked) {
        card.classList.remove('locked');
        if (statusElement) {
          statusElement.textContent = 'Available';
        }
      } else {
        card.classList.add('locked');
        if (statusElement) {
          const requiredDifficulty = difficulty === 'medium' ? 'Easy' : 'Medium';
          const required = GAME_CONFIG.unlockRequirement[difficulty];
          statusElement.textContent = `Complete ${required} ${requiredDifficulty} levels`;
        }
      }
    });
  }

  handleDifficultySelect(difficulty) {
    if (!this.gameManager.isDifficultyUnlocked(difficulty)) {
      this.showError(`Complete more levels to unlock ${difficulty} difficulty`);
      return;
    }

    // Start a level in the selected difficulty
    if (this.gameManager.startLevel(difficulty)) {
      this.showGameScreen();
    } else {
      this.showError('No levels available in this difficulty');
    }
  }

  showGameScreen() {
    this.showScreen('game');
    this.updateGameScreen();
  }

// Update the showGameScreen method to reset strikes display
updateGameScreen() {
  const brand = this.gameManager.getCurrentBrand();
  if (!brand) {
    this.showError('No brand data available');
    return;
  }

  const levelInfo = this.gameManager.getCurrentLevelInfo();

  // Update header
  document.getElementById('current-level').textContent = 
    `${levelInfo.difficulty.charAt(0).toUpperCase() + levelInfo.difficulty.slice(1)} ${levelInfo.level}/${levelInfo.total}`;
  document.getElementById('current-score').textContent = `${this.gameManager.getTotalScore()} pts`;

  // Update logo
  const logoElement = document.getElementById('brand-logo');
  if (logoElement) {
    logoElement.src = brand.image;
    logoElement.alt = 'Guess the brand';
  }

  // Update word display
  document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();

  // Generate and display letter buttons
  this.updateLetterButtons();

  // Clear hint display
  document.getElementById('hint-display').textContent = '';
  
  // Reset strikes display
  for (let i = 1; i <= 3; i++) {
    const strikeEl = document.getElementById(`strike-${i}`);
    if (strikeEl) {
      strikeEl.classList.remove('active');
    }
  }
  
  // Update hint and reveal button visibility based on score
  this.updateActionButtons();
}
  
  updateActionButtons() {
    const hintBtn = document.getElementById('hint-btn');
    const revealBtn = document.getElementById('reveal-btn');
    
    // Update hint button
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
    
    // Update reveal button
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

handleLetterGuess(letter, button) {
  const result = this.gameManager.makeGuess(letter);

  if (!result.success) {
    this.showError(result.message);
    return;
  }

  // Update button state
  button.disabled = true;
  
  if (result.correct) {
    button.classList.add('correct');
    // Update word display
    document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();
    
    // Update action buttons visibility after each guess
    this.updateActionButtons();
    
    if (result.complete) {
      this.handleLevelComplete();
    }
  } else {
    // Wrong guess
    button.style.opacity = '0.3';
    button.style.background = '#ffebee';
    
    // Show strike feedback
    this.showStrikeFeedback(result.strikes, result.strikesLeft);
    
    // Check if game over
    if (result.gameOver) {
      // Disable all remaining buttons
      document.querySelectorAll('.letter-btn:not(:disabled)').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.2';
      });
      
      // Show game over after a short delay
      setTimeout(() => {
        this.showGameOver(result);
      }, 1500);
    } else {
      // Show warning if on last strike
      if (result.strikesLeft === 1) {
        this.showError(`⚠️ Careful! Only 1 strike left! (-${result.penalty} pts)`);
      } else {
        this.showError(`Wrong! ${result.strikesLeft} strikes left. (-${result.penalty} pts)`);
      }
    }
    
    // Update score display
    document.getElementById('current-score').textContent = `${this.gameManager.getTotalScore()} pts`;
  }
}

// Show strike feedback animation
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

// Show game over screen
showGameOver(result) {
  const brand = this.gameManager.getCurrentBrand();
  const levelInfo = this.gameManager.getCurrentLevelInfo();
  
  // Update game over screen
  document.getElementById('gameover-logo').src = brand.image;
  document.getElementById('gameover-brand-name').textContent = result.answer;
  document.getElementById('penalty-amount').textContent = result.totalPenalty;
  document.getElementById('retries-left').textContent = levelInfo.retriesLeft;
  
  // Update retry button based on retries left
  const retryBtn = document.getElementById('retry-level-btn');
  if (levelInfo.retriesLeft > 0) {
    retryBtn.style.display = 'inline-block';
    retryBtn.innerHTML = `🔄 Retry (-${Math.floor(25 * 0.5)} pts)`;
  } else {
    retryBtn.style.display = 'none';
  }
  
  this.showScreen('game-over');
}
  setupGameOverListeners() {
  // Retry button
  document.getElementById('retry-level-btn').addEventListener('click', () => {
    const result = this.gameManager.retryLevel();
    
    if (result.success) {
      this.showMessage(result.message);
      this.showGameScreen();
    } else {
      this.showError(result.message);
    }
  });
    // Skip button
  document.getElementById('skip-level-btn').addEventListener('click', () => {
    const result = this.gameManager.skipLevel();
    
    if (result.success) {
      this.showMessage(result.message);
      // Move to next level
      this.handleNextLevel();
    }
  });
  
  // Back to levels
  document.getElementById('back-to-levels-gameover').addEventListener('click', () => {
    this.showLevelSelect();
  });
}

  async handleLevelComplete() {
    const stats = await this.gameManager.completeLevel();
    this.showLevelComplete(stats);
  }

  showLevelComplete(stats) {
    const brand = this.gameManager.getCurrentBrand();

    // Update completion screen
    document.getElementById('completed-logo').src = brand.image;
    document.getElementById('completed-brand-name').textContent = brand.name;
    document.getElementById('level-score').textContent = `${stats.score} pts`;
    document.getElementById('level-attempts').textContent = stats.attempts;
    document.getElementById('brand-founded').textContent = brand.founded || 'N/A';
    document.getElementById('brand-description').textContent = 
      brand.description || 'A prestigious watch manufacturer.';

    this.showScreen('level-complete');
  }

  handleNextLevel() {
    const currentDifficulty = this.gameManager.currentDifficulty;
    const currentLevel = this.gameManager.currentLevel;
    const availableLevels = this.gameManager.gameData[currentDifficulty]?.length || 0;

    if (currentLevel + 1 < availableLevels) {
      if (this.gameManager.startLevel(currentDifficulty, currentLevel + 1)) {
        this.showGameScreen();
      } else {
        this.showLevelSelect();
      }
    } else {
      this.showMessage('Congratulations! You completed all levels in this difficulty.');
      this.showLevelSelect();
    }
  }

  showLevelSelect() {
    this.showScreen('level-select');
  }

  handleHint() {
    const result = this.gameManager.useHint();
    
    if (result.success) {
      document.getElementById('hint-display').textContent = result.hint;
      // Update score display with new total score
      document.getElementById('current-score').textContent = 
        `${result.newTotalScore} pts`;
      // Update action buttons visibility
      this.updateActionButtons();
    } else {
      this.showError(result.message);
    }
  }

  handleReveal() {
    const result = this.gameManager.revealLetter();
    
    if (result.success) {
      // Update word display
      document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();
      
      // Update letter buttons
      const buttons = document.querySelectorAll('.letter-btn');
      buttons.forEach(button => {
        if (button.textContent === result.letter) {
          button.disabled = true;
          button.classList.add('correct');
        }
      });
      
      // Update score display with new total score
      document.getElementById('current-score').textContent = 
        `${result.newTotalScore} pts`;
      
      // Update action buttons visibility
      this.updateActionButtons();
      
      // Check if word is complete
      const wordComplete = this.gameManager.currentWord
        .split('')
        .every(char => char === ' ' || this.gameManager.guessedLetters.includes(char));
      
      if (wordComplete) {
        this.handleLevelComplete();
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
