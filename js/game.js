// js/game.js - FIXED VERSION - Corrected syntax error on line 73
class GameManager {
  constructor(authManager) {
    this.authManager = authManager;
    this.currentLevel = null;
    this.currentDifficulty = 'easy';
    this.gameData = { 
      easy: this.getDefaultEasyData(), 
      medium: this.getDefaultMediumData(), 
      hard: this.getDefaultHardData() 
    };
    this.userProgress = {
      easy: { completed: 0, scores: [], failed: [], completedLevels: [] },
      medium: { completed: 0, scores: [], failed: [], completedLevels: [] },
      hard: { completed: 0, scores: [], failed: [], completedLevels: [] }
    };
    
    // Game state
    this.currentWord = '';
    this.currentBrand = null;
    this.guessedLetters = [];
    this.correctGuesses = [];
    this.wrongGuesses = [];
    this.attempts = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 0;
    this.levelScore = 0;
    this.totalScore = 100;
    
    // Strike system
    this.strikes = 0;
    this.maxStrikes = 3;
    this.strikesPenalty = 5;
    
    // Retry tracking
    this.retryCount = 0;
    this.maxRetries = 2;
    this.retryPenalty = 25;
    
    // Timer
    this.timeStarted = null;
    this.timeTaken = 0;
    this.timerInterval = null;
  }

