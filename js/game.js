// js/game.js - Fixed Game Manager with Proper Mechanics
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
      easy: { completed: 0, scores: [], failed: [] },
      medium: { completed: 0, scores: [], failed: [] },
      hard: { completed: 0, scores: [], failed: [] }
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
    this.totalScore = 100; // Starting score
    
    // Strike system
    this.strikes = 0;
    this.maxStrikes = 3;
    this.strikesPenalty = 5; // Points lost per strike
    
    // Retry tracking
    this.retryCount = 0;
    this.maxRetries = 2;
    this.retryPenalty = 0.5; // 50% score reduction per retry
    
    // Timer
    this.timeStarted = null;
    this.timeTaken = 0;
    this.timerInterval = null;
  }

  async loadGameData() {
    console.log('Loading game data...');
    
    // Load saved total score
    const savedTotalScore = localStorage.getItem('watches_lq_total_score');
    if (savedTotalScore) {
      this.totalScore = parseInt(savedTotalScore) || 100;
    }
    
    // Load saved progress
    const savedProgress = localStorage.getItem('watches_lq_progress');
    if (savedProgress) {
      try {
        this.userProgress = JSON.parse(savedProgress);
      } catch (error) {
        console.warn('Failed to parse saved progress:', error);
      }
    }
    
    // Try to load from JSON files
    try {
      const difficulties = ['easy', 'medium', 'hard'];
      
      for (const difficulty of difficulties) {
        try {
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
              failed: record.failed_levels || []
            };
            if (record.total_score) {
              this.totalScore = record.total_score;
            }
          });
        }
      } catch (error) {
        console.warn('Failed to load user progress from server:', error);
      }
    }
  }

  async saveProgress() {
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    localStorage.setItem('watches_lq_progress', JSON.stringify(this.userProgress));
    
    const user = this.authManager.getCurrentUser();
    if (user && window.supabaseClient) {
      try {
        for (const [difficulty, progress] of Object.entries(this.userProgress)) {
          await window.supabaseClient
            .from('user_progress')
            .upsert([
              {
                user_id: user.id,
                difficulty: difficulty,
                completed_levels: progress.completed,
                level_scores: progress.scores,
                failed_levels: progress.failed || [],
                total_score: this.totalScore,
                updated_at: new Date().toISOString()
              }
            ], { onConflict: 'user_id,difficulty' });
        }
        
        await this.updateLeaderboard();
      } catch (error) {
        console.warn('Failed to save progress to server:', error);
      }
    }
  }

  async updateLeaderboard() {
    const user = this.authManager.getCurrentUser();
    if (!user || !window.supabaseClient) return;
    
    try {
      const displayName = this.authManager.getDisplayName();
      
      await window.supabaseClient
        .from('leaderboard')
        .upsert([
          {
            user_id: user.id,
            display_name: displayName,
            total_score: this.totalScore,
            levels_completed: this.getTotalLevelsCompleted(),
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'user_id' });
    } catch (error) {
      console.warn('Failed to update leaderboard:', error);
    }
  }

  getTotalLevelsCompleted() {
    let total = 0;
    Object.values(this.userProgress).forEach(progress => {
      total += progress.completed || 0;
    });
    return total;
  }

  getDifficultyProgress(difficulty) {
    return this.userProgress[difficulty] || { completed: 0, scores: [], failed: [] };
  }

  isDifficultyUnlocked(difficulty) {
    if (difficulty === 'easy') return true;
    
    const requiredDifficulty = difficulty === 'medium' ? 'easy' : 'medium';
    const requiredProgress = this.getDifficultyProgress(requiredDifficulty);
    return requiredProgress.completed >= GAME_CONFIG.unlockRequirement[difficulty];
  }

  getTotalScore() {
    return this.totalScore;
  }

  startLevel(difficulty, levelIndex = null) {
    console.log('Starting level:', difficulty, levelIndex);
    
    this.currentDifficulty = difficulty;
    const availableLevels = this.gameData[difficulty] || [];
    
    if (availableLevels.length === 0) {
      console.error('No levels available for difficulty:', difficulty);
      return false;
    }
    
    if (levelIndex !== null && availableLevels[levelIndex]) {
      this.currentBrand = availableLevels[levelIndex];
      this.currentLevel = levelIndex;
    } else {
      const progress = this.getDifficultyProgress(difficulty);
      const nextLevelIndex = progress.completed < availableLevels.length ? 
        progress.completed : Math.floor(Math.random() * availableLevels.length);
      
      this.currentBrand = availableLevels[nextLevelIndex] || availableLevels[0];
      this.currentLevel = nextLevelIndex;
    }

    if (!this.currentBrand) {
      console.error('No brand data available for level');
      return false;
    }

    // Reset game state
    this.currentWord = this.currentBrand.name.toUpperCase().replace(/[^A-Z ]/g, '');
    this.guessedLetters = [];
    this.correctGuesses = [];
    this.wrongGuesses = [];
    this.attempts = 0;
    this.strikes = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 0;
    this.levelScore = 0;
    
    // Start timer
    this.startTimer();
    
    console.log('Level started with brand:', this.currentBrand.name);
    return true;
  }

  retryLevel() {
    // Check if retry is allowed
    if (this.retryCount >= this.maxRetries) {
      return { 
        success: false, 
        message: 'No more retries available for this level' 
      };
    }
    
    // Apply retry penalty to total score
    const penalty = Math.floor(25 * this.retryPenalty);
    this.totalScore = Math.max(0, this.totalScore - penalty);
    this.retryCount++;
    
    // Reset for retry
    this.guessedLetters = [];
    this.correctGuesses = [];
    this.wrongGuesses = [];
    this.attempts = 0;
    this.strikes = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.levelScore = -penalty; // Track negative score for this attempt
    
    // Restart timer
    this.startTimer();
    
    return { 
      success: true, 
      penalty, 
      retriesLeft: this.maxRetries - this.retryCount,
      message: `Retry penalty: -${penalty} points. ${this.maxRetries - this.retryCount} retries left.`
    };
  }

  skipLevel() {
    // Skip penalty
    const skipPenalty = 30;
    this.totalScore = Math.max(0, this.totalScore - skipPenalty);
    
    // Mark level as failed
    const progress = this.getDifficultyProgress(this.currentDifficulty);
    if (!progress.failed) progress.failed = [];
    progress.failed.push(this.currentLevel);
    
    // Save progress
    this.saveProgress();
    
    return {
      success: true,
      penalty: skipPenalty,
      message: `Level skipped. -${skipPenalty} points penalty.`
    };
  }

  startTimer() {
    this.timeStarted = Date.now();
    this.timeTaken = 0;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      this.timeTaken = Math.floor((Date.now() - this.timeStarted) / 1000);
      
      // Dispatch timer update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('timer-update', { 
          detail: { time: this.timeTaken } 
        }));
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  generateRandomLetters() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const wordLetters = [...new Set(this.currentWord.replace(/\s/g, ''))];
    const randomLetters = [];
    
    // Add all letters from the word
    randomLetters.push(...wordLetters);
    
    // Add random letters to make it challenging (total 15 letters)
    while (randomLetters.length < 15) {
      const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!randomLetters.includes(randomLetter)) {
        randomLetters.push(randomLetter);
      }
    }
    
    // Shuffle the letters
    return randomLetters.sort(() => Math.random() - 0.5);
  }

  makeGuess(letter) {
    if (this.guessedLetters.includes(letter)) {
      return { success: false, message: 'Letter already guessed' };
    }

    // Check if game is already over
    if (this.strikes >= this.maxStrikes) {
      return { success: false, message: 'Game over - too many strikes!' };
    }

    this.guessedLetters.push(letter);
    this.attempts++;

    const isCorrect = this.currentWord.includes(letter);
    
    if (isCorrect) {
      this.correctGuesses.push(letter);
      
      // Check if word is complete
      const wordComplete = this.currentWord
        .split('')
        .every(char => char === ' ' || this.guessedLetters.includes(char));
      
      if (wordComplete) {
        this.stopTimer();
        this.calculateScore();
        return { 
          success: true, 
          correct: true, 
          complete: true,
          score: this.currentScore 
        };
      }
      
      return { 
        success: true, 
        correct: true, 
        complete: false 
      };
    } else {
      // Wrong guess - apply strike and penalty
      this.wrongGuesses.push(letter);
      this.strikes++;
      
      // Immediate penalty for wrong guess
      const strikePenalty = this.strikesPenalty;
      this.totalScore = Math.max(0, this.totalScore - strikePenalty);
      this.levelScore -= strikePenalty;
      
      // Update strike display
      this.updateStrikeDisplay();
      
      // Check if game over (3 strikes)
      if (this.strikes >= this.maxStrikes) {
        this.stopTimer();
        
        // Additional penalty for failing the level
        const failPenalty = 20;
        this.totalScore = Math.max(0, this.totalScore - failPenalty);
        
        return { 
          success: true, 
          correct: false, 
          complete: false, 
          gameOver: true,
          strikes: this.strikes,
          totalPenalty: (this.strikes * strikePenalty) + failPenalty,
          answer: this.currentWord
        };
      }
      
      return { 
        success: true, 
        correct: false, 
        complete: false,
        strikes: this.strikes,
        strikesLeft: this.maxStrikes - this.strikes,
        penalty: strikePenalty
      };
    }
  }

  updateStrikeDisplay() {
    // Update strike indicators
    for (let i = 1; i <= this.maxStrikes; i++) {
      const strikeEl = document.getElementById(`strike-${i}`);
      if (strikeEl) {
        if (i <= this.strikes) {
          strikeEl.classList.add('active');
        } else {
          strikeEl.classList.remove('active');
        }
      }
    }
  }

  useHint() {
    const hintCost = this.hintsUsed === 0 ? 10 : 15;
    
    if (this.totalScore < hintCost) {
      return { success: false, message: `Not enough points! You need ${hintCost} points for a hint.` };
    }
    
    if (!this.currentBrand.hints || this.hintsUsed >= this.currentBrand.hints.length) {
      return { success: false, message: 'No more hints available' };
    }

    // Deduct points
    this.totalScore -= hintCost;
    this.levelScore -= hintCost;
    
    const hint = this.currentBrand.hints[this.hintsUsed];
    this.hintsUsed++;
    
    // Save the updated score
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    
    return { success: true, hint, newTotalScore: this.totalScore };
  }

  revealLetter() {
    const revealCost = 15;
    
    if (this.totalScore < revealCost) {
      return { success: false, message: `Not enough points! You need ${revealCost} points to reveal a letter.` };
    }
    
    const unrevealedLetters = this.currentWord
      .split('')
      .filter(char => char !== ' ' && !this.guessedLetters.includes(char));
    
    if (unrevealedLetters.length === 0) {
      return { success: false, message: 'All letters already revealed' };
    }

    // Deduct points
    this.totalScore -= revealCost;
    this.levelScore -= revealCost;
    
    const letterToReveal = unrevealedLetters[0];
    this.guessedLetters.push(letterToReveal);
    this.correctGuesses.push(letterToReveal);
    this.revealsUsed++;
    
    // Save the updated score
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    
    // Check if word is complete
    const wordComplete = this.currentWord
      .split('')
      .every(char => char === ' ' || this.guessedLetters.includes(char));
    
    if (wordComplete) {
      this.stopTimer();
      this.calculateScore();
    }
    
    return { 
      success: true, 
      letter: letterToReveal, 
      newTotalScore: this.totalScore,
      complete: wordComplete
    };
  }

  calculateScore() {
    const wordLength = this.currentWord.replace(/\s/g, '').length;
    let baseScore = GAME_CONFIG.pointsPerLevel.minimum;
    
    // Base score calculation
    if (this.attempts === wordLength) {
      baseScore = GAME_CONFIG.pointsPerLevel.perfect;
    } else if (this.attempts <= wordLength + 2) {
      baseScore = GAME_CONFIG.pointsPerLevel.good;
    } else if (this.attempts <= wordLength + 3) {
      baseScore = GAME_CONFIG.pointsPerLevel.okay;
    }
    
    // Time bonus/penalty
    if (this.timeTaken < 30) {
      baseScore += 20; // Quick solve bonus
    } else if (this.timeTaken < 60) {
      baseScore += 10;
    } else if (this.timeTaken > 120) {
      baseScore -= Math.min(20, Math.floor((this.timeTaken - 120) / 10) * 2);
    }
    
    // Apply retry penalty if this was a retry
    if (this.retryCount > 0) {
      baseScore = Math.floor(baseScore * Math.pow(1 - this.retryPenalty, this.retryCount));
    }
    
    // Difficulty multiplier
    const difficultyMultiplier = {
      easy: 1,
      medium: 1.5,
      hard: 2
    };
    baseScore = Math.floor(baseScore * (difficultyMultiplier[this.currentDifficulty] || 1));
    
    // Final score (don't let it go below 0)
    this.currentScore = Math.max(0, baseScore);
    this.levelScore += this.currentScore;
    this.totalScore += this.currentScore;
  }

  canUseHint() {
    const hintCost = this.hintsUsed === 0 ? 10 : 15;
    return this.totalScore >= hintCost && 
           this.currentBrand.hints && 
           this.hintsUsed < this.currentBrand.hints.length;
  }

  canUseReveal() {
    const revealCost = 15;
    const unrevealedLetters = this.currentWord
      .split('')
      .filter(char => char !== ' ' && !this.guessedLetters.includes(char));
    return this.totalScore >= revealCost && unrevealedLetters.length > 0;
  }

  async completeLevel() {
    const progress = this.getDifficultyProgress(this.currentDifficulty);
    
    // Update scores array
    if (!progress.scores[this.currentLevel] || progress.scores[this.currentLevel] < this.currentScore) {
      if (!progress.scores[this.currentLevel]) {
        progress.completed++;
      }
      progress.scores[this.currentLevel] = this.currentScore;
    }
    
    // Reset retry count for next level
    this.retryCount = 0;
    
    // Save progress
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

  getDisplayWord() {
    if (!this.currentWord) return '';
    
    return this.currentWord
      .split('')
      .map(char => {
        if (char === ' ') return ' ';
        return this.guessedLetters.includes(char) ? char : '_';
      })
      .join('');
  }

  getCurrentBrand() {
    return this.currentBrand;
  }

  getCurrentLevelInfo() {
    return {
      difficulty: this.currentDifficulty,
      level: this.currentLevel + 1,
      total: this.gameData[this.currentDifficulty]?.length || 10,
      retriesLeft: this.maxRetries - this.retryCount
    };
  }

  // Default data methods
  getDefaultEasyData() {
    return [
      {
        id: 1,
        name: "ROLEX",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/rolex-0d36f5efd88b1d9592b7326acf018830.png",
        hints: ["Swiss luxury watchmaker", "Crown logo", "Submariner and Daytona models"],
        founded: "1905",
        description: "World's most recognized luxury watch brand known for precision and prestige."
      },
      {
        id: 2,
        name: "TUDOR",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/tudor-88d373cf4079f77b61e3eca38aa0a3fe.png",
        hints: ["Rolex sister brand", "Shield logo", "Black Bay collection"],
        founded: "1946",
        description: "Hans Wilsdorf's vision for an affordable luxury watch with Rolex heritage."
      },
      {
        id: 3,
        name: "HUBLOT",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/hublot-7c3a16a86afad59780e4e48168fca4ac.png",
        hints: ["Art of Fusion", "Big Bang collection", "Rubber straps luxury"],
        founded: "1980",
        description: "Modern luxury brand famous for innovative materials and bold designs."
      },
      {
        id: 4,
        name: "BREITLING",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/beritling-444d325a3f310076dbe1c1a8e864babf.png",
        hints: ["Aviation watches", "Navitimer model", "Swiss chronograph specialists"],
        founded: "1884",
        description: "Legendary aviation watch brand known for precision chronographs."
      },
      {
        id: 5,
        name: "CHOPARD",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/chopard-777a5f84cdc9f8fefea2c031c7625eb9.png",
        hints: ["Happy Diamonds", "Mille Miglia racing", "Swiss luxury jeweler"],
        founded: "1860",
        description: "Swiss luxury brand combining fine watchmaking with high jewelry expertise."
      }
    ];
  }

  getDefaultMediumData() {
    return [
      {
        id: 11,
        name: "AUDEMARS PIGUET",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/logoapdark-f4e9ae527f5bbbe325b8a9c6dd14a0f4.png",
        hints: ["Royal Oak model", "Octagonal bezel", "Swiss haute horlogerie"],
        founded: "1875",
        description: "Luxury Swiss manufacturer famous for the iconic Royal Oak sports watch."
      },
      {
        id: 12,
        name: "BOVET",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/bovet-transparent-background-with-white-logo-dcb0a21a81f388e3eb991d72d3892b70.png",
        hints: ["Fleurier manufacture", "Amadeo case", "Artistic timepieces"],
        founded: "1822",
        description: "Swiss luxury brand known for artistic complications and unique case designs."
      }
    ];
  }

  getDefaultHardData() {
    return [
      {
        id: 21,
        name: "FPJOURNE",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/fpj-transparent-background-with-white-logo-10cda3f2999f33f23179486fb7160be7.png",
        hints: ["Invenit et Fecit", "Independent watchmaker", "Boutique manufacture"],
        founded: "1999",
        description: "Modern independent watchmaker creating innovative high-end timepieces."
      },
      {
        id: 22,
        name: "GREUBEL FORSEY",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/greubel-forsey-96055703dce1a6ee367135b6c48785a1.png",
        hints: ["Double tourbillon", "La Chaux-de-Fonds", "Extreme complications"],
        founded: "2004",
        description: "Ultra-haute horlogerie brand specializing in complex tourbillon movements."
      }
    ];
  }
}
