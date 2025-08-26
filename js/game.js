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
    this.currentWord = '';
    this.currentBrand = null;
    this.guessedLetters = [];
    this.attempts = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 0;
    this.levelScore = 30; // Starting score for each level
    this.totalScore = 30; // Initial total score
  }

  async loadGameData() {
    console.log('Loading game data...');
    
    // Load saved total score first
    const savedTotalScore = localStorage.getItem('watches_lq_total_score');
    if (savedTotalScore) {
      this.totalScore = parseInt(savedTotalScore) || 30;
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
      },
      {
        id: 6,
        name: "ORIS",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/oris-8903c65f927b5002680bbe3a07a8b26d.png",
        hints: ["Swiss independent", "Big Crown collection", "Diving watches"],
        founded: "1904",
        description: "Independent Swiss watch company known for mechanical timepieces."
      },
      {
        id: 7,
        name: "CHANEL",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/chennel-black-642a9e21e1b892040b690938d7b2f604.png",
        hints: ["French luxury fashion", "J12 collection", "Ceramic watches"],
        founded: "1910",
        description: "French fashion house creating elegant and sophisticated timepieces."
      },
      {
        id: 8,
        name: "NORQAIN",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/transparent-background-with-white-logo-6-a5ed141c0271a7f50833cec0c27b2382.png",
        hints: ["Young Swiss brand", "Adventure collection", "Neverest series"],
        founded: "2018",
        description: "New Swiss brand focused on adventure and sports timepieces."
      },
      {
        id: 9,
        name: "DOXA",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/transparent-background-with-white-logo-3-71fc0881c4bbd5d5daa4df019ebc0cd5.png",
        hints: ["Swiss dive watches", "SUB series", "Orange dial icon"],
        founded: "1889",
        description: "Swiss brand famous for professional diving watches."
      },
      {
        id: 10,
        name: "BREMONT",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/transparent-background-with-white-logo-2-358fae6c6700da45b5ec5b8767451867.png",
        hints: ["British watchmaking", "Aviation heritage", "Military watches"],
        founded: "2002",
        description: "British luxury watch company specializing in aviation and military timepieces."
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
      },
      {
        id: 13,
        name: "JACOB CO",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/jacob-blck-dadd8990d17ebba8a0b200e0fbedea4a.png",
        hints: ["New York based", "Astronomia collection", "Extravagant designs"],
        founded: "1986",
        description: "American luxury brand known for extraordinary complications and bold designs."
      },
      {
        id: 14,
        name: "ROGER DUBUIS",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/transparent-background-with-white-logo-cdd7e7c1c0aef017b839062cc097831e.png",
        hints: ["Excalibur collection", "Skeleton watches", "Geneva Seal"],
        founded: "1995",
        description: "Swiss manufacture specializing in skeleton watches and avant-garde designs."
      },
      {
        id: 15,
        name: "HYT",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/hyt-transparent-background-with-white-logo-2-730794e592290b81f5c125288e2674d2.png",
        hints: ["Liquid time display", "Hydro-mechanical", "Swiss innovation"],
        founded: "2012",
        description: "Revolutionary brand displaying time through colored liquids in tubes."
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
      },
      {
        id: 23,
        name: "VOUTILAINEN",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/transparent-background-with-white-logo-1-7499626aedae52247958b8476c16bd3d.png",
        hints: ["Finnish watchmaker", "Hand-made dials", "Independent artisan"],
        founded: "2002",
        description: "Finnish independent watchmaker renowned for artistic dials and complications."
      },
      {
        id: 24,
        name: "ARMIN STROM",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/armin-strom-203a4683bc43de1a7764b15b2d3dec98.png",
        hints: ["Swiss manufacture", "Skeleton specialists", "Racing collection"],
        founded: "1967",
        description: "Swiss manufacture specializing in skeleton movements and racing-inspired designs."
      },
      {
        id: 25,
        name: "RESSENCE",
        image: "https://www.dubaiwatchweek.com/application/files/cache/thumbnails/ressence-fe5ba46cc525d80c19df304663a32680.png",
        hints: ["Belgian innovation", "Oil-filled displays", "Type series"],
        founded: "2010",
        description: "Belgian brand revolutionizing time display with oil-filled complications."
      }
    ];
  }

  async loadUserProgress() {
    const savedProgress = localStorage.getItem('watches_lq_progress');
    if (savedProgress) {
      try {
        this.userProgress = JSON.parse(savedProgress);
      } catch (error) {
        console.warn('Failed to parse saved progress:', error);
      }
    }

    // If using Supabase and authenticated
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
              scores: record.level_scores || []
            };
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
    
    // If using Supabase and authenticated
    const user = this.authManager.getCurrentUser();
    if (user && !this.authManager.isGuestUser() && window.supabaseClient) {
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
                total_score: this.totalScore,
                updated_at: new Date().toISOString()
              }
            ], { onConflict: 'user_id,difficulty' });
        }
      } catch (error) {
        console.warn('Failed to save progress to server:', error);
      }
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
    this.attempts = 0;
    this.hintsUsed = 0;
    this.revealsUsed = 0;
    this.currentScore = 0;
    this.levelScore = 0; // Reset level score

    console.log('Level started with brand:', this.currentBrand.name);
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
    // Check if user has enough points
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
    // Check if user has enough points
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
    this.revealsUsed++;
    
    // Save the updated score
    localStorage.setItem('watches_lq_total_score', this.totalScore.toString());
    
    return { success: true, letter: letterToReveal, newTotalScore: this.totalScore };
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
    
    // Level score is the base score (hints and reveals already deducted from totalScore)
    this.levelScore += baseScore;
    this.currentScore = baseScore;
    
    // Add to total score
    this.totalScore += baseScore;
  }

  canUseHint() {
    const hintCost = this.hintsUsed === 0 ? 10 : 15;
    return this.totalScore >= hintCost && this.currentBrand.hints && this.hintsUsed < this.currentBrand.hints.length;
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
      total: this.gameData[this.currentDifficulty]?.length || 10
    };
  }
}
