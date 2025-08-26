// Supabase Configuration
const SUPABASE_CONFIG = {
  url: 'https://xttecjpmfzisjhhlukfl.supabase.co', // Replace with your Supabase URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dGVjanBtZnppc2poaGx1a2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxODU1ODksImV4cCI6MjA3MTc2MTU4OX0.UaKYYSeWj6nkxO2EU73Eoa2zlaYdSX6CGQGyQ_33edE' // Replace with your Supabase anon key
};

// Game Configuration
const GAME_CONFIG = {
  pointsPerLevel: {
    perfect: 100,    // All letters correct on first try
    good: 75,        // ≤ 2 extra attempts
    okay: 50,        // ≤ 3 extra attempts
    minimum: 25      // More than 3 extra attempts
  },
  hintCost: 10,
  revealCost: 15,
  unlockRequirement: {
    easy: 0,         // Easy is always unlocked
    medium: 10,      // Unlock after completing 10 easy levels
    hard: 10         // Unlock after completing 10 medium levels
  },
  levelsPerDifficulty: 20
};

// Initialize Supabase (will be set in app.js)
let supabase = null;
