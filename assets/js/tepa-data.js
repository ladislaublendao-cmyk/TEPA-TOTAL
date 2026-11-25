/**
 * TEPA Performance Award 2026 ("Light Up") — Unified Realtime Data Adapter
 * Supports:
 *  1) Supabase Direct + Realtime WebSockets (Production Event)
 *  2) Local Demo / Rehearsal Realtime via BroadcastChannel + localStorage (Zero-setup Presentation)
 */
(function (global) {
  'use strict';

  var STORAGE_STATE_KEY = 'tepa_demo_state_v1';
  var DEVICE_ID_KEY = 'tepa_device_id_v1';
  var QUIZ_CACHE_KEY = 'tepa_quiz_receipt_v1';
  var VOTE_CACHE_KEY = 'tepa_vote_receipt_v1';
  var CHANNEL_NAME = 'tepa_realtime_channel_v1';
  var DEFAULT_QUIZ_ID = '00000000-0000-0000-0000-000000002026';
  var DEFAULT_QUIZ_2_ID = 'b71864e5-fd87-4b27-9f0b-4930f8f0c632';
  var DEFAULT_QUIZ_3_ID = '3dadebd5-c71d-41ef-a258-f5c96e80b7d2';
  var DEFAULT_POLL_ID = '00000000-0000-0000-0000-000000002027';

  var DEFAULT_POLLS = [
    {
      id: DEFAULT_POLL_ID,
      title: 'TEPA 2026 — Best of the Best',
      voting_headline: 'Which finalist project deserves the Best of the Best?',
      voting_subtitle: 'You have 15 finalist projects · Choose one for Best of the Best',
      poll_type: 'projects',
      is_archived: false,
      created_at: '2026-11-18T09:00:00.000Z',
      updated_at: '2026-11-18T09:00:00.000Z'
    }
  ];

  var DEFAULT_PROJECTS = [
    { id: 1,  poll_id: DEFAULT_POLL_ID, slot_number: 1,  sort_order: 1,  category_name: 'Safety & HSE',                 project_title: 'Zero Harm Smart Field Monitor',        team_name: 'HSE Operations',    is_active: true, is_archived: false },
    { id: 2,  poll_id: DEFAULT_POLL_ID, slot_number: 2,  sort_order: 2,  category_name: 'Operational Excellence',       project_title: 'Offshore Turnaround FastTrack',        team_name: 'Production Ops',    is_active: true, is_archived: false },
    { id: 3,  poll_id: DEFAULT_POLL_ID, slot_number: 3,  sort_order: 3,  category_name: 'Energy Transition',            project_title: 'Solar Microgrid Hybrid Hub',           team_name: 'New Energies',      is_active: true, is_archived: false },
    { id: 4,  poll_id: DEFAULT_POLL_ID, slot_number: 4,  sort_order: 4,  category_name: 'Digital Innovation',           project_title: 'AI Predictive Valve Guardian',         team_name: 'Digital & IT',      is_active: true, is_archived: false },
    { id: 5,  poll_id: DEFAULT_POLL_ID, slot_number: 5,  sort_order: 5,  category_name: 'Environmental Sustainability', project_title: 'Closed-Loop Water Recovery',           team_name: 'Environment Team',  is_active: true, is_archived: false },
    { id: 6,  poll_id: DEFAULT_POLL_ID, slot_number: 6,  sort_order: 6,  category_name: 'Customer Experience',          project_title: 'Bonjour Express Mobile Order',         team_name: 'Retail Marketing',  is_active: true, is_archived: false },
    { id: 7,  poll_id: DEFAULT_POLL_ID, slot_number: 7,  sort_order: 7,  category_name: 'Supply Chain & Logistics',     project_title: 'Fleet Route & Fuel Optimizer',         team_name: 'Logistics Angola',  is_active: true, is_archived: false },
    { id: 8,  poll_id: DEFAULT_POLL_ID, slot_number: 8,  sort_order: 8,  category_name: 'Retail & Service Stations',    project_title: 'Smart Forecourt EV & Solar Ready',     team_name: 'Retail Network',    is_active: true, is_archived: false },
    { id: 9,  poll_id: DEFAULT_POLL_ID, slot_number: 9,  sort_order: 9,  category_name: 'Cost Optimization',            project_title: 'Procurement Consolidation Engine',     team_name: 'Finance & Supply',  is_active: true, is_archived: false },
    { id: 10, poll_id: DEFAULT_POLL_ID, slot_number: 10, sort_order: 10, category_name: 'Talent & Culture',             project_title: 'NextGen Technical Mentorship',         team_name: 'Human Resources',   is_active: true, is_archived: false },
    { id: 11, poll_id: DEFAULT_POLL_ID, slot_number: 11, sort_order: 11, category_name: 'Asset Integrity',              project_title: 'Drone Corrosion Twin Inspection',      team_name: 'Maintenance Eng.',  is_active: true, is_archived: false },
    { id: 12, poll_id: DEFAULT_POLL_ID, slot_number: 12, sort_order: 12, category_name: 'Community Impact',             project_title: 'Luanda Youth STEM Academy',            team_name: 'CSR & Comms',       is_active: true, is_archived: false },
    { id: 13, poll_id: DEFAULT_POLL_ID, slot_number: 13, sort_order: 13, category_name: 'Process Automation',           project_title: 'Automated Permit-to-Work Flow',        team_name: 'Field Digital',     is_active: true, is_archived: false },
    { id: 14, poll_id: DEFAULT_POLL_ID, slot_number: 14, sort_order: 14, category_name: 'Renewable Solutions',          project_title: 'Off-Grid Clean Power Access',          team_name: 'Renewables Unit',   is_active: true, is_archived: false },
    { id: 15, poll_id: DEFAULT_POLL_ID, slot_number: 15, sort_order: 15, category_name: 'Smart Mobility',               project_title: 'Connected Eco-Fleet Telemetry',        team_name: 'Mobility Services', is_active: true, is_archived: false }
  ];

  var DEFAULT_QUIZZES = [
    {
      id: DEFAULT_QUIZ_ID,
      title: 'TEPA Welcome Quiz — TotalEnergies & Award',
      subtitle: 'Test your knowledge about TotalEnergies in Angola and the TEPA Performance Award 2026!',
      min_score: 4,
      voucher_enabled: true,
      voucher_title: 'Café Bonjour Breakfast Voucher',
      max_vouchers: 10,
      questions_per_page: 2,
      is_archived: false,
      created_at: '2026-11-18T09:00:00.000Z',
      updated_at: '2026-11-23T09:00:00.000Z'
    },
    {
      id: DEFAULT_QUIZ_2_ID,
      title: 'TEPA Quiz 2 — TotalEnergies EP Angola',
      subtitle: 'How well do you know TotalEnergies EP Angola, our offshore hubs, and our core values?',
      min_score: 4,
      voucher_enabled: true,
      voucher_title: 'Café Bonjour Breakfast Voucher',
      max_vouchers: 10,
      questions_per_page: 2,
      is_archived: false,
      created_at: '2026-11-18T09:05:00.000Z',
      updated_at: '2026-11-23T09:00:00.000Z'
    },
    {
      id: DEFAULT_QUIZ_3_ID,
      title: 'TEPA Quiz 3 — Multi-Energy & Innovation',
      subtitle: 'Explore TotalEnergies\' 7 energies, Net Zero 2050 ambition, and the TEPA Performance Award!',
      min_score: 4,
      voucher_enabled: true,
      voucher_title: 'Café Bonjour Breakfast Voucher',
      max_vouchers: 10,
      questions_per_page: 2,
      is_archived: false,
      created_at: '2026-11-18T09:10:00.000Z',
      updated_at: '2026-11-23T09:00:00.000Z'
    }
  ];

  var DEFAULT_QUESTIONS = [
    // QUIZ 1: TEPA Welcome Quiz — TotalEnergies & Award
    { id: 1,  quiz_id: DEFAULT_QUIZ_ID,   question_number: 1,  sort_order: 1, question_text: 'In which year did Total officially rebrand to TotalEnergies to reflect its transformation into a broad multi-energy company?', question_type: 'multiple_choice', options: ['2018', '2021', '2015', '2023'], correct_answer: true, correct_option: 1, is_active: true, is_archived: false },
    { id: 2,  quiz_id: DEFAULT_QUIZ_ID,   question_number: 2,  sort_order: 2, question_text: 'Which deepwater block operated by TotalEnergies EP Angola is known as the "Golden Block", home to the Girassol, Dalia, Pazflor, and CLOV FPSOs?', question_type: 'multiple_choice', options: ['Block 17', 'Block 32', 'Block 0', 'Block 14'], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 3,  quiz_id: DEFAULT_QUIZ_ID,   question_number: 3,  sort_order: 3, question_text: 'Has TotalEnergies been operating in Angola since 1953 — more than 70 years of continuous partnership?', question_type: 'yes_no', options: [], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 4,  quiz_id: DEFAULT_QUIZ_ID,   question_number: 4,  sort_order: 4, question_text: 'Which core value sits at the heart of every TotalEnergies operation worldwide as our non-negotiable #1 priority?', question_type: 'multiple_choice', options: ['Speed at Any Cost', 'Short-Term Profit', 'Safety', 'Individual Competition'], correct_answer: true, correct_option: 2, is_active: true, is_archived: false },
    { id: 5,  quiz_id: DEFAULT_QUIZ_ID,   question_number: 5,  sort_order: 5, question_text: 'At the TEPA Performance Award, do 15 finalist projects (1 winner per category) pitch on stage before employees vote live for the "Best of the Best"?', question_type: 'yes_no', options: [], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 6,  quiz_id: DEFAULT_QUIZ_ID,   question_number: 6,  sort_order: 6, question_text: 'Which solar project in Huíla Province exemplifies TotalEnergies\' renewable and multi-energy transition in Angola?', question_type: 'multiple_choice', options: ['Namibe Wind Corridor', 'Luanda Geothermal Hub', 'Caculo Cabaça Hydro', 'Quilemba Solar Plant'], correct_answer: true, correct_option: 3, is_active: true, is_archived: false },
    // QUIZ 2: TEPA Quiz 2 — TotalEnergies EP Angola
    { id: 7,  quiz_id: DEFAULT_QUIZ_2_ID, question_number: 7,  sort_order: 1, question_text: 'What does the acronym TEPA stand for in our Angolan operations?', question_type: 'multiple_choice', options: ['Total Energy Power Africa', 'TotalEnergies EP Angola', 'Technical Engineering & Production Alliance', 'Trans-Equatorial Petroleum Agency'], correct_answer: true, correct_option: 1, is_active: true, is_archived: false },
    { id: 8,  quiz_id: DEFAULT_QUIZ_2_ID, question_number: 8,  sort_order: 2, question_text: 'Which pioneering FPSO came online in 2001 as the very first deepwater development hub on Block 17?', question_type: 'multiple_choice', options: ['Girassol', 'Pazflor', 'Kaombo Sul', 'Dalia'], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 9,  quiz_id: DEFAULT_QUIZ_2_ID, question_number: 9,  sort_order: 3, question_text: 'Does the ultra-deepwater Kaombo project on Block 32 operate using two converted FPSO vessels — Kaombo Norte and Kaombo Sul?', question_type: 'yes_no', options: [], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 10, quiz_id: DEFAULT_QUIZ_2_ID, question_number: 10, sort_order: 4, question_text: 'Which five values form the official core values of TotalEnergies?', question_type: 'multiple_choice', options: ['Speed, Hierarchy, Secrecy, Cost-Cutting, Exclusivity', 'Compliance, Tradition, Standardization, Caution, Uniformity', 'Safety, Respect for Each Other, Pioneer Spirit, Stand Together, Performance-Minded', 'Oil Only, Centralization, Seniority, Risk-Taking, Autonomy'], correct_answer: true, correct_option: 2, is_active: true, is_archived: false },
    { id: 11, quiz_id: DEFAULT_QUIZ_2_ID, question_number: 11, sort_order: 5, question_text: 'Is the Kaminho deepwater project in the Kwanza Basin designed with an all-electric FPSO and zero routine flaring to cut emissions?', question_type: 'yes_no', options: [], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 12, quiz_id: DEFAULT_QUIZ_2_ID, question_number: 12, sort_order: 6, question_text: 'In the TEPA Performance Award, is participation restricted only to directors with more than 15 years at the company?', question_type: 'yes_no', options: [], correct_answer: false, correct_option: 0, is_active: true, is_archived: false },
    // QUIZ 3: TEPA Quiz 3 — Multi-Energy & Innovation
    { id: 13, quiz_id: DEFAULT_QUIZ_3_ID, question_number: 13, sort_order: 1, question_text: 'How many primary energies are integrated in TotalEnergies\' multi-energy strategy (oil, natural gas, electricity, hydrogen, biomass, wind, and solar)?', question_type: 'multiple_choice', options: ['2 energies', '4 energies', '7 energies', '12 energies'], correct_answer: true, correct_option: 2, is_active: true, is_archived: false },
    { id: 14, quiz_id: DEFAULT_QUIZ_3_ID, question_number: 14, sort_order: 2, question_text: 'Which four offshore fields give their initials to the "CLOV" FPSO hub on Block 17?', question_type: 'multiple_choice', options: ['Cravo, Lírio, Orquídea, and Violeta', 'Camama, Luanda, Ondjiva, and Viana', 'Cuanza, Lobito, Ombaka, and Vale', 'Cameia, Louro, Orvalho, and Vitória'], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 15, quiz_id: DEFAULT_QUIZ_3_ID, question_number: 15, sort_order: 3, question_text: 'Do the first 10 participants who pass the Welcome Quiz win a breakfast voucher at Café Bonjour?', question_type: 'yes_no', options: [], correct_answer: true, correct_option: 0, is_active: true, is_archived: false },
    { id: 16, quiz_id: DEFAULT_QUIZ_3_ID, question_number: 16, sort_order: 4, question_text: 'Who elects the ultimate "Best of the Best" project winner among the 15 category finalists at the TEPA Performance Award?', question_type: 'multiple_choice', options: ['An external jury based in Paris', 'All employees attending the event via live mobile QR voting', 'Only department managers', 'An automated random draw'], correct_answer: true, correct_option: 1, is_active: true, is_archived: false },
    { id: 17, quiz_id: DEFAULT_QUIZ_3_ID, question_number: 17, sort_order: 5, question_text: 'Can each employee submit multiple votes during the final "Best of the Best" voting round?', question_type: 'yes_no', options: [], correct_answer: false, correct_option: 0, is_active: true, is_archived: false },
    { id: 18, quiz_id: DEFAULT_QUIZ_3_ID, question_number: 18, sort_order: 6, question_text: 'Is TotalEnergies\' climate ambition to achieve Net Zero emissions (carbon neutrality) by 2050, together with society?', question_type: 'yes_no', options: [], correct_answer: true, correct_option: 0, is_active: true, is_archived: false }
  ];

  function getConfig() {
    var cfg = global.TEPA_CONFIG || {};
    var params = new URLSearchParams(global.location ? global.location.search : '');
    var forceDemoParam = params.get('demo') === '1';
    var wpTabParam = params.get('tab') || cfg.wpAdminTab || '';
    return {
      supabaseUrl: (cfg.supabaseUrl || '').trim(),
      supabaseAnonKey: (cfg.supabaseAnonKey || '').trim(),
      forceDemo: Boolean(cfg.forceDemo) || forceDemoParam,
      isWpAdmin: cfg.isWpAdmin !== undefined ? Boolean(cfg.isWpAdmin) : true,
      requireWpAdmin: Boolean(cfg.requireWpAdmin),
      wpUserDisplay: cfg.wpUserDisplay || 'WordPress Admin',
      wpDashboardUrl: cfg.wpDashboardUrl || '',
      wpAdminTab: wpTabParam,
      wpLocale: cfg.wpLocale || '',
      defaultPin: cfg.defaultPin || '',
      assetsBase: cfg.assetsBase || '../tepa-award-theme/assets',
      homeUrl: cfg.homeUrl || '',
      quizUrl: cfg.quizUrl || 'quiz.html',
      voteUrl: cfg.voteUrl || 'vote.html',
      liveUrl: cfg.liveUrl || 'live.html',
      adminUrl: cfg.adminUrl || 'admin.html',
      emailEndpoint: (cfg.emailEndpoint || '').trim(),
      emailNonce: (cfg.emailNonce || '').trim()
    };
  }

  function isSupabaseConfigured() {
    var cfg = getConfig();
    return Boolean(
      !cfg.forceDemo &&
      cfg.supabaseUrl &&
      cfg.supabaseAnonKey
    );
  }

  function isSupabaseActive() {
    return Boolean(
      isSupabaseConfigured() &&
      global.supabase &&
      typeof global.supabase.createClient === 'function'
    );
  }

  var _sbClient = null;
  var _sbChannel = null;
  var _sbLoadPromise = null;
  var _bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

  function ensureSupabaseLoaded() {
    if (!isSupabaseConfigured()) return Promise.resolve(null);
    if (isSupabaseActive()) return Promise.resolve(getSupabase());
    if (_sbLoadPromise) return _sbLoadPromise;

    _sbLoadPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-tepa-supabase-sdk]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(getSupabase()); });
        existing.addEventListener('error', function () { reject(new Error('Failed to load Supabase SDK')); });
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.min.js';
      s.async = true;
      s.setAttribute('data-tepa-supabase-sdk', '1');
      s.onload = function () { resolve(getSupabase()); };
      s.onerror = function () { reject(new Error('Failed to load Supabase SDK')); };
      document.head.appendChild(s);
    });
    return _sbLoadPromise;
  }

  function getSupabase() {
    if (!isSupabaseActive()) return null;
    if (!_sbClient) {
      var cfg = getConfig();
      _sbClient = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        realtime: { params: { eventsPerSecond: 10 } }
      });
    }
    return _sbClient;
  }

  function randomCode(prefix, len) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < (len || 6); i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + '-' + out;
  }

  function generateUuidLike() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function getDeviceId() {
    var id = null;
    try {
      id = global.localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = generateUuidLike();
        global.localStorage.setItem(DEVICE_ID_KEY, id);
      }
    } catch (e) {
      id = generateUuidLike();
    }
    return id;
  }

  function rotateSimulatedDeviceId() {
    var fresh = generateUuidLike();
    try {
      global.localStorage.setItem(DEVICE_ID_KEY, fresh);
      global.localStorage.removeItem(QUIZ_CACHE_KEY);
      global.localStorage.removeItem(VOTE_CACHE_KEY);
    } catch (e) {}
    return fresh;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function buildSeededDemoState(withSampleActivity) {
    var sampleVotes = [];
    if (withSampleActivity !== false) {
      var distribution = [6, 9, 14, 18, 7, 11, 5, 8, 4, 6, 9, 12, 7, 5, 8];
      var idx = 1;
      for (var p = 0; p < distribution.length; p++) {
        for (var k = 0; k < distribution[p]; k++) {
          sampleVotes.push({
            id: 'seed-v-' + idx,
            poll_id: DEFAULT_POLL_ID,
            epoch: 1,
            project_id: p + 1,
            device_id: 'seed-device-' + idx,
            vote_code: 'VOTE-S' + String(idx).padStart(5, '0'),
            created_at: new Date(Date.now() - (200 - idx) * 1000).toISOString()
          });
          idx++;
        }
      }
    }

    var sampleQuiz = [];
    if (withSampleActivity !== false) {
      var demoWinners = [
        'Beatriz Domingos',
        'Carlos Manuel Silva',
        'Mateus Kiala',
        'Sofia Mendes'
      ];
      for (var i = 0; i < demoWinners.length; i++) {
        sampleQuiz.push({
          id: 'seed-q-' + (i + 1),
          full_name: demoWinners[i],
          device_id: 'seed-qdev-' + (i + 1),
          answers: { '1': 1, '2': 0, '3': true, '4': 2, '5': true, '6': 3 },
          score: 6,
          total_questions: 6,
          passed_criteria: true,
          is_voucher_winner: true,
          winner_rank: i + 1,
          unique_code: 'TEPA-DEMO0' + (i + 1),
          voucher_claimed: i === 0,
          created_at: new Date(Date.now() - (300 - i * 10) * 1000).toISOString()
        });
      }
    }

    return {
      settings: {
        id: 1,
        event_title: 'TEPA Performance Award 2026',
        active_quiz_id: DEFAULT_QUIZ_ID,
        active_poll_id: DEFAULT_POLL_ID,
        voting_headline: 'Which finalist project deserves the Best of the Best?',
        voting_subtitle: 'You have 15 finalist projects · Choose one for Best of the Best',
        quiz_open: true,
        voting_open: true,
        reveal_winner: false,
        reveal_quiz_winners: false,
        stage_mode: 'live_voting',
        live_theme: 'light',
        live_chart_type: 'horizontal',
        live_vertical_scope: 'top5',
        live_sort_mode: 'votes',
        live_show_qr: true,
        live_hide_results: false,
        min_quiz_score: 4,
        max_vouchers: 10,
        quiz_epoch: 1,
        vote_epoch: 1,
        updated_at: new Date().toISOString()
      },
      quizzes: clone(DEFAULT_QUIZZES),
      polls: clone(DEFAULT_POLLS),
      projects: clone(DEFAULT_PROJECTS),
      questions: clone(DEFAULT_QUESTIONS),
      quiz_submissions: sampleQuiz,
      votes: sampleVotes
    };
  }

  function ensureDemoMigrated(state) {
    if (!state.settings) state.settings = {};
    if (!state.settings.active_quiz_id) state.settings.active_quiz_id = DEFAULT_QUIZ_ID;
    if (!state.settings.active_poll_id) state.settings.active_poll_id = DEFAULT_POLL_ID;
    if (!state.settings.voting_headline) state.settings.voting_headline = 'Which finalist project deserves the Best of the Best?';
    if (!state.settings.voting_subtitle) state.settings.voting_subtitle = 'You have 15 finalist projects · Choose one for Best of the Best';
    if (state.settings.reveal_quiz_winners == null) state.settings.reveal_quiz_winners = false;
    if (!state.settings.live_theme) state.settings.live_theme = 'light';
    if (!state.settings.live_chart_type) state.settings.live_chart_type = 'horizontal';
    if (!state.settings.live_vertical_scope) state.settings.live_vertical_scope = 'top5';
    if (!state.settings.live_sort_mode) state.settings.live_sort_mode = 'votes';
    if (state.settings.live_show_qr == null) state.settings.live_show_qr = true;
    if (state.settings.live_hide_results == null) state.settings.live_hide_results = false;
    var hasLegacyDemoQuestions = Array.isArray(state.questions) && state.questions.some(function (q) {
      return q && typeof q.question_text === 'string' && q.question_text.indexOf('most years at the company') !== -1;
    });
    if (hasLegacyDemoQuestions) {
      state.quizzes = clone(DEFAULT_QUIZZES);
      state.questions = clone(DEFAULT_QUESTIONS);
      if (state.settings.min_quiz_score === 5) {
        state.settings.min_quiz_score = 4;
      }
    }
    if (!Array.isArray(state.quizzes) || !state.quizzes.length) {
      state.quizzes = clone(DEFAULT_QUIZZES);
    }
    if (!Array.isArray(state.polls) || !state.polls.length) {
      state.polls = clone(DEFAULT_POLLS);
    }
    if (Array.isArray(state.projects)) {
      state.projects.forEach(function (p, i) {
        if (!p.poll_id) p.poll_id = state.settings.active_poll_id || DEFAULT_POLL_ID;
        if (p.sort_order == null) p.sort_order = p.slot_number || (i + 1);
        if (p.is_archived == null) p.is_archived = false;
      });
    }
    if (Array.isArray(state.quiz_submissions)) {
      state.quiz_submissions.forEach(function (sub) {
        if (sub && sub.full_name === 'Ana Paula Santos') {
          sub.full_name = 'Beatriz Domingos';
        }
      });
    }
    if (Array.isArray(state.questions)) {
      state.questions.forEach(function (q, i) {
        if (!q.quiz_id) q.quiz_id = state.settings.active_quiz_id || DEFAULT_QUIZ_ID;
        if (!q.question_type) q.question_type = 'yes_no';
        if (!Array.isArray(q.options)) q.options = [];
        if (q.correct_option == null) q.correct_option = 0;
        if (q.sort_order == null) q.sort_order = q.question_number || (i + 1);
        if (q.is_archived == null) q.is_archived = false;
      });
    }
    return state;
  }

  function loadDemoState() {
    try {
      var raw = global.localStorage.getItem(STORAGE_STATE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.projects && parsed.settings) {
          return ensureDemoMigrated(parsed);
        }
      }
    } catch (e) {}
    var seeded = buildSeededDemoState(true);
    saveDemoState(seeded, false);
    return seeded;
  }

  function notifyLocalAndTabs(eventType, payload) {
    if (_bc) {
      try {
        _bc.postMessage({ type: eventType, payload: payload || {}, ts: Date.now() });
      } catch (e) {}
    }
    try {
      global.dispatchEvent(new CustomEvent('tepa:realtime', { detail: { type: eventType, payload: payload || {} } }));
    } catch (e) {}
  }

  function saveDemoState(state, broadcast) {
    state.settings.updated_at = new Date().toISOString();
    try {
      global.localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
    } catch (e) {}
    if (broadcast !== false) {
      notifyLocalAndTabs('demo_update', { ts: Date.now() });
    }
  }

  function computeDemoDashboard(state) {
    var activePoll = (state.polls || []).find(function (pl) {
      return !pl.is_archived && pl.id === state.settings.active_poll_id;
    }) || (state.polls || []).find(function (pl) { return !pl.is_archived; }) || null;
    var activePollId = activePoll ? activePoll.id : state.settings.active_poll_id;
    var curVoteEpoch = Number(state.settings.vote_epoch || 1);

    var counts = {};
    for (var i = 0; i < state.votes.length; i++) {
      var vRow = state.votes[i];
      if ((Number(vRow.epoch || 1)) !== curVoteEpoch) continue;
      var pid = vRow.project_id;
      counts[pid] = (counts[pid] || 0) + 1;
    }

    var projectsWithVotes = state.projects
      .filter(function (p) {
        return p.is_active !== false && !p.is_archived && (!activePollId || p.poll_id === activePollId);
      })
      .sort(function (a, b) {
        return (a.sort_order || a.slot_number) - (b.sort_order || b.slot_number) || a.slot_number - b.slot_number;
      })
      .map(function (p) {
        return {
          id: p.id,
          poll_id: p.poll_id || activePollId,
          slot_number: p.slot_number,
          sort_order: p.sort_order || p.slot_number,
          category_name: p.category_name,
          project_title: p.project_title,
          team_name: p.team_name,
          is_active: p.is_active,
          votes: counts[p.id] || 0
        };
      });

    var activeQuiz = (state.quizzes || []).find(function (q) {
      return !q.is_archived && q.id === state.settings.active_quiz_id;
    }) || (state.quizzes || []).find(function (q) { return !q.is_archived; }) || null;

    var allWinners = state.quiz_submissions
      .filter(function (s) { return s.is_voucher_winner; })
      .sort(function (a, b) { return (a.winner_rank || 999) - (b.winner_rank || 999); });

    var revealQuizWinners = Boolean(state.settings.reveal_quiz_winners);
    var winners = revealQuizWinners
      ? allWinners.map(function (s) {
          return {
            winner_rank: s.winner_rank,
            display_name: s.full_name,
            code_suffix: String(s.unique_code || '').slice(-4),
            score: s.score,
            total_questions: s.total_questions,
            created_at: s.created_at
          };
        })
      : [];

    var activeVotesTotal = projectsWithVotes.reduce(function (acc, p) {
      return acc + (Number(p.votes) || 0);
    }, 0);

    return {
      settings: clone(state.settings),
      active_quiz: activeQuiz ? clone(activeQuiz) : null,
      active_poll: activePoll ? clone(activePoll) : null,
      projects_with_votes: projectsWithVotes,
      total_votes: activeVotesTotal,
      quiz_stats: {
        total_participants: state.quiz_submissions.length,
        vouchers_awarded: allWinners.length,
        max_vouchers: (activeQuiz && activeQuiz.max_vouchers) || state.settings.max_vouchers || 10,
        reveal_quiz_winners: revealQuizWinners,
        winners: winners
      }
    };
  }

  async function broadcastSupabaseSignal(eventName) {
    notifyLocalAndTabs(eventName, { ts: Date.now() });
    var sb = getSupabase();
    if (!sb || !_sbChannel) return;
    try {
      await _sbChannel.send({
        type: 'broadcast',
        event: eventName,
        payload: { ts: Date.now() }
      });
    } catch (e) {}
  }

  // =========================================================================
  // Public API
  // =========================================================================

  var TepaStore = {
    getConfig: getConfig,
    getMode: function () {
      return isSupabaseConfigured() ? 'supabase' : 'demo';
    },
    getDeviceId: getDeviceId,
    rotateSimulatedDeviceId: rotateSimulatedDeviceId,

    getCachedQuizReceipt: function (expectedEpoch) {
      try {
        var raw = global.localStorage.getItem(QUIZ_CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.device_id === getDeviceId() &&
          (!expectedEpoch || Number(parsed.epoch || 1) === Number(expectedEpoch))
        ) {
          return parsed;
        }
      } catch (e) {}
      return null;
    },

    getCachedVoteReceipt: function (expectedEpoch, expectedPollId) {
      try {
        var raw = global.localStorage.getItem(VOTE_CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.device_id === getDeviceId() &&
          (!expectedEpoch || Number(parsed.epoch || 1) === Number(expectedEpoch)) &&
          (!expectedPollId || (parsed.poll_id ? parsed.poll_id === expectedPollId : expectedPollId === DEFAULT_POLL_ID))
        ) {
          return parsed;
        }
      } catch (e) {}
      return null;
    },

    getPublicQuestions: async function () {
      if (isSupabaseConfigured()) {
        var sb = await ensureSupabaseLoaded();
        var res = await sb
          .from('tepa_public_questions')
          .select('id, question_number, question_text, is_active, quiz_id, question_type, options, sort_order')
          .order('sort_order', { ascending: true })
          .order('question_number', { ascending: true });
        if (res.error) throw res.error;
        return res.data || [];
      }
      var state = loadDemoState();
      var activeQid = state.settings.active_quiz_id;
      return state.questions
        .filter(function (q) {
          return q.is_active !== false && !q.is_archived && (!activeQid || q.quiz_id === activeQid);
        })
        .sort(function (a, b) {
          return (a.sort_order || a.question_number) - (b.sort_order || b.question_number) || a.question_number - b.question_number;
        })
        .map(function (q) {
          return {
            id: q.id,
            question_number: q.question_number,
            question_text: q.question_text,
            is_active: q.is_active,
            quiz_id: q.quiz_id,
            question_type: q.question_type || 'yes_no',
            options: Array.isArray(q.options) ? clone(q.options) : [],
            sort_order: q.sort_order || q.question_number
          };
        });
    },

    getDashboardState: async function () {
      if (isSupabaseConfigured()) {
        var sb = await ensureSupabaseLoaded();
        var res = await sb.rpc('get_live_dashboard_state');
        if (res.error) throw res.error;
        return res.data;
      }
      return computeDemoDashboard(loadDemoState());
    },

    submitQuizAttempt: async function (fullName, answersMap, email) {
      var deviceId = getDeviceId();
      var cleanName = String(fullName || '').trim();
      var cleanEmail = String(email || '').trim().toLowerCase();
      if (cleanName.length < 2) {
        return { ok: false, error: 'Please enter your full name.' };
      }
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
        return { ok: false, error: 'Please enter a valid email address.' };
      }

      if (isSupabaseConfigured()) {
        var sb = await ensureSupabaseLoaded();
        var rpcPayload = {
          p_full_name: cleanName,
          p_device_id: deviceId,
          p_answers: answersMap || {}
        };
        if (cleanEmail) {
          rpcPayload.p_email = cleanEmail;
        }
        var res = await sb.rpc('submit_quiz_attempt', rpcPayload);
        if (res.error) throw res.error;
        if (res.data && res.data.ok) {
          var normalizedRes = Object.assign({ email: cleanEmail || null }, res.data);
          if (!normalizedRes.email && cleanEmail) {
            normalizedRes.email = cleanEmail;
          }
          try {
            global.localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(Object.assign({ device_id: deviceId }, normalizedRes)));
          } catch (e) {}
          await broadcastSupabaseSignal('quiz_updated');
          return normalizedRes;
        }
        return res.data;
      }

      var state = loadDemoState();
      var activeQid = state.settings.active_quiz_id;
      var activeQuiz = (state.quizzes || []).find(function (qz) { return !qz.is_archived && qz.id === activeQid; }) || null;
      var voucherTitle = (activeQuiz && activeQuiz.voucher_title) || 'Café Bonjour Breakfast Voucher';
      var existing = state.quiz_submissions.find(function (s) { return s.device_id === deviceId; });
      if (existing) {
        return {
          ok: true,
          already_submitted: true,
          epoch: existing.epoch || state.settings.quiz_epoch || 1,
          full_name: existing.full_name,
          email: existing.email || cleanEmail || '',
          device_id: existing.device_id,
          score: existing.score,
          total_questions: existing.total_questions,
          passed_criteria: existing.passed_criteria,
          unique_code: existing.unique_code,
          voucher_title: voucherTitle,
          created_at: existing.created_at
        };
      }

      if (!state.settings.quiz_open) {
        return { ok: false, error: 'The Welcome Quiz is currently closed.' };
      }

      var activeQs = state.questions
        .filter(function (q) {
          return q.is_active !== false && !q.is_archived && (!activeQid || q.quiz_id === activeQid);
        })
        .sort(function (a, b) {
          return (a.sort_order || a.question_number) - (b.sort_order || b.question_number);
        });

      var score = 0;
      for (var i = 0; i < activeQs.length; i++) {
        var q = activeQs[i];
        var ans = answersMap && answersMap[String(q.id)] !== undefined
          ? answersMap[String(q.id)]
          : (answersMap ? answersMap[String(q.question_number)] : undefined);
        if (q.question_type === 'multiple_choice') {
          if (ans !== undefined && ans !== null && String(ans) !== '' && Number(ans) === Number(q.correct_option || 0)) {
            score++;
          }
        } else {
          if (typeof ans === 'boolean' && ans === q.correct_answer) {
            score++;
          }
        }
      }

      if (!activeQs.length) {
        return { ok: false, error: 'No active quiz questions found.' };
      }

      var minScoreCfg = (activeQuiz && activeQuiz.min_score) || state.settings.min_quiz_score || 5;
      var threshold = Math.min(minScoreCfg, activeQs.length);
      var passed = score >= threshold;
      var voucherEnabled = activeQuiz ? activeQuiz.voucher_enabled !== false : true;
      var currentWinners = state.quiz_submissions.filter(function (s) { return s.is_voucher_winner; }).length;
      var maxVouchers = (activeQuiz && activeQuiz.max_vouchers) || state.settings.max_vouchers || 10;
      var isWinner = passed && voucherEnabled && currentWinners < maxVouchers;
      var rank = isWinner ? currentWinners + 1 : null;
      var code;
      do {
        code = randomCode('TEPA', 6);
      } while (state.quiz_submissions.some(function (s) { return s.unique_code === code; }));

      var record = {
        id: generateUuidLike(),
        epoch: state.settings.quiz_epoch || 1,
        full_name: cleanName,
        email: cleanEmail || '',
        device_id: deviceId,
        answers: answersMap || {},
        score: score,
        total_questions: activeQs.length,
        passed_criteria: passed,
        is_voucher_winner: isWinner,
        winner_rank: rank,
        unique_code: code,
        voucher_title: voucherTitle,
        voucher_claimed: false,
        created_at: new Date().toISOString()
      };

      state.quiz_submissions.push(record);
      saveDemoState(state, true);

      var result = {
        ok: true,
        already_submitted: false,
        epoch: record.epoch,
        full_name: record.full_name,
        email: record.email,
        device_id: record.device_id,
        score: record.score,
        total_questions: record.total_questions,
        passed_criteria: record.passed_criteria,
        unique_code: record.unique_code,
        voucher_title: record.voucher_title,
        created_at: record.created_at
      };
      try {
        global.localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(result));
      } catch (e) {}
      return result;
    },

    sendQuizCodeEmail: async function (opts) {
      opts = opts || {};
      var email = String(opts.email || '').trim().toLowerCase();
      var uniqueCode = String(opts.uniqueCode || opts.unique_code || '').trim().toUpperCase();
      var fullName = String(opts.fullName || opts.full_name || '').trim();
      var eventTitle = String(opts.eventTitle || opts.event_title || 'TEPA Performance Award 2026').trim();
      var resend = Boolean(opts.resend);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return { ok: false, sent: false, error: 'Invalid email address.' };
      }
      if (!/^TEPA-[A-Z0-9]{6}$/.test(uniqueCode)) {
        return { ok: false, sent: false, error: 'Invalid access code.' };
      }

      var cfg = getConfig();
      if (!cfg.emailEndpoint) {
        return {
          ok: true,
          sent: false,
          simulated: true,
          message: 'Preview mode — automatic email activates on WordPress.'
        };
      }

      try {
        var headers = { 'Content-Type': 'application/json' };
        if (cfg.emailNonce) {
          headers['X-WP-Nonce'] = cfg.emailNonce;
        }
        var resp = await global.fetch(cfg.emailEndpoint, {
          method: 'POST',
          headers: headers,
          credentials: 'same-origin',
          body: JSON.stringify({
            full_name: fullName,
            email: email,
            unique_code: uniqueCode,
            event_title: eventTitle,
            resend: resend
          })
        });
        var data = null;
        try { data = await resp.json(); } catch (e) {}
        if (!resp.ok || !data || !data.ok) {
          return {
            ok: false,
            sent: false,
            error: (data && data.error) || 'Could not send email automatically.'
          };
        }
        try {
          var rawCache = global.localStorage.getItem(QUIZ_CACHE_KEY);
          if (rawCache) {
            var parsedCache = JSON.parse(rawCache);
            if (parsedCache && parsedCache.unique_code === uniqueCode) {
              parsedCache.email = email;
              parsedCache.email_sent = true;
              global.localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(parsedCache));
            }
          }
        } catch (e) {}
        return {
          ok: true,
          sent: true,
          already_sent: Boolean(data.already_sent)
        };
      } catch (err) {
        return {
          ok: false,
          sent: false,
          error: (err && err.message) || 'Network error while sending email.'
        };
      }
    },

    submitProjectVote: async function (projectId, voterName, captchaToken) {
      var deviceId = getDeviceId();
      var pid = Number(projectId);

      if (isSupabaseConfigured()) {
        var sb = await ensureSupabaseLoaded();
        var res = await sb.rpc('submit_project_vote', {
          p_project_id: pid,
          p_device_id: deviceId,
          p_voter_name: voterName || null,
          p_captcha_token: captchaToken || null
        });
        if (res.error) throw res.error;
        if (res.data && res.data.ok) {
          try {
            global.localStorage.setItem(VOTE_CACHE_KEY, JSON.stringify(Object.assign({ device_id: deviceId }, res.data)));
          } catch (e) {}
          await broadcastSupabaseSignal('vote_updated');
        }
        return res.data;
      }

      var state = loadDemoState();
      var activePollId = state.settings.active_poll_id || DEFAULT_POLL_ID;
      var curEpoch = Number(state.settings.vote_epoch || 1);
      var existing = state.votes.find(function (v) {
        if (v.device_id !== deviceId || Number(v.epoch || 1) !== curEpoch) return false;
        if (v.poll_id) return v.poll_id === activePollId;
        var vp = state.projects.find(function (pr) { return pr.id === v.project_id; });
        return !vp || !vp.poll_id || vp.poll_id === activePollId;
      });
      if (existing) {
        return Object.assign({ ok: true, already_voted: true, poll_id: activePollId, epoch: curEpoch }, existing);
      }
      if (!state.settings.voting_open) {
        return { ok: false, error: 'Voting is currently closed.' };
      }
      var project = state.projects.find(function (p) {
        return p.id === pid && p.is_active !== false && !p.is_archived && (!activePollId || p.poll_id === activePollId);
      });
      if (!project) {
        return { ok: false, error: 'Selected project or option was not found.' };
      }

      var voteCode;
      do {
        voteCode = randomCode('VOTE', 6);
      } while (state.votes.some(function (v) { return v.vote_code === voteCode; }));

      var voteRecord = {
        id: generateUuidLike(),
        poll_id: activePollId,
        epoch: curEpoch,
        project_id: pid,
        device_id: deviceId,
        voter_name: voterName || null,
        vote_code: voteCode,
        created_at: new Date().toISOString()
      };

      state.votes.push(voteRecord);
      saveDemoState(state, true);

      var out = Object.assign({ ok: true, already_voted: false }, voteRecord);
      try {
        global.localStorage.setItem(VOTE_CACHE_KEY, JSON.stringify(out));
      } catch (e) {}
      return out;
    },

    simulateParticipantAction: async function (opts) {
      opts = opts || {};
      var devId = String(opts.deviceId || ('sim-' + generateUuidLike())).trim();
      var doVote = opts.doVote !== false && Boolean(opts.projectId);
      var doQuiz = Boolean(opts.doQuiz);
      var cleanName = String(opts.fullName || 'Participante TEPA').trim() || 'Participante TEPA';

      if (isSupabaseConfigured()) {
        var sb = await ensureSupabaseLoaded();
        var sbOut = { ok: true, vote: null, quiz: null, errors: [] };

        if (doQuiz) {
          var qRes = await sb.rpc('submit_quiz_attempt', {
            p_full_name: cleanName,
            p_device_id: devId,
            p_answers: opts.answers || {}
          });
          if (qRes.error) {
            sbOut.ok = false;
            sbOut.errors.push(qRes.error.message || 'Quiz RPC error');
          } else {
            sbOut.quiz = qRes.data;
            if (qRes.data && qRes.data.ok === false) {
              sbOut.ok = false;
              sbOut.errors.push(qRes.data.error || 'Quiz rejected');
            }
          }
        }

        if (doVote) {
          var vRes = await sb.rpc('submit_project_vote', {
            p_project_id: Number(opts.projectId),
            p_device_id: devId,
            p_voter_name: cleanName
          });
          if (vRes.error) {
            sbOut.ok = false;
            sbOut.errors.push(vRes.error.message || 'Vote RPC error');
          } else {
            sbOut.vote = vRes.data;
            if (vRes.data && vRes.data.ok === false) {
              sbOut.ok = false;
              sbOut.errors.push(vRes.data.error || 'Vote rejected');
            }
          }
        }

        if (!opts.skipBroadcast) {
          notifyLocalAndTabs('sim_updated', { ts: Date.now() });
        }
        return sbOut;
      }

      var state = loadDemoState();
      var demoOut = { ok: true, vote: null, quiz: null, errors: [] };

      if (doQuiz) {
        if (!state.settings.quiz_open) {
          demoOut.ok = false;
          demoOut.errors.push('Welcome Quiz is currently closed.');
        } else {
          var activeQid = state.settings.active_quiz_id;
          var activeQuiz = (state.quizzes || []).find(function (qz) { return !qz.is_archived && qz.id === activeQid; }) || null;
          var voucherTitle = (activeQuiz && activeQuiz.voucher_title) || 'Café Bonjour Breakfast Voucher';
          var activeQs = state.questions
            .filter(function (q) {
              return q.is_active !== false && !q.is_archived && (!activeQid || q.quiz_id === activeQid);
            })
            .sort(function (a, b) {
              return (a.sort_order || a.question_number) - (b.sort_order || b.question_number);
            });

          if (!activeQs.length) {
            demoOut.ok = false;
            demoOut.errors.push('No active quiz questions found.');
          } else {
            var answersMap = opts.answers || {};
            var score = 0;
            for (var qi = 0; qi < activeQs.length; qi++) {
              var q = activeQs[qi];
              var ans = answersMap[String(q.id)] !== undefined
                ? answersMap[String(q.id)]
                : answersMap[String(q.question_number)];
              if (q.question_type === 'multiple_choice') {
                if (ans !== undefined && ans !== null && String(ans) !== '' && Number(ans) === Number(q.correct_option || 0)) {
                  score++;
                }
              } else if (typeof ans === 'boolean' && ans === q.correct_answer) {
                score++;
              }
            }
            var minScoreCfg = (activeQuiz && activeQuiz.min_score) || state.settings.min_quiz_score || 5;
            var threshold = Math.min(minScoreCfg, activeQs.length);
            var passed = score >= threshold;
            var voucherEnabled = activeQuiz ? activeQuiz.voucher_enabled !== false : true;
            var currentWinners = state.quiz_submissions.filter(function (s) { return s.is_voucher_winner; }).length;
            var maxVouchers = (activeQuiz && activeQuiz.max_vouchers) || state.settings.max_vouchers || 10;
            var isWinner = passed && voucherEnabled && currentWinners < maxVouchers;
            var rank = isWinner ? currentWinners + 1 : null;
            var code;
            do {
              code = randomCode('TEPA', 6);
            } while (state.quiz_submissions.some(function (s) { return s.unique_code === code; }));

            var qRecord = {
              id: generateUuidLike(),
              epoch: state.settings.quiz_epoch || 1,
              full_name: cleanName,
              device_id: devId,
              answers: answersMap,
              score: score,
              total_questions: activeQs.length,
              passed_criteria: passed,
              is_voucher_winner: isWinner,
              winner_rank: rank,
              unique_code: code,
              voucher_title: voucherTitle,
              voucher_claimed: false,
              created_at: new Date().toISOString()
            };
            state.quiz_submissions.push(qRecord);
            demoOut.quiz = Object.assign({ ok: true, already_submitted: false }, qRecord);
          }
        }
      }

      if (doVote) {
        var activePollId = state.settings.active_poll_id || DEFAULT_POLL_ID;
        var curEpoch = Number(state.settings.vote_epoch || 1);
        var pid = Number(opts.projectId);
        if (!state.settings.voting_open) {
          demoOut.ok = false;
          demoOut.errors.push('Voting is currently closed.');
        } else {
          var project = state.projects.find(function (p) {
            return p.id === pid && p.is_active !== false && !p.is_archived && (!activePollId || p.poll_id === activePollId);
          });
          if (!project) {
            demoOut.ok = false;
            demoOut.errors.push('Selected project or option was not found.');
          } else {
            var voteCode;
            do {
              voteCode = randomCode('VOTE', 6);
            } while (state.votes.some(function (v) { return v.vote_code === voteCode; }));

            var vRecord = {
              id: generateUuidLike(),
              poll_id: activePollId,
              epoch: curEpoch,
              project_id: pid,
              device_id: devId,
              voter_name: cleanName,
              vote_code: voteCode,
              created_at: new Date().toISOString()
            };
            state.votes.push(vRecord);
            demoOut.vote = Object.assign({ ok: true, already_voted: false }, vRecord);
          }
        }
      }

      if (demoOut.quiz || demoOut.vote) {
        saveDemoState(state, !opts.skipBroadcast);
      }
      return demoOut;
    },

    subscribeRealtime: function (onChange) {
      if (typeof onChange !== 'function') return function () {};
      var timer = null;
      var lastFire = 0;
      var MIN_INTERVAL_MS = 240;
      function trigger() {
        if (timer) return;
        var elapsed = Date.now() - lastFire;
        var wait = elapsed >= MIN_INTERVAL_MS ? 60 : Math.max(60, MIN_INTERVAL_MS - elapsed);
        timer = setTimeout(function () {
          timer = null;
          lastFire = Date.now();
          onChange();
        }, wait);
      }

      function onBcMsg() { trigger(); }
      function onStorage(ev) {
        if (!ev || ev.key === STORAGE_STATE_KEY) trigger();
      }
      function onLocal() { trigger(); }

      if (_bc) _bc.addEventListener('message', onBcMsg);
      global.addEventListener('storage', onStorage);
      global.addEventListener('tepa:realtime', onLocal);

      if (isSupabaseConfigured()) {
        var cancelled = false;
        var sbRef = null;
        var chRef = null;
        ensureSupabaseLoaded().then(function (sb) {
          if (cancelled || !sb) return;
          sbRef = sb;
          chRef = sb
            .channel('tepa-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tepa_votes' }, trigger)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tepa_quiz_feed' }, trigger)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tepa_settings' }, trigger)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tepa_projects' }, trigger)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tepa_quizzes' }, trigger)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tepa_polls' }, trigger)
            .on('broadcast', { event: 'vote_updated' }, trigger)
            .on('broadcast', { event: 'quiz_updated' }, trigger)
            .on('broadcast', { event: 'stage_updated' }, trigger)
            .subscribe();
          _sbChannel = chRef;
        }).catch(function () {});

        return function () {
          cancelled = true;
          clearTimeout(timer);
          if (_bc) _bc.removeEventListener('message', onBcMsg);
          global.removeEventListener('storage', onStorage);
          global.removeEventListener('tepa:realtime', onLocal);
          if (sbRef && chRef) {
            try { sbRef.removeChannel(chRef); } catch (e) {}
          }
        };
      }

      return function () {
        clearTimeout(timer);
        if (_bc) _bc.removeEventListener('message', onBcMsg);
        global.removeEventListener('storage', onStorage);
        global.removeEventListener('tepa:realtime', onLocal);
      };
    },

    voteGuardAdmin: async function (pin, action, payload) {
      if (isSupabaseConfigured()) {
        var sb = await ensureSupabaseLoaded();
        var res = await sb.rpc('tepa_vote_guard_admin', {
          p_pin: String(pin || '').trim(),
          p_action: String(action || ''),
          p_payload: payload || {}
        });
        if (res.error) throw res.error;
        return res.data;
      }
      return { ok: false, error: 'Available only with the live database.' };
    },

    adminAction: async function (pin, action, payload) {
      payload = payload || {};

      if (action === 'simulate_votes') {
        var count = Math.max(1, Math.min(30, Number(payload.count || 5)));
        if (isSupabaseConfigured()) {
          var sbSim = await ensureSupabaseLoaded();
          var dash = await TepaStore.getDashboardState();
          var activeProjects = (dash && dash.projects_with_votes) || [];
          if (!activeProjects.length) return { ok: false, error: 'No active options or projects.' };
          for (var s = 0; s < count; s++) {
            var pick = activeProjects[Math.floor(Math.random() * activeProjects.length)];
            await sbSim.rpc('submit_project_vote', {
              p_project_id: pick.id,
              p_device_id: 'sim-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
              p_voter_name: null
            });
          }
          await broadcastSupabaseSignal('vote_updated');
          return { ok: true, added: count };
        }

        var stSim = loadDemoState();
        var activeSimPollId = stSim.settings.active_poll_id || DEFAULT_POLL_ID;
        var simEpoch = Number(stSim.settings.vote_epoch || 1);
        var activePrj = stSim.projects.filter(function (p) {
          return p.is_active !== false && !p.is_archived && (!activeSimPollId || p.poll_id === activeSimPollId);
        });
        if (!activePrj.length) return { ok: false, error: 'No active options or projects.' };
        for (var j = 0; j < count; j++) {
          var chosen = activePrj[Math.floor(Math.random() * activePrj.length)];
          stSim.votes.push({
            id: generateUuidLike(),
            poll_id: chosen.poll_id || activeSimPollId,
            epoch: simEpoch,
            project_id: chosen.id,
            device_id: 'sim-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            voter_name: null,
            vote_code: randomCode('VOTE', 6),
            created_at: new Date().toISOString()
          });
        }
        saveDemoState(stSim, true);
        return { ok: true, added: count };
      }

      if (action === 'save_projects_bulk' || action === 'save_questions_bulk') {
        var bulkItems = Array.isArray(payload.items) ? payload.items : [];
        if (!bulkItems.length) return { ok: true, count: 0 };
        var isProjBulk = action === 'save_projects_bulk';

        if (isSupabaseConfigured()) {
          var sbBulk = await ensureSupabaseLoaded();
          var rpcName = isProjBulk ? 'save_project' : 'save_question';
          var bulkResults = await Promise.all(bulkItems.map(function (it) {
            return sbBulk.rpc('tepa_admin_action', {
              p_pin: String(pin || ''),
              p_action: rpcName,
              p_payload: it
            });
          }));
          for (var br = 0; br < bulkResults.length; br++) {
            if (bulkResults[br].error) throw bulkResults[br].error;
            if (!bulkResults[br].data || !bulkResults[br].data.ok) {
              return {
                ok: false,
                error: (bulkResults[br].data && bulkResults[br].data.error) || 'Failed to save changes.'
              };
            }
          }
          await broadcastSupabaseSignal('stage_updated');
          return { ok: true, count: bulkItems.length };
        }

        var stBulk = loadDemoState();
        bulkItems.forEach(function (it) {
          if (isProjBulk) {
            var pMatch = stBulk.projects.find(function (p) { return p.id === Number(it.id); });
            if (pMatch) {
              if (it.category_name !== undefined) pMatch.category_name = String(it.category_name).trim();
              if (it.project_title !== undefined) pMatch.project_title = String(it.project_title).trim() || pMatch.project_title;
              if (it.team_name !== undefined) pMatch.team_name = String(it.team_name).trim();
              if (it.sort_order !== undefined) pMatch.sort_order = Number(it.sort_order) || pMatch.sort_order;
              if (it.is_active !== undefined) pMatch.is_active = Boolean(it.is_active);
            }
          } else {
            var qMatch = stBulk.questions.find(function (q) { return q.id === Number(it.id); });
            if (qMatch) {
              if (it.question_text !== undefined) qMatch.question_text = String(it.question_text).trim() || qMatch.question_text;
              if (it.question_type !== undefined) qMatch.question_type = it.question_type === 'multiple_choice' ? 'multiple_choice' : 'yes_no';
              if (Array.isArray(it.options)) qMatch.options = it.options.map(function (o) { return String(o || '').trim() || 'Option'; });
              if (it.correct_answer !== undefined) qMatch.correct_answer = Boolean(it.correct_answer);
              if (it.correct_option !== undefined) qMatch.correct_option = Math.max(0, Number(it.correct_option) || 0);
              if (it.sort_order !== undefined) qMatch.sort_order = Number(it.sort_order) || qMatch.sort_order;
              if (it.is_active !== undefined) qMatch.is_active = Boolean(it.is_active);
            }
          }
        });
        saveDemoState(stBulk, true);
        return { ok: true, count: bulkItems.length };
      }

      if (isSupabaseConfigured()) {
        var sb = await ensureSupabaseLoaded();
        var res = await sb.rpc('tepa_admin_action', {
          p_pin: String(pin || ''),
          p_action: action,
          p_payload: payload
        });
        if (res.error) throw res.error;
        if (res.data && res.data.ok && action !== 'get_admin_data') {
          await broadcastSupabaseSignal('stage_updated');
        }
        return res.data;
      }

      // Demo Admin Action Implementation
      var state = loadDemoState();
      if (action === 'get_admin_data') {
        var curEpoch = Number(state.settings.vote_epoch || 1);
        var voteCounts = {};
        state.votes.forEach(function (v) {
          if (Number(v.epoch || 1) === curEpoch) {
            voteCounts[v.project_id] = (voteCounts[v.project_id] || 0) + 1;
          }
        });
        return {
          ok: true,
          settings: clone(state.settings),
          quizzes: clone((state.quizzes || []).filter(function (qz) { return !qz.is_archived; })),
          polls: clone((state.polls || []).filter(function (pl) { return !pl.is_archived; })),
          submissions: clone(state.quiz_submissions).sort(function (a, b) {
            if (a.is_voucher_winner !== b.is_voucher_winner) return a.is_voucher_winner ? -1 : 1;
            return (a.winner_rank || 9999) - (b.winner_rank || 9999);
          }),
          questions: clone((state.questions || []).filter(function (q) { return !q.is_archived; }))
            .sort(function (a, b) {
              return (a.sort_order || a.question_number) - (b.sort_order || b.question_number) || a.question_number - b.question_number;
            }),
          projects: clone((state.projects || []).filter(function (p) { return !p.is_archived; }))
            .sort(function (a, b) {
              return (a.sort_order || a.slot_number) - (b.sort_order || b.slot_number) || a.slot_number - b.slot_number;
            })
            .map(function (p) { p.votes = voteCounts[p.id] || 0; return p; })
        };
      }

      if (action === 'update_settings') {
        [
          'event_title', 'voting_headline', 'voting_subtitle',
          'quiz_open', 'voting_open', 'reveal_winner', 'reveal_quiz_winners',
          'stage_mode', 'live_theme', 'live_chart_type', 'live_vertical_scope',
          'live_sort_mode', 'live_show_qr', 'live_hide_results',
          'min_quiz_score', 'max_vouchers'
        ].forEach(function (k) {
          if (payload[k] !== undefined && payload[k] !== null) {
            state.settings[k] = payload[k];
          }
        });
        if (state.settings.active_quiz_id && (payload.min_quiz_score !== undefined || payload.max_vouchers !== undefined)) {
          var actQz = (state.quizzes || []).find(function (qz) { return qz.id === state.settings.active_quiz_id && !qz.is_archived; });
          if (actQz) {
            if (payload.min_quiz_score !== undefined) actQz.min_score = Math.max(1, Number(payload.min_quiz_score) || 1);
            if (payload.max_vouchers !== undefined) actQz.max_vouchers = Math.max(1, Number(payload.max_vouchers) || 1);
          }
        }
        if (state.settings.active_poll_id && (payload.voting_headline !== undefined || payload.voting_subtitle !== undefined)) {
          var actPl = (state.polls || []).find(function (pl) { return pl.id === state.settings.active_poll_id && !pl.is_archived; });
          if (actPl) {
            if (payload.voting_headline !== undefined) actPl.voting_headline = state.settings.voting_headline;
            if (payload.voting_subtitle !== undefined) actPl.voting_subtitle = state.settings.voting_subtitle;
            actPl.updated_at = new Date().toISOString();
          }
        }
        saveDemoState(state, true);
        return { ok: true, settings: clone(state.settings) };
      }

      if (action === 'create_quiz') {
        var newQuiz = {
          id: generateUuidLike(),
          title: String(payload.title || '').trim() || 'New Quiz',
          subtitle: String(payload.subtitle || '').trim() || 'Answer the questions below and see your score live!',
          min_score: Math.max(1, Number(payload.min_score || 3)),
          voucher_enabled: payload.voucher_enabled !== undefined ? Boolean(payload.voucher_enabled) : true,
          voucher_title: String(payload.voucher_title || '').trim() || 'Café Bonjour Breakfast Voucher',
          max_vouchers: Math.max(1, Number(payload.max_vouchers || 10)),
          questions_per_page: Math.max(1, Math.min(10, Number(payload.questions_per_page || 2))),
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        state.quizzes.push(newQuiz);
        var maxQId = state.questions.reduce(function (m, q) { return Math.max(m, Number(q.id) || 0, Number(q.question_number) || 0); }, 0);
        if (payload.source_quiz_id) {
          var srcQs = state.questions.filter(function (q) { return q.quiz_id === payload.source_quiz_id && !q.is_archived; })
            .sort(function (a, b) { return (a.sort_order || a.question_number) - (b.sort_order || b.question_number); });
          srcQs.forEach(function (sq, idx) {
            maxQId++;
            state.questions.push({
              id: maxQId,
              quiz_id: newQuiz.id,
              question_number: maxQId,
              sort_order: idx + 1,
              question_text: sq.question_text,
              question_type: sq.question_type || 'yes_no',
              options: clone(sq.options || []),
              correct_answer: Boolean(sq.correct_answer),
              correct_option: Number(sq.correct_option || 0),
              is_active: sq.is_active !== false,
              is_archived: false
            });
          });
        } else {
          maxQId++;
          state.questions.push({
            id: maxQId,
            quiz_id: newQuiz.id,
            question_number: maxQId,
            sort_order: 1,
            question_text: 'Is innovation open to every team member at TotalEnergies?',
            question_type: 'yes_no',
            options: [],
            correct_answer: true,
            correct_option: 0,
            is_active: true,
            is_archived: false
          });
        }
        saveDemoState(state, true);
        return { ok: true, quiz: clone(newQuiz) };
      }

      if (action === 'save_quiz') {
        var qz = (state.quizzes || []).find(function (item) { return item.id === payload.id && !item.is_archived; });
        if (!qz) return { ok: false, error: 'Quiz not found.' };
        if (payload.title !== undefined) qz.title = String(payload.title).trim() || qz.title;
        if (payload.subtitle !== undefined) qz.subtitle = String(payload.subtitle).trim() || qz.subtitle;
        if (payload.min_score !== undefined) qz.min_score = Math.max(1, Number(payload.min_score) || 1);
        if (payload.voucher_enabled !== undefined) qz.voucher_enabled = Boolean(payload.voucher_enabled);
        if (payload.voucher_title !== undefined) qz.voucher_title = String(payload.voucher_title).trim() || qz.voucher_title;
        if (payload.max_vouchers !== undefined) qz.max_vouchers = Math.max(1, Number(payload.max_vouchers) || 1);
        if (payload.questions_per_page !== undefined) qz.questions_per_page = Math.max(1, Math.min(10, Number(payload.questions_per_page) || 2));
        qz.updated_at = new Date().toISOString();
        if (qz.id === state.settings.active_quiz_id) {
          state.settings.min_quiz_score = qz.min_score;
          state.settings.max_vouchers = qz.max_vouchers;
        }
        saveDemoState(state, true);
        return { ok: true, quiz: clone(qz) };
      }

      if (action === 'activate_quiz') {
        var actQ = (state.quizzes || []).find(function (item) { return item.id === payload.id && !item.is_archived; });
        if (!actQ) return { ok: false, error: 'Selected quiz was not found.' };
        state.settings.active_quiz_id = actQ.id;
        state.settings.min_quiz_score = actQ.min_score || 5;
        state.settings.max_vouchers = actQ.max_vouchers || 10;
        if (payload.reset_round) {
          state.quiz_submissions = [];
          state.settings.quiz_epoch = (state.settings.quiz_epoch || 1) + 1;
          state.settings.reveal_quiz_winners = false;
          try { global.localStorage.removeItem(QUIZ_CACHE_KEY); } catch (e) {}
        }
        saveDemoState(state, true);
        return { ok: true, settings: clone(state.settings) };
      }

      if (action === 'archive_quiz') {
        var activeQuizzes = (state.quizzes || []).filter(function (item) { return !item.is_archived; });
        if (activeQuizzes.length <= 1) {
          return { ok: false, error: 'At least one quiz must remain active in the studio.' };
        }
        var targetQ = activeQuizzes.find(function (item) { return item.id === payload.id; });
        if (targetQ) {
          targetQ.is_archived = true;
          if (state.settings.active_quiz_id === targetQ.id) {
            var nextQ = state.quizzes.find(function (item) { return !item.is_archived; });
            if (nextQ) state.settings.active_quiz_id = nextQ.id;
          }
          saveDemoState(state, true);
        }
        return { ok: true };
      }

      if (action === 'create_poll') {
        var pType = payload.poll_type === 'simple' ? 'simple' : 'projects';
        var newPoll = {
          id: generateUuidLike(),
          title: String(payload.title || '').trim() || 'New Voting Poll',
          voting_headline: String(payload.voting_headline || '').trim() || 'What should we prioritize moving forward?',
          voting_subtitle: String(payload.voting_subtitle || '').trim() || 'Choose your preferred option below',
          poll_type: pType,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        state.polls.push(newPoll);
        var maxPId = state.projects.reduce(function (m, p) { return Math.max(m, Number(p.id) || 0); }, 0);
        if (payload.source_poll_id) {
          var srcPrjs = state.projects
            .filter(function (p) { return p.poll_id === payload.source_poll_id && !p.is_archived; })
            .sort(function (a, b) { return (a.sort_order || a.slot_number) - (b.sort_order || b.slot_number); });
          srcPrjs.forEach(function (sp, idx) {
            maxPId++;
            state.projects.push({
              id: maxPId,
              poll_id: newPoll.id,
              slot_number: idx + 1,
              sort_order: idx + 1,
              category_name: sp.category_name || '',
              project_title: sp.project_title,
              team_name: sp.team_name || '',
              is_active: sp.is_active !== false,
              is_archived: false
            });
          });
        } else if (pType === 'simple') {
          ['Option 1', 'Option 2', 'Option 3'].forEach(function (lbl, idx) {
            maxPId++;
            state.projects.push({
              id: maxPId,
              poll_id: newPoll.id,
              slot_number: idx + 1,
              sort_order: idx + 1,
              category_name: '',
              project_title: lbl,
              team_name: '',
              is_active: true,
              is_archived: false
            });
          });
        } else {
          [
            { cat: 'Safety & HSE', title: 'Finalist Project 1', team: 'Project Team' },
            { cat: 'Digital Innovation', title: 'Finalist Project 2', team: 'Project Team' }
          ].forEach(function (it, idx) {
            maxPId++;
            state.projects.push({
              id: maxPId,
              poll_id: newPoll.id,
              slot_number: idx + 1,
              sort_order: idx + 1,
              category_name: it.cat,
              project_title: it.title,
              team_name: it.team,
              is_active: true,
              is_archived: false
            });
          });
        }
        saveDemoState(state, true);
        return { ok: true, poll: clone(newPoll) };
      }

      if (action === 'save_poll') {
        var pl = (state.polls || []).find(function (item) { return item.id === payload.id && !item.is_archived; });
        if (!pl) return { ok: false, error: 'Selected voting poll was not found.' };
        if (payload.title !== undefined) pl.title = String(payload.title).trim() || pl.title;
        if (payload.voting_headline !== undefined) pl.voting_headline = String(payload.voting_headline).trim() || pl.voting_headline;
        if (payload.voting_subtitle !== undefined) pl.voting_subtitle = String(payload.voting_subtitle).trim() || pl.voting_subtitle;
        if (payload.poll_type === 'projects' || payload.poll_type === 'simple') pl.poll_type = payload.poll_type;
        pl.updated_at = new Date().toISOString();
        if (pl.id === state.settings.active_poll_id) {
          state.settings.voting_headline = pl.voting_headline;
          state.settings.voting_subtitle = pl.voting_subtitle;
        }
        saveDemoState(state, true);
        return { ok: true, poll: clone(pl) };
      }

      if (action === 'activate_poll') {
        var actP = (state.polls || []).find(function (item) { return item.id === payload.id && !item.is_archived; });
        if (!actP) return { ok: false, error: 'Selected voting poll was not found.' };
        state.settings.active_poll_id = actP.id;
        state.settings.voting_headline = actP.voting_headline;
        state.settings.voting_subtitle = actP.voting_subtitle;
        state.settings.reveal_winner = false;
        if (payload.reset_round) {
          state.settings.vote_epoch = (state.settings.vote_epoch || 1) + 1;
          try { global.localStorage.removeItem(VOTE_CACHE_KEY); } catch (e) {}
        }
        saveDemoState(state, true);
        return { ok: true, settings: clone(state.settings) };
      }

      if (action === 'archive_poll') {
        var activePolls = (state.polls || []).filter(function (item) { return !item.is_archived; });
        if (activePolls.length <= 1) {
          return { ok: false, error: 'At least one voting poll must remain active in the studio.' };
        }
        var targetP = activePolls.find(function (item) { return item.id === payload.id; });
        if (targetP) {
          targetP.is_archived = true;
          if (state.settings.active_poll_id === targetP.id) {
            var nextP = state.polls.find(function (item) { return !item.is_archived; });
            if (nextP) {
              state.settings.active_poll_id = nextP.id;
              state.settings.voting_headline = nextP.voting_headline;
              state.settings.voting_subtitle = nextP.voting_subtitle;
            }
            state.settings.reveal_winner = false;
          }
          saveDemoState(state, true);
        }
        return { ok: true };
      }

      if (action === 'create_question') {
        var targetQuizId = payload.quiz_id || state.settings.active_quiz_id;
        var nextQNum = state.questions.reduce(function (m, q) { return Math.max(m, Number(q.id) || 0, Number(q.question_number) || 0); }, 0) + 1;
        var nextQSort = state.questions
          .filter(function (q) { return q.quiz_id === targetQuizId && !q.is_archived; })
          .reduce(function (m, q) { return Math.max(m, Number(q.sort_order) || 0); }, 0) + 1;
        var createdQ = {
          id: nextQNum,
          quiz_id: targetQuizId,
          question_number: nextQNum,
          sort_order: nextQSort,
          question_text: String(payload.question_text || '').trim() || 'New Quiz Question?',
          question_type: payload.question_type === 'multiple_choice' ? 'multiple_choice' : 'yes_no',
          options: Array.isArray(payload.options) ? clone(payload.options) : ['Option A', 'Option B', 'Option C'],
          correct_answer: payload.correct_answer !== undefined ? Boolean(payload.correct_answer) : true,
          correct_option: Math.max(0, Number(payload.correct_option || 0)),
          is_active: true,
          is_archived: false
        };
        state.questions.push(createdQ);
        saveDemoState(state, true);
        return { ok: true, question: clone(createdQ) };
      }

      if (action === 'save_question') {
        var qn = state.questions.find(function (q) { return q.id === Number(payload.id); });
        if (qn) {
          if (payload.question_text !== undefined) qn.question_text = String(payload.question_text).trim() || qn.question_text;
          if (payload.question_type !== undefined) qn.question_type = payload.question_type === 'multiple_choice' ? 'multiple_choice' : 'yes_no';
          if (Array.isArray(payload.options)) qn.options = payload.options.map(function (o) { return String(o || '').trim() || 'Option'; });
          if (payload.correct_answer !== undefined) qn.correct_answer = Boolean(payload.correct_answer);
          if (payload.correct_option !== undefined) qn.correct_option = Math.max(0, Number(payload.correct_option) || 0);
          if (payload.sort_order !== undefined) qn.sort_order = Number(payload.sort_order) || qn.sort_order;
          if (payload.is_active !== undefined) qn.is_active = Boolean(payload.is_active);
          saveDemoState(state, true);
        }
        return { ok: true };
      }

      if (action === 'archive_question') {
        var aq = state.questions.find(function (q) { return q.id === Number(payload.id); });
        if (aq) {
          aq.is_archived = true;
          aq.is_active = false;
          saveDemoState(state, true);
        }
        return { ok: true };
      }

      if (action === 'reorder_questions') {
        var qIds = Array.isArray(payload.ordered_ids) ? payload.ordered_ids : [];
        qIds.forEach(function (idVal, idx) {
          var qObj = state.questions.find(function (q) { return q.id === Number(idVal); });
          if (qObj) qObj.sort_order = idx + 1;
        });
        saveDemoState(state, true);
        return { ok: true };
      }

      if (action === 'create_project') {
        var targetPollId = payload.poll_id || state.settings.active_poll_id || DEFAULT_POLL_ID;
        var pollPrjs = state.projects.filter(function (p) { return p.poll_id === targetPollId && !p.is_archived; });
        var nextSlot = pollPrjs.reduce(function (m, p) { return Math.max(m, Number(p.slot_number) || 0); }, 0) + 1;
        var nextPSort = pollPrjs.reduce(function (m, p) { return Math.max(m, Number(p.sort_order) || 0); }, 0) + 1;
        var maxPId2 = state.projects.reduce(function (m, p) { return Math.max(m, Number(p.id) || 0); }, 0);
        var createdP = {
          id: maxPId2 + 1,
          poll_id: targetPollId,
          slot_number: nextSlot,
          sort_order: nextPSort,
          category_name: payload.category_name !== undefined ? String(payload.category_name).trim() : 'Innovation',
          project_title: String(payload.project_title || '').trim() || 'New Option',
          team_name: payload.team_name !== undefined ? String(payload.team_name).trim() : '',
          is_active: true,
          is_archived: false
        };
        state.projects.push(createdP);
        saveDemoState(state, true);
        return { ok: true, project: clone(createdP) };
      }

      if (action === 'save_project') {
        var prj = state.projects.find(function (p) { return p.id === Number(payload.id); });
        if (prj) {
          if (payload.category_name !== undefined) prj.category_name = String(payload.category_name).trim();
          if (payload.project_title !== undefined) prj.project_title = String(payload.project_title).trim() || prj.project_title;
          if (payload.team_name !== undefined) prj.team_name = String(payload.team_name).trim();
          if (payload.sort_order !== undefined) prj.sort_order = Number(payload.sort_order) || prj.sort_order;
          if (payload.is_active !== undefined) prj.is_active = Boolean(payload.is_active);
          saveDemoState(state, true);
        }
        return { ok: true };
      }

      if (action === 'archive_project') {
        var ap = state.projects.find(function (p) { return p.id === Number(payload.id); });
        if (ap) {
          ap.is_archived = true;
          ap.is_active = false;
          saveDemoState(state, true);
        }
        return { ok: true };
      }

      if (action === 'reorder_projects') {
        var pIds = Array.isArray(payload.ordered_ids) ? payload.ordered_ids : [];
        pIds.forEach(function (idVal, idx) {
          var pObj = state.projects.find(function (p) { return p.id === Number(idVal); });
          if (pObj) pObj.sort_order = idx + 1;
        });
        saveDemoState(state, true);
        return { ok: true };
      }

      if (action === 'toggle_voucher_claimed') {
        var sub = state.quiz_submissions.find(function (s) { return s.id === payload.id; });
        if (sub) {
          sub.voucher_claimed = payload.voucher_claimed !== undefined ? Boolean(payload.voucher_claimed) : !sub.voucher_claimed;
          saveDemoState(state, true);
        }
        return { ok: true };
      }

      if (action === 'reset_event_data') {
        var scope = payload.scope || 'all';
        if (scope === 'votes' || scope === 'all') {
          state.votes = [];
          state.settings.vote_epoch = (state.settings.vote_epoch || 1) + 1;
        }
        if (scope === 'quiz' || scope === 'all') {
          state.quiz_submissions = [];
          state.settings.quiz_epoch = (state.settings.quiz_epoch || 1) + 1;
          state.settings.reveal_quiz_winners = false;
        }
        if (scope === 'seed') {
          state = buildSeededDemoState(true);
        } else {
          state.settings.reveal_winner = false;
        }
        try {
          if (scope === 'quiz' || scope === 'all' || scope === 'seed') global.localStorage.removeItem(QUIZ_CACHE_KEY);
          if (scope === 'votes' || scope === 'all' || scope === 'seed') global.localStorage.removeItem(VOTE_CACHE_KEY);
        } catch (e) {}
        saveDemoState(state, true);
        return { ok: true, scope: scope };
      }

      if (action === 'change_pin') {
        var nextPin = String(payload.new_pin || '').trim();
        if (nextPin.length < 4) {
          return { ok: false, error: 'New PIN must have at least 4 characters.' };
        }
        return { ok: true };
      }

      return { ok: false, error: 'Unsupported action in Demo mode.' };
    }
  };

  global.TepaStore = TepaStore;
})(window);
