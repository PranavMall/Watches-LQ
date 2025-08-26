class GameManager {
  constructor(authManager) {
    this.authManager = authManager;
    this.currentLevel = null;
    this.currentDifficulty = 'easy';
    this.gameData = { easy: [], medium: [], hard: [] };
    this.userProgress = {
      easy: { completed: 0, scores: [] },
      medium: { completed: 0, scores: [] },
      hard: { completed: 0, scores: [] }
    };
    this.currentWord = '';
    this.currentBrand = null;
    this.guessedLetters = [];
    this.attempts = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 0;
  }

  async loadGameData() {
    try {
      // Load all difficulty levels
      const difficulties = ['easy', 'medium', 'hard'];
      
      for (const difficulty of difficulties) {
        try {
          const response = await fetch(`data/${difficulty}.json`);
          if (response.ok) {
            this.gameData[difficulty] = await response.json();
          }
        } catch (error) {
          console.warn(`Failed to load ${difficulty} data:`, error);
          // Use fallback data if file doesn't exist
          this.gameData[difficulty] = this.getFallbackData(difficulty);
        }
      }
      
      await this.loadUserProgress();
    } catch (error) {
      console.error('Failed to load game data:', error);
    }
  }

  getFallbackData(difficulty) {
    // Fallback data in case JSON files are not available
    const fallbackData = {
      easy: [
        {
          id: 1,
          name: "ROLEX",
          image: "https://w7.pngwing.com/pngs/1018/823/png-transparent-tata-motors-logo-car-tamo-racemo-philippines-car-blue-text-logo-thumbnail.png",
          hints: ["Swiss luxury watchmaker", "Crown logo", "Submariner and Daytona"],
          founded: "1905",
          description: "World's most recognized luxury watch brand known for precision and prestige."
        },
        {
          id: 2,
          name: "OMEGA",
          image: "https://w7.pngwing.com/pngs/1018/823/png-transparent-tata-motors-logo-car-tamo-racemo-philippines-car-blue-text-logo-thumbnail.png",
          hints: ["Swiss watchmaker", "Olympic timekeeper", "Speedmaster to the moon"],
          founded: "1903",
          description: "Famous for the Speedmaster worn on the moon and as Olympic timekeeper."
        }
      ],
      medium: [
        {
          id: 3,
          name: "PATEK PHILIPPE",
          image: "https://w7.pngwing.com/pngs/1018/823/png-transparent-tata-motors-logo-car-tamo-racemo-philippines-car-blue-text-logo-thumbnail.png",
          hints: ["Geneva manufacture", "Calatrava cross", "You never actually own"],
          founded: "1839",
          description: "The ultimate luxury watch manufacturer known for complications and heritage."
        }
      ],
      hard: [
        {
          id: 4,
          name: "F.P.JOURNE",
          image: "https://w7.pngwing.com/pngs/1018/823/png-transparent-tata-motors-logo-car-tamo-racemo-philippines-car-blue-text-logo-thumbnail.png",
          hints: ["Independent watchmaker", "Invenit et Fecit", "Boutique manufacture"],
          founded: "1999",
          description: "Modern independent watchmaker creating innovative high-end timepieces."
        }
      ]
    };
    
    return fallbackData[difficulty] || [];
  }

  async loadUserProgress() {
    const user = this.authManager.getCurrentUser();
    if (!user || this.authManager.isGuestUser()) {
      // For guests, use localStorage
      const savedProgress = localStorage.getItem('watches_lq_progress');
      if (savedProgress) {
        this.userProgress = JSON.parse(savedProgress);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error && error.code !== 'PGRST116') {
        console.error('Progress load error:', error);
        return;
      }

      if (data && data.length > 0) {
        // Convert array to progress object
        data.forEach(record => {
          this.userProgress[record.difficulty] = {
            completed: record.completed_levels,
            scores: record.level_scores || []
          };
        });
      }
    } catch (error) {
      console.error('Failed to load user progress:', error);
    }
  }

  async saveProgress() {
    const user = this.authManager.getCurrentUser();
    
    if (!user || this.authManager.isGuestUser()) {
      // Save to localStorage for guests
      localStorage.setItem('watches_lq_progress', JSON.stringify(this.userProgress));
      return;
    }

    try {
      // Save to Supabase for authenticated users
      for (const [difficulty, progress] of Object.entries(this.userProgress)) {
        const { error } = await supabase
          .from('user_progress')
          .upsert([
            {
              user_id: user.id,
              difficulty: difficulty,
              completed_levels: progress.completed,
              level_scores: progress.scores,
              updated_at: new Date().toISOString()
            }
          ], { onConflict: 'user_id,difficulty' });

        if (error) {
          console.error('Progress save error:', error);
        }
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }

  getDifficultyProgress(difficulty) {
    return this.userProgress[difficulty] || { completed: 0, scores: [] };
  }

  isDifficultyUnlocked(difficulty) {
    if (difficulty === 'easy') return true;
    
    const requiredDifficulty = difficulty === 'medium' ? 'easy' : 'medium';
    const requiredProgress = this.getDifficultyProgress(requiredDifficulty);
    return requiredProgress.completed >= GAME_CONFIG.unlockRequirement[difficulty];
  }

  getTotalScore() {
    let total = 0;
    Object.values(this.userProgress).forEach(progress => {
      if (progress.scores) {
        total += progress.scores.reduce((sum, score) => sum + (score || 0), 0);
      }
    });
    return total;
  }

  startLevel(difficulty, levelIndex = null) {
    this.currentDifficulty = difficulty;
    const availableLevels = this.gameData[difficulty] || [];
    
    if (levelIndex !== null && availableLevels[levelIndex]) {
      this.currentBrand = availableLevels[levelIndex];
      this.currentLevel = levelIndex;
    } else {
      // Find next uncompleted level or random level
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
    this.currentWord = this.currentBrand.name.toUpperCase();
    this.guessedLetters = [];
    this.attempts = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 0;

    return true;
  }

  generateRandomLetters() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const wordLetters = [...new Set(this.currentWord.replace(/\s/g, ''))];
    const randomLetters = [];
    
    // Add all letters from the word
    randomLetters.push(...wordLetters);
    
    // Add random letters to make it challenging
    while (randomLetters.length < 12) {
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

    this.guessedLetters.push(letter);
    this.attempts++;

    const isCorrect = this.currentWord.includes(letter);
    
    if (isCorrect) {
      // Check if word is complete
      const wordComplete = this.currentWord
        .split('')
        .every(char => char === ' ' || this.guessedLetters.includes(char));
      
      if (wordComplete) {
        this.calculateScore();
        return { success: true, correct: true, complete: true };
      }
      
      return { success: true, correct: true, complete: false };
    }
    
    return { success: true, correct: false, complete: false };
  }

  useHint() {
    if (this.hintsUsed >= this.currentBrand.hints.length) {
      return { success: false, message: 'No more hints available' };
    }

    const hint = this.currentBrand.hints[this.hintsUsed];
    this.hintsUsed++;
    
    return { success: true, hint };
  }

  revealLetter() {
    const unrevealedLetters = this.currentWord
      .split('')
      .filter((char, index) => char !== ' ' && !this.guessedLetters.includes(char));
    
    if (unrevealedLetters.length === 0) {
      return { success: false, message: 'All letters already revealed' };
    }

    const letterToReveal = unrevealedLetters[0];
    this.guessedLetters.push(letterToReveal);
    this.revealsUsed++;
    
    return { success: true, letter: letterToReveal };
  }

  calculateScore() {
    const wordLength = this.currentWord.replace(/\s/g, '').length;
    let baseScore = GAME_CONFIG.pointsPerLevel.minimum;
    
    if (this.attempts === wordLength) {
      baseScore = GAME_CONFIG.pointsPerLevel.perfect;
    } else if (this.attempts <= wordLength + 2) {
      baseScore = GAME_CONFIG.pointsPerLevel.good;
    } else if (this.attempts <= wordLength + 3) {
      baseScore = GAME_CONFIG.pointsPerLevel.okay;
    }
    
    // Deduct points for hints and reveals
    const penalties = (this.hintsUsed * GAME_CONFIG.hintCost) + 
                     (this.revealsUsed * GAME_CONFIG.revealCost);
    
    this.currentScore = Math.max(baseScore - penalties, 10); // Minimum 10 points
  }

  async completeLevel() {
    const progress = this.getDifficultyProgress(this.currentDifficulty);
    
    // Update scores array
    if (!progress.scores[this.currentLevel]) {
      progress.completed++;
    }
    progress.scores[this.currentLevel] = this.currentScore;
    
    // Save progress
    await this.saveProgress();
    
    return {
      score: this.currentScore,
      attempts: this.attempts,
      hintsUsed: this.hintsUsed,
      revealsUsed: this.revealsUsed,
      totalScore: this.getTotalScore()
    };
  }

  getDisplayWord() {
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
      total: this.gameData[this.currentDifficulty].length
    };
  }
}
