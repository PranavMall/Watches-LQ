// js/config.js - COMPLETE FILE WITH SUPABASE CLIENT CREATION

// Supabase Configuration
const SUPABASE_CONFIG = {
  url: 'https://xttecjpmfzisjhhlukfl.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dGVjanBtZnppc2poaGx1a2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxODU1ODksImV4cCI6MjA3MTc2MTU4OX0.UaKYYSeWj6nkxO2EU73Eoa2zlaYdSX6CGQGyQ_33edE'
};

// Game Configuration
const GAME_CONFIG = {
  pointsPerLevel: {
    perfect: 100,
    good: 75,
    okay: 50,
    minimum: 25
  },
  hintCost: 10,
  revealCost: 15,
  unlockRequirement: {
    easy: 0,
    medium: 10,
    hard: 10
  },
  levelsPerDifficulty: 20
};

// CREATE SUPABASE CLIENT RIGHT HERE IN CONFIG.JS
// This ensures it's created as soon as config loads
if (typeof supabase !== 'undefined') {
  console.log('Creating Supabase client in config.js...');
  try {
    window.supabaseClient = supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey
    );
    console.log('✅ Supabase client created successfully in config.js!');
    
    // Test it immediately
    window.supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!error) {
        console.log('✅ Supabase auth verified working!');
      } else {
        console.warn('Supabase auth test error:', error);
      }
    });
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    window.supabaseClient = null;
  }
} else {
  console.warn('⚠️ Supabase library not loaded yet when config.js ran');
  window.supabaseClient = null;
  
  // Try again after a delay
  setTimeout(() => {
    if (typeof supabase !== 'undefined' && !window.supabaseClient) {
      console.log('Retrying Supabase client creation...');
      try {
        window.supabaseClient = supabase.createClient(
          SUPABASE_CONFIG.url,
          SUPABASE_CONFIG.anonKey
        );
        console.log('✅ Supabase client created on retry!');
      } catch (error) {
        console.error('❌ Retry also failed:', error);
      }
    }
  }, 500);
}
