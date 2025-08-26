class App {
  constructor() {
    this.authManager = null;
    this.gameManager = null;
    this.currentScreen = 'loading';
    
    // Wait for DOM to be ready before initializing
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  async init() {
    try {
      // Check if Supabase is loaded
      if (typeof supabase === 'undefined' || !supabase) {
        throw new Error('Supabase library not loaded. Please check your internet connection.');
      }

      // Initialize Supabase
      window.supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      
      // Test Supabase connection
      const { error } = await window.supabase.from('user_profiles').select('count').limit(1);
      if (error) {
        console.warn('Supabase connection issue:', error);
        // Continue anyway - might just be empty table
      }

      // Initialize managers
      this.authManager = new AuthManager();
      this.gameManager = new GameManager(this.authManager);

      // Load game data
      await this.gameManager.loadGameData();

      // Register service worker
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('./sw.js');
        } catch (error) {
          console.warn('Service worker registration failed:', error);
        }
      }

      // Setup event listeners
      this.setupEventListeners();

      // Show start screen after loading
      setTimeout(() => {
        this.showScreen('start');
      }, 2000);

    } catch (error) {
      console.error('App initialization error:', error);
      this.showError('Failed to initialize app. Please check your internet connection and refresh the page.');
    }
  }

  setupEventListeners() {
    // Auth events
    document.getElementById('play-as-guest').addEventListener('click', () => {
      this.handleGuestPlay();
    });

    document.getElementById('show-login').addEventListener('click', () => {
      this.showAuthForms();
    });

    document.getElementById('login-btn').addEventListener('click', () => {
      this.handleLogin();
    });

    document.getElementById('register-btn').addEventListener('click', () => {
      this.handleRegister();
    });

    document.getElementById('show-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegisterForm();
    });

    document.getElementById('show-login-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginForm();
    });

    document.getElementById('back-to-guest').addEventListener('click', () => {
      this.hideAuthForms();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Game events
    document.querySelectorAll('.difficulty-card').forEach(card => {
      card.addEventListener('click', () => {
        this.handleDifficultySelect(card.dataset.level);
      });
    });

    document.getElementById('back-to-levels').addEventListener('click', () => {
      this.showLevelSelect();
    });

    document.getElementById('back-to-levels-complete').addEventListener('click', () => {
      this.showLevelSelect();
    });

    document.getElementById('hint-btn').addEventListener('click', () => {
      this.handleHint();
    });

    document.getElementById('reveal-btn').addEventListener('click', () => {
      this.handleReveal();
    });

    document.getElementById('next-level-btn').addEventListener('click', () => {
      this.handleNextLevel();
    });

    // Handle form submissions
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });
  }

  showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show target screen
    document.getElementById(`${screenId}-screen`).classList.add('active');
    this.currentScreen = screenId;

    // Update screen-specific content
    if (screenId === 'level-select') {
      this.updateLevelSelect();
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
      this.showError(result.error);
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
      this.showError(result.error);
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
      const progress = this.gameManager.getDifficultyProgress(difficulty);
      const isUnlocked = this.gameManager.isDifficultyUnlocked(difficulty);
      const totalLevels = this.gameManager.gameData[difficulty].length;

      // Update completion count
      card.querySelector('.completed').textContent = 
        `${progress.completed}/${totalLevels}`;

      // Update lock status
      if (isUnlocked) {
        card.classList.remove('locked');
        card.querySelector('.status').textContent = 'Available';
      } else {
        card.classList.add('locked');
        const requiredDifficulty = difficulty === 'medium' ? 'Easy' : 'Medium';
        const required = GAME_CONFIG.unlockRequirement[difficulty];
        card.querySelector('.status').textContent = 
          `Complete ${required} ${requiredDifficulty} levels`;
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
      this.showError('Failed to start level');
    }
  }

  showGameScreen() {
    this.showScreen('game');
    this.updateGameScreen();
  }

  updateGameScreen() {
    const brand = this.gameManager.getCurrentBrand();
    const levelInfo = this.gameManager.getCurrentLevelInfo();

    // Update header
    document.getElementById('current-level').textContent = 
      `${levelInfo.difficulty.charAt(0).toUpperCase() + levelInfo.difficulty.slice(1)} ${levelInfo.level}/${levelInfo.total}`;
    document.getElementById('current-score').textContent = `${this.gameManager.getTotalScore()} pts`;

    // Update logo
    document.getElementById('brand-logo').src = brand.image;
    document.getElementById('brand-logo').alt = `${brand.name} Logo`;

    // Update word display
    document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();

    // Generate and display letter buttons
    this.updateLetterButtons();

    // Clear hint display
    document.getElementById('hint-display').textContent = '';
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
      
      if (result.complete) {
        this.handleLevelComplete();
      }
    } else {
      button.style.opacity = '0.3';
    }
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

    // Update total score in header
    document.getElementById('current-score').textContent = `${stats.totalScore} pts`;

    this.showScreen('level-complete');
  }

  handleNextLevel() {
    // Try to start next level in same difficulty
    const currentDifficulty = this.gameManager.currentDifficulty;
    const currentLevel = this.gameManager.currentLevel;
    const availableLevels = this.gameManager.gameData[currentDifficulty].length;

    if (currentLevel + 1 < availableLevels) {
      if (this.gameManager.startLevel(currentDifficulty, currentLevel + 1)) {
        this.showGameScreen();
      } else {
        this.showLevelSelect();
      }
    } else {
      // No more levels in this difficulty
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
      // Update score display
      document.getElementById('current-score').textContent = 
        `${this.gameManager.getTotalScore()} pts`;
    } else {
      this.showError(result.message);
    }
  }

  handleReveal() {
    const result = this.gameManager.revealLetter();
    
    if (result.success) {
      // Update word display
      document.getElementById('word-display').textContent = this.gameManager.getDisplayWord();
      
      // Update letter button
      const buttons = document.querySelectorAll('.letter-btn');
      buttons.forEach(button => {
        if (button.textContent === result.letter) {
          button.disabled = true;
          button.classList.add('correct');
        }
      });
      
      // Update score display
      document.getElementById('current-score').textContent = 
        `${this.gameManager.getTotalScore()} pts`;
      
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
    // Create a better error display
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
    // Create a better message display
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

// Initialize app - will be called by the script loader in index.html
window.initializeApp = () => {
  new App();
};

// Fallback initialization if script loader doesn't work
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof SUPABASE_CONFIG !== 'undefined' && typeof supabase !== 'undefined') {
      new App();
    }
  });
} else {
  if (typeof SUPABASE_CONFIG !== 'undefined' && typeof supabase !== 'undefined') {
    new App();
  }
}
