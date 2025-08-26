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
      easy: { completed: 0, scores: [] },
      medium: { completed: 0, scores: [] },
      hard: { completed: 0, scores: [] }
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
    
    // New mechanics
    this.strikes = 0;
    this.maxStrikes = 3;
    this.consecutiveCorrect = 0;
    this.timeStarted = null;
    this.timeTaken = 0;
    this.timerInterval = null;
    
    // Achievements
    this.achievements = {
      speedDemon: false,  // Complete in under 30 seconds
      perfectionist: false, // No wrong guesses
      hintless: false,     // Complete without hints
      streakMaster: false  // 5 consecutive correct
    };
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
    
    // Try to load from Supabase if available
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
              scores: record.level_scores || []
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
    // Save total score
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    
    // Save progress
    localStorage.setItem('watches_lq_progress', JSON.stringify(this.userProgress));
    
    // Save to Supabase if available
    const user = this.authManager.getCurrentUser();
    if (user && window.supabaseClient) {
      try {
        // Save progress
        for (const [difficulty, progress] of Object.entries(this.userProgress)) {
          await window.supabaseClient
            .from('user_progress')
            .upsert([
              {
                user_id: user.id,
                difficulty: difficulty,
                completed_levels: progress.completed,
                level_scores: progress.scores,
                total_score: this.totalScore,
                updated_at: new Date().toISOString()
              }
            ], { onConflict: 'user_id,difficulty' });
        }
        
        // Save to leaderboard
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

  async getLeaderboard(timeframe = 'all') {
    if (!window.supabaseClient) {
      // Return local leaderboard from localStorage
      const localLeaderboard = JSON.parse(localStorage.getItem('watches_lq_leaderboard') || '[]');
      return localLeaderboard;
    }
    
    try {
      let query = window.supabaseClient
        .from('leaderboard')
        .select('*')
        .order('total_score', { ascending: false })
        .limit(10);
      
      // Add time filter
      if (timeframe === 'daily') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('updated_at', today.toISOString());
      } else if (timeframe === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('updated_at', weekAgo.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Failed to get leaderboard:', error);
      return [];
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
    return this.userProgress[difficulty] || { completed: 0, scores: [] };
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
    this.consecutiveCorrect = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 0;
    this.levelScore = 0;
    
    // Start timer
    this.startTimer();
    
    // Reset achievements
    Object.keys(this.achievements).forEach(key => {
      this.achievements[key] = false;
    });

    console.log('Level started with brand:', this.currentBrand.name);
    return true;
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

    this.guessedLetters.push(letter);
    this.attempts++;

    const isCorrect = this.currentWord.includes(letter);
    
    if (isCorrect) {
      this.correctGuesses.push(letter);
      this.consecutiveCorrect++;
      
      // Check for streak achievement
      if (this.consecutiveCorrect >= 5) {
        this.achievements.streakMaster = true;
      }
      
      // Check if word is complete
      const wordComplete = this.currentWord
        .split('')
        .every(char => char === ' ' || this.guessedLetters.includes(char));
      
      if (wordComplete) {
        this.stopTimer();
        this.calculateScore();
        return { success: true, correct: true, complete: true };
      }
      
      return { success: true, correct: true, complete: false };
    } else {
      // Wrong guess
      this.wrongGuesses.push(letter);
      this.consecutiveCorrect = 0;
      this.strikes++;
      
      // Negative scoring for wrong guesses
      this.totalScore = Math.max(0, this.totalScore - 5);
      this.levelScore -= 5;
      
      // Check if game over
      if (this.strikes >= this.maxStrikes) {
        this.stopTimer();
        return { 
          success: true, 
          correct: false, 
          complete: false, 
          gameOver: true 
        };
      }
      
      return { 
        success: true, 
        correct: false, 
        complete: false,
        strikes: this.strikes 
      };
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
      this.achievements.perfectionist = true;
    } else if (this.attempts <= wordLength + 2) {
      baseScore = GAME_CONFIG.pointsPerLevel.good;
    } else if (this.attempts <= wordLength + 3) {
      baseScore = GAME_CONFIG.pointsPerLevel.okay;
    }
    
    // Time bonus
    if (this.timeTaken < 30) {
      baseScore += 20;
      this.achievements.speedDemon = true;
    } else if (this.timeTaken < 60) {
      baseScore += 10;
    } else if (this.timeTaken > 120) {
      baseScore -= Math.min(20, Math.floor((this.timeTaken - 120) / 10) * 2);
    }
    
    // No hints bonus
    if (this.hintsUsed === 0) {
      baseScore += 10;
      this.achievements.hintless = true;
    }
    
    // Difficulty multiplier
    const difficultyMultiplier = {
      easy: 1,
      medium: 1.5,
      hard: 2
    };
    baseScore = Math.floor(baseScore * (difficultyMultiplier[this.currentDifficulty] || 1));
    
    // Final score
    this.levelScore += baseScore;
    this.currentScore = baseScore;
    this.totalScore += baseScore;
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
      totalScore: this.totalScore,
      achievements: this.achievements
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
      total: this.gameData[this.currentDifficulty]?.length || 10
    };
  }

  // Default data methods (same as before)
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