  async loadGameData() {
    console.log('Loading game data...');
    
    const savedTotalScore = localStorage.getItem('watches_lq_total_score');
    if (savedTotalScore) {
      this.totalScore = parseInt(savedTotalScore) || 100;
    }
    
    const savedProgress = localStorage.getItem('watches_lq_progress');
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        Object.keys(progress).forEach(difficulty => {
          if (progress[difficulty]) {
            this.userProgress[difficulty] = {
              ...progress[difficulty],
              completedLevels: progress[difficulty].completedLevels || []
            };
          }
        });
      } catch (error) {
        console.warn('Failed to parse saved progress:', error);
      }
    }
    
    try {
      const difficulties = ['easy', 'medium', 'hard'];
      
      for (const difficulty of difficulties) {
        try {  // ✅ FIXED: This was "tr" - incomplete word causing syntax error!
          const response = await fetch(`data/${difficulty}.json`);
          if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
              this.gameData[difficulty] = data;
              console.log(`Loaded ${data.length} ${difficulty} brands`);
            }
          }
        } catch (error) {
          console.warn(`Using default data for ${difficulty}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to load external data, using defaults:', error);
    }
    
    await this.loadUserProgress();
  }

  async loadUserProgress() {
    const user = this.authManager.getCurrentUser();
    
    if (user && !this.authManager.isGuestUser() && window.supabaseClient) {
      try {
        const { data, error } = await window.supabaseClient
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id);

        if (!error && data && data.length > 0) {
          data.forEach(record => {
            this.userProgress[record.difficulty] = {
              completed: record.completed_levels || 0,
              scores: record.level_scores || [],
              failed: record.failed_levels || [],
              completedLevels: record.completed_levels_array || []
            };
            if (record.total_score) {
              this.totalScore = record.total_score;
            }
          });
        } else if (!error && (!data || data.length === 0)) {
          console.log('No progress records found, initializing...');
          await this.initializeUserProgress(user.id);
        }
      } catch (error) {
        console.warn('Failed to load user progress from server:', error);
      }
    }
  }

  async initializeUserProgress(userId) {
    if (!window.supabaseClient) return;
    
    try {
      const difficulties = ['easy', 'medium', 'hard'];
      const progressRecords = difficulties.map(difficulty => ({
        user_id: userId,
        difficulty: difficulty,
        completed_levels: 0,
        level_scores: [],
        failed_levels: [],
        completed_levels_array: [],
        total_score: this.totalScore || 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await window.supabaseClient
        .from('user_progress')
        .insert(progressRecords);

      if (error && error.code !== '23505') {
        console.error('Failed to initialize progress:', error);
      } else {
        console.log('✅ Progress records initialized successfully');
      }
    } catch (error) {
      console.error('Progress initialization error:', error);
    }
  }

  async saveProgress() {
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    localStorage.setItem('watches_lq_progress', JSON.stringify(this.userProgress));
    
    const user = this.authManager.getCurrentUser();
    if (user && !this.authManager.isGuestUser() && window.supabaseClient) {
      try {
        for (const [difficulty, progress] of Object.entries(this.userProgress)) {
          const { error } = await window.supabaseClient
            .from('user_progress')
            .upsert([
              {
                user_id: user.id,
                difficulty: difficulty,
                completed_levels: progress.completed || 0,
                level_scores: progress.scores || [],
                failed_levels: progress.failed || [],
                completed_levels_array: progress.completedLevels || [],
                total_score: this.totalScore,
                updated_at: new Date().toISOString()
              }
            ], { 
              onConflict: 'user_id,difficulty',
              ignoreDuplicates: false 
            });

          if (error) {
            console.error(`Failed to save progress for ${difficulty}:`, error);
          }
        }
      } catch (error) {
        console.warn('Failed to save progress to server:', error);
      }
    }
  }

  completeLevelSync() {
    const progress = this.getDifficultyProgress(this.currentDifficulty);
    
    if (!progress.scores) {
      progress.scores = [];
    }
    
    if (!progress.scores[this.currentLevel] || progress.scores[this.currentLevel] < this.currentScore) {
      progress.scores[this.currentLevel] = this.currentScore;
    }
    
    if (!progress.completedLevels.includes(this.currentLevel)) {
      progress.completedLevels.push(this.currentLevel);
      progress.completedLevels.sort((a, b) => a - b);
    }
    
    this.stopTimer();
    
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    localStorage.setItem('watches_lq_progress', JSON.stringify(this.userProgress));
    
    return {
      score: this.currentScore,
      levelScore: this.levelScore,
      attempts: this.attempts,
      hintsUsed: this.hintsUsed,
      revealsUsed: this.revealsUsed,
      strikes: this.strikes,
      timeTaken: this.timeTaken,
      totalScore: this.totalScore
    };
  }

  async completeLevel() {
    const progress = this.getDifficultyProgress(this.currentDifficulty);
    
    if (!progress.scores) {
      progress.scores = [];
    }
    
    if (!progress.scores[this.currentLevel] || progress.scores[this.currentLevel] < this.currentScore) {
      progress.scores[this.currentLevel] = this.currentScore;
    }
    
    if (!progress.completedLevels.includes(this.currentLevel)) {
      progress.completedLevels.push(this.currentLevel);
      progress.completedLevels.sort((a, b) => a - b);
    }
    
    this.stopTimer();
    
    await this.saveProgress();
    
    return {
      score: this.currentScore,
      levelScore: this.levelScore,
      attempts: this.attempts,
      hintsUsed: this.hintsUsed,
      revealsUsed: this.revealsUsed,
      strikes: this.strikes,
      timeTaken: this.timeTaken,
      totalScore: this.totalScore
    };
  }

  startLevel(difficulty, levelIndex) {
    if (!this.gameData[difficulty] || !this.gameData[difficulty][levelIndex]) {
      return false;
    }

    const progress = this.getDifficultyProgress(difficulty);
    const isCompleted = progress.completedLevels && progress.completedLevels.includes(levelIndex);
    const allCompleted = this.areAllLevelsCompleted(difficulty);

    if (isCompleted) {
      return { alreadyCompleted: true };
    }

    if (allCompleted) {
      return { allCompleted: true };
    }

    this.currentDifficulty = difficulty;
    this.currentLevel = levelIndex;
    this.currentBrand = this.gameData[difficulty][levelIndex];
    this.currentWord = this.currentBrand.name.toUpperCase();
    
    this.guessedLetters = [];
    this.correctGuesses = [];
    this.wrongGuesses = [];
    this.attempts = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 100;
    this.levelScore = 0;
    this.strikes = 0;
    this.retryCount = 0;
    
    this.startTimer();
    
    return true;
  }

  retryLevel() {
    if (this.retryCount >= this.maxRetries) {
      return {
        success: false,
        message: 'No retries left! You can skip this level instead.'
      };
    }

    if (this.totalScore < this.retryPenalty) {
      return {
        success: false,
        message: `Not enough points! Need ${this.retryPenalty} points to retry.`
      };
    }

    this.totalScore -= this.retryPenalty;
    this.retryCount++;
    
    this.guessedLetters = [];
    this.correctGuesses = [];
    this.wrongGuesses = [];
    this.attempts = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 100;
    this.levelScore = 0;
    this.strikes = 0;
    
    this.stopTimer();
    this.startTimer();
    
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    
    return {
      success: true,
      message: `Retry! -${this.retryPenalty} pts. ${this.maxRetries - this.retryCount} retries left.`
    };
  }

  skipLevel() {
    const skipPenalty = 30;
    
    if (this.totalScore < skipPenalty) {
      return {
        success: false,
        message: `Not enough points! Need ${skipPenalty} points to skip.`
      };
    }

    this.totalScore -= skipPenalty;
    
    const progress = this.getDifficultyProgress(this.currentDifficulty);
    if (!progress.failed) {
      progress.failed = [];
    }
    
    if (!progress.failed.includes(this.currentLevel)) {
      progress.failed.push(this.currentLevel);
    }
    
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    localStorage.setItem('watches_lq_progress', JSON.stringify(this.userProgress));
    
    return {
      success: true,
      message: `Level skipped! -${skipPenalty} pts`
    };
  }

  guessLetter(letter) {
    if (this.guessedLetters.includes(letter)) {
      return { alreadyGuessed: true };
    }

    this.guessedLetters.push(letter);
    this.attempts++;

    if (this.currentWord.includes(letter)) {
      this.correctGuesses.push(letter);
      
      const isComplete = this.currentWord.split('').every(char => {
        return char === ' ' || this.correctGuesses.includes(char);
      });

      return {
        correct: true,
        complete: isComplete
      };
    } else {
      this.wrongGuesses.push(letter);
      this.strikes++;
      
      const penalty = this.strikesPenalty;
      this.currentScore = Math.max(0, this.currentScore - penalty);
      this.totalScore = Math.max(0, this.totalScore - penalty);

      if (this.strikes >= this.maxStrikes) {
        this.stopTimer();
        return {
          correct: false,
          gameOver: true,
          answer: this.currentBrand.name,
          totalPenalty: this.strikesPenalty * this.maxStrikes
        };
      }

      return {
        correct: false,
        strikes: this.strikes,
        strikesLeft: this.maxStrikes - this.strikes,
        penalty: penalty
      };
    }
  }

  useHint() {
    const hintCost = this.hintsUsed === 0 ? 10 : 15;
    
    if (this.totalScore < hintCost) {
      return {
        success: false,
        message: `Not enough points! Need ${hintCost} points for a hint.`
      };
    }

    this.totalScore -= hintCost;
    this.currentScore = Math.max(0, this.currentScore - hintCost);
    this.hintsUsed++;

    const hint = this.currentBrand.hint || 'No hint available';
    
    return {
      success: true,
      hint: hint,
      newTotalScore: this.totalScore
    };
  }

  canUseHint() {
    const hintCost = this.hintsUsed === 0 ? 10 : 15;
    return this.totalScore >= hintCost && this.hintsUsed < 2;
  }

  revealLetter() {
    const revealCost = 15;
    
    if (this.totalScore < revealCost) {
      return {
        success: false,
        message: `Not enough points! Need ${revealCost} points to reveal a letter.`
      };
    }

    const unrevealedLetters = this.currentWord.split('').filter(char => {
      return char !== ' ' && !this.correctGuesses.includes(char);
    });

    if (unrevealedLetters.length === 0) {
      return {
        success: false,
        message: 'All letters already revealed!'
      };
    }

    const randomLetter = unrevealedLetters[Math.floor(Math.random() * unrevealedLetters.length)];
    
    if (!this.correctGuesses.includes(randomLetter)) {
      this.correctGuesses.push(randomLetter);
    }
    if (!this.guessedLetters.includes(randomLetter)) {
      this.guessedLetters.push(randomLetter);
    }

    this.totalScore -= revealCost;
    this.currentScore = Math.max(0, this.currentScore - revealCost);
    this.revealsUsed++;

    const isComplete = this.currentWord.split('').every(char => {
      return char === ' ' || this.correctGuesses.includes(char);
    });

    return {
      success: true,
      letter: randomLetter,
      complete: isComplete,
      newTotalScore: this.totalScore
    };
  }

  canReveal() {
    return this.totalScore >= 15;
  }

  getDisplayWord() {
    return this.currentWord.split('').map(char => {
      if (char === ' ') return ' ';
      return this.correctGuesses.includes(char) ? char : '_';
    }).join('');
  }

  getAvailableLetters() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return alphabet.split('').filter(letter => !this.guessedLetters.includes(letter));
  }

  getCurrentBrand() {
    return this.currentBrand;
  }

  getCurrentLevelInfo() {
    const difficulty = this.currentDifficulty;
    const progress = this.getDifficultyProgress(difficulty);
    
    return {
      difficulty: difficulty,
      level: this.currentLevel + 1,
      total: this.gameData[difficulty].length,
      retriesLeft: this.maxRetries - this.retryCount
    };
  }

  getTotalScore() {
    return this.totalScore;
  }

  getDifficultyProgress(difficulty) {
    return this.userProgress[difficulty] || {
      completed: 0,
      scores: [],
      failed: [],
      completedLevels: []
    };
  }

  isLevelCompleted(difficulty, levelIndex) {
    const progress = this.getDifficultyProgress(difficulty);
    return progress.completedLevels && progress.completedLevels.includes(levelIndex);
  }

  getLevelScore(difficulty, levelIndex) {
    const progress = this.getDifficultyProgress(difficulty);
    return progress.scores && progress.scores[levelIndex] ? progress.scores[levelIndex] : 0;
  }

  getNextUncompletedLevel(difficulty) {
    const totalLevels = this.gameData[difficulty].length;
    const progress = this.getDifficultyProgress(difficulty);
    
    for (let i = 0; i < totalLevels; i++) {
      if (!progress.completedLevels || !progress.completedLevels.includes(i)) {
        return i;
      }
    }
    
    return null;
  }

  areAllLevelsCompleted(difficulty) {
    const totalLevels = this.gameData[difficulty].length;
    const progress = this.getDifficultyProgress(difficulty);
    return progress.completedLevels && progress.completedLevels.length === totalLevels;
  }

  isDifficultyUnlocked(difficulty) {
    if (difficulty === 'easy') return true;
    
    const requiredDifficulty = difficulty === 'medium' ? 'easy' : 'medium';
    const required = GAME_CONFIG.unlockRequirement[difficulty] || 10;
    const completed = this.getDifficultyProgress(requiredDifficulty).completedLevels?.length || 0;
    
    return completed >= required;
  }

  async resetGameProgress() {
    this.userProgress = {
      easy: { completed: 0, scores: [], failed: [], completedLevels: [] },
      medium: { completed: 0, scores: [], failed: [], completedLevels: [] },
      hard: { completed: 0, scores: [], failed: [], completedLevels: [] }
    };
    this.totalScore = 100;
    
    localStorage.setItem('watches_lq_total_score', '100');
    localStorage.setItem('watches_lq_progress', JSON.stringify(this.userProgress));
    
    const user = this.authManager.getCurrentUser();
    if (user && !this.authManager.isGuestUser() && window.supabaseClient) {
      try {
        const difficulties = ['easy', 'medium', 'hard'];
        for (const difficulty of difficulties) {
          await window.supabaseClient
            .from('user_progress')
            .upsert([
              {
                user_id: user.id,
                difficulty: difficulty,
                completed_levels: 0,
                level_scores: [],
                failed_levels: [],
                completed_levels_array: [],
                total_score: 100,
                updated_at: new Date().toISOString()
              }
            ], { 
              onConflict: 'user_id,difficulty',
              ignoreDuplicates: false 
            });
        }
      } catch (error) {
        console.warn('Failed to reset progress on server:', error);
      }
    }
    
    return {
      success: true,
      message: 'Game progress has been reset!'
    };
  }

  startTimer() {
    this.timeStarted = Date.now();
    this.timeTaken = 0;
    
    this.timerInterval = setInterval(() => {
      this.timeTaken = Math.floor((Date.now() - this.timeStarted) / 1000);
      window.dispatchEvent(new CustomEvent('timer-update', { 
        detail: { time: this.timeTaken } 
      }));
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    if (this.timeStarted) {
      this.timeTaken = Math.floor((Date.now() - this.timeStarted) / 1000);
    }
  }

  // Default brand data methods (fallbacks if JSON files don't load)
  getDefaultEasyData() {
    return [
      { name: "ROLEX", image: "https://via.placeholder.com/200x150?text=ROLEX", hint: "Swiss luxury watch manufacturer", founded: "1905" },
      { name: "OMEGA", image: "https://via.placeholder.com/200x150?text=OMEGA", hint: "Official timekeeper of the Olympics", founded: "1848" },
      { name: "TAG HEUER", image: "https://via.placeholder.com/200x150?text=TAG+HEUER", hint: "Swiss avant-garde since 1860", founded: "1860" },
      { name: "CASIO", image: "https://via.placeholder.com/200x150?text=CASIO", hint: "Japanese electronics company known for G-SHOCK", founded: "1946" },
      { name: "SEIKO", image: "https://via.placeholder.com/200x150?text=SEIKO", hint: "Japanese watchmaker and innovator", founded: "1881" },
      { name: "CITIZEN", image: "https://via.placeholder.com/200x150?text=CITIZEN", hint: "Better starts now", founded: "1918" },
      { name: "TISSOT", image: "https://via.placeholder.com/200x150?text=TISSOT", hint: "Swiss watchmaker since 1853", founded: "1853" },
      { name: "TIMEX", image: "https://via.placeholder.com/200x150?text=TIMEX", hint: "Takes a licking and keeps on ticking", founded: "1854" },
      { name: "FOSSIL", image: "https://via.placeholder.com/200x150?text=FOSSIL", hint: "American fashion watch brand", founded: "1984" },
      { name: "SWATCH", image: "https://via.placeholder.com/200x150?text=SWATCH", hint: "Colorful Swiss plastic watches", founded: "1983" }
    ];
  }

  getDefaultMediumData() {
    return [
      { name: "PATEK PHILIPPE", image: "https://via.placeholder.com/200x150?text=PATEK", hint: "You never actually own one", founded: "1839" },
      { name: "AUDEMARS PIGUET", image: "https://via.placeholder.com/200x150?text=AP", hint: "Royal Oak is their iconic model", founded: "1875" },
      { name: "VACHERON CONSTANTIN", image: "https://via.placeholder.com/200x150?text=VC", hint: "Oldest Swiss watch manufacturer", founded: "1755" },
      { name: "BREITLING", image: "https://via.placeholder.com/200x150?text=BREITLING", hint: "Instruments for professionals", founded: "1884" },
      { name: "IWC", image: "https://via.placeholder.com/200x150?text=IWC", hint: "International Watch Company", founded: "1868" },
      { name: "PANERAI", image: "https://via.placeholder.com/200x150?text=PANERAI", hint: "Italian luxury watch manufacturer", founded: "1860" },
      { name: "ZENITH", image: "https://via.placeholder.com/200x150?text=ZENITH", hint: "El Primero movement", founded: "1865" },
      { name: "HUBLOT", image: "https://via.placeholder.com/200x150?text=HUBLOT", hint: "The Art of Fusion", founded: "1980" },
      { name: "LONGINES", image: "https://via.placeholder.com/200x150?text=LONGINES", hint: "Elegance is an attitude", founded: "1832" },
      { name: "TUDOR", image: "https://via.placeholder.com/200x150?text=TUDOR", hint: "Sister brand to Rolex", founded: "1926" }
    ];
  }

  getDefaultHardData() {
    return [
      { name: "A LANGE SOHNE", image: "https://via.placeholder.com/200x150?text=LANGE", hint: "German haute horlogerie", founded: "1845" },
      { name: "JAEGER LECOULTRE", image: "https://via.placeholder.com/200x150?text=JLC", hint: "Reverso is their signature model", founded: "1833" },
      { name: "BLANCPAIN", image: "https://via.placeholder.com/200x150?text=BLANCPAIN", hint: "Oldest watch brand", founded: "1735" },
      { name: "BREGUET", image: "https://via.placeholder.com/200x150?text=BREGUET", hint: "Invented the tourbillon", founded: "1775" },
      { name: "GLASHÜTTE ORIGINAL", image: "https://via.placeholder.com/200x150?text=GO", hint: "German precision watchmaker", founded: "1845" },
      { name: "GIRARD PERREGAUX", image: "https://via.placeholder.com/200x150?text=GP", hint: "Three gold bridges", founded: "1791" },
      { name: "ULYSSE NARDIN", image: "https://via.placeholder.com/200x150?text=UN", hint: "Marine chronometers", founded: "1846" },
      { name: "PIAGET", image: "https://via.placeholder.com/200x150?text=PIAGET", hint: "Ultra-thin movements", founded: "1874" },
      { name: "CHOPARD", image: "https://via.placeholder.com/200x150?text=CHOPARD", hint: "Happy Diamonds collection", founded: "1860" },
      { name: "ROGER DUBUIS", image: "https://via.placeholder.com/200x150?text=RD", hint: "Hyper Horology", founded: "1995" }
    ];
  }
}
