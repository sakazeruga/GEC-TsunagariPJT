// ===== Supabase =====
let supabaseClient = null;
if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined'
    && SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getDeviceId() {
  let id = localStorage.getItem('fq_device_id');
  if (!id) {
    id = (crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('fq_device_id', id);
  }
  return id;
}

async function saveResultToSupabase(result) {
  if (!supabaseClient) return;
  try {
    const freeTextAnswers = {};
    S.answers.forEach(a => { if (a && a.type === 'free_text') freeTextAnswers[a.questionId] = a.value; });

    const { error } = await supabaseClient.from('diagnosis_results').insert({
      device_id: getDeviceId(),
      nickname: S.nickname,
      stage: S.stage,
      interests: S.interests,
      free_text_answers: freeTextAnswers,
      parameter_scores: result.parameterScores,
      main_character: result.mainCharacter,
      sub_character: result.subCharacter,
      is_hybrid: result.isHybrid
    });
    if (error) console.error('Supabase error:', error);
  } catch (e) {
    console.error('Supabase fail:', e);
  }
}

// ===== 状態管理 =====
let S = {
  nickname: '', stage: null, interests: [],
  currentQ: 0, answers: [], result: null, characterImage: null
};

function saveState() {
  try { localStorage.setItem('fq_state', JSON.stringify(S)); } catch (e) {}
}
function loadState() {
  try {
    const d = localStorage.getItem('fq_state');
    if (d) { const p = JSON.parse(d); if (p.result) { S = p; return true; } }
  } catch (e) {}
  return false;
}

// ===== 背景パーティクル =====
function createParticles() {
  const el = document.getElementById('gec-bg');
  if (!el) return;
  const colors = ['rgba(96,165,250,', 'rgba(37,99,235,', 'rgba(6,182,212,'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const c = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    const sz = (2 + Math.random() * 3) + 'px';
    p.style.width = sz;
    p.style.height = sz;
    p.style.background = c + '0.8)';
    el.appendChild(p);
  }
}

// ===== 画面遷移 =====
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById('screen-' + id);
  if (!t) return;
  t.classList.add('active');
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  if (id === 'reveal') renderReveal();
  if (id === 'detail') renderDetail();
  if (id === 'quest')  renderQuest();
  if (id === 'share')  renderShare();
  if (id === 'room')   renderRoom();
}

// ===== プロフィール =====
function selectStage(btn) {
  document.querySelectorAll('#stage-options button').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  S.stage = btn.dataset.value;
}
function toggleInterest(btn) {
  const v = btn.dataset.value;
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    S.interests = S.interests.filter(i => i !== v);
  } else {
    btn.classList.add('selected');
    S.interests.push(v);
  }
}
function startSurvey() {
  const nn = document.getElementById('nickname-input').value.trim();
  if (!nn) {
    const inp = document.getElementById('nickname-input');
    inp.style.borderColor = '#ef4444';
    inp.placeholder = 'ニックネームを入力してください';
    inp.focus();
    return;
  }
  S.nickname = nn;
  S.currentQ = 0;
  S.answers = QUESTIONS.map(() => null);
  goTo('survey');
  renderQ(0);
}

// ===== サーベイ =====
const SEC_LABELS = {
  vision: 'ビジョン力', action: '実行力', empathy: '共感力',
  analysis: '分析力', creative: '創造力', risk: '挑戦力',
  team: '巻き込み力', persist: '継続力'
};

function renderQ(idx) {
  const q   = QUESTIONS[idx];
  const tot = QUESTIONS.length;
  const pct = Math.round((idx / tot) * 100);

  document.getElementById('q-counter').textContent = `Q${idx+1} / ${tot}`;
  document.getElementById('survey-progress').style.width = pct + '%';
  document.getElementById('q-text').textContent = q.question;

  const secEl = document.getElementById('q-section');
  const lblEl = document.getElementById('q-type-label');

  if (q.type === 'scale') {
    secEl.textContent = SEC_LABELS[q.section] || '';
    lblEl.textContent = 'あなたの度合いを選んでください';
  } else if (q.type === 'scenario') {
    secEl.textContent = 'シナリオ選択';
    lblEl.textContent = 'あなたならどうしますか？';
  } else if (q.type === 'value') {
    secEl.textContent = '価値観';
    lblEl.textContent = 'あなたの価値観に近いものを選んでください';
  } else {
    secEl.textContent = '自由記述（スキップ可）';
    lblEl.textContent = '自由に入力してください';
  }

  document.getElementById('answer-scale').classList.add('hidden');
  document.getElementById('answer-choice').classList.add('hidden');
  document.getElementById('answer-text').classList.add('hidden');

  const nextBtn = document.getElementById('survey-next-btn');
  nextBtn.disabled = true;
  const backBtn = document.getElementById('survey-back-btn');
  backBtn.disabled = idx === 0;
  backBtn.style.opacity = idx === 0 ? '0.4' : '1';

  const existing = S.answers[idx];

  if (q.type === 'scale') {
    document.getElementById('answer-scale').classList.remove('hidden');
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
    if (existing) {
      const sel = document.querySelector(`.scale-btn[data-val="${existing.value}"]`);
      if (sel) sel.classList.add('selected');
      nextBtn.disabled = false;
    }
  } else if (q.type === 'scenario' || q.type === 'value') {
    document.getElementById('answer-choice').classList.remove('hidden');
    const box = document.getElementById('answer-choice');
    box.innerHTML = '';
    q.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'choice-btn';
      b.textContent = opt.label;
      b.dataset.param = opt.parameter;
      b.dataset.idx   = i;
      if (existing && parseInt(existing.value) === i) {
        b.classList.add('selected');
        nextBtn.disabled = false;
      }
      b.onclick = function() {
        document.querySelectorAll('.choice-btn').forEach(x => x.classList.remove('selected'));
        this.classList.add('selected');
        S.answers[idx] = { questionId: q.id, type: q.type, value: this.dataset.idx, parameter: this.dataset.param };
        nextBtn.disabled = false;
      };
      box.appendChild(b);
    });
  } else {
    document.getElementById('answer-text').classList.remove('hidden');
    const ta = document.getElementById('free-text-input');
    ta.value = (existing && existing.value) ? existing.value : '';
    nextBtn.disabled = false;
    ta.oninput = function() {
      S.answers[idx] = { questionId: q.id, type: 'free_text', value: ta.value, parameter: null };
    };
  }
}

function selectScale(btn) {
  document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const q = QUESTIONS[S.currentQ];
  S.answers[S.currentQ] = { questionId: q.id, type: 'scale', value: parseInt(btn.dataset.val), parameter: q.parameter };
  document.getElementById('survey-next-btn').disabled = false;
}

function goSurveyNext() {
  const idx = S.currentQ;
  const q   = QUESTIONS[idx];
  if (q.type === 'free_text') {
    const ta = document.getElementById('free-text-input');
    S.answers[idx] = { questionId: q.id, type: 'free_text', value: ta.value, parameter: null };
  }
  if (idx < QUESTIONS.length - 1) {
    S.currentQ++;
    renderQ(S.currentQ);
  } else {
    startAnalyzing();
  }
}

function goSurveyBack() {
  if (S.currentQ > 0) { S.currentQ--; renderQ(S.currentQ); }
}

// ===== 診断処理 =====
function startAnalyzing() {
  goTo('analyzing');
  saveState();

  const msgs   = ['ビジョン力を測定中…', '実行力を解析中…', '共感力を確認中…', '分析力をスキャン中…', '創造力を評価中…', '挑戦力を測定中…', '巻き込み力を解析中…', '継続力を確認中…', 'キャラを召喚中…'];
  const emojis = ['⚔️', '🛡️', '🙏', '🔮', '🗡️', '💰', '🧠', '✨', '🌟'];
  let mi = 0;
  const iv = setInterval(() => {
    document.getElementById('analyzing-msg').textContent = msgs[mi % msgs.length];
    document.getElementById('analyzing-emoji').textContent = emojis[mi % emojis.length];
    mi++;
  }, 550);

  const valid  = S.answers.filter(a => a !== null);
  const result = runDiagnosis(valid);
  S.result = result;
  S.characterImage = null;
  saveResultToSupabase(result);

  setTimeout(() => {
    const norm = normalizeScores(result.parameterScores);
    const map  = { vision: 'VISION', action: 'ACTION', empathy: 'EMPATHY', analysis: 'ANALYSIS', creative: 'CREATIVE', risk: 'RISK', team: 'TEAM', persist: 'PERSIST' };
    Object.entries(map).forEach(([k, K]) => {
      document.getElementById('pb-' + k).style.width = norm[K] + '%';
      document.getElementById('p-'  + k).textContent = result.parameterScores[K];
    });
  }, 400);

  setTimeout(() => { clearInterval(iv); saveState(); goTo('reveal'); }, 5000);
}

// ===== キャラ出現 =====
function renderReveal() {
  const r = S.result; if (!r) return;
  const main = CHARACTERS[r.mainCharacter];
  const sub  = CHARACTERS[r.subCharacter];
  document.getElementById('reveal-nickname').textContent   = S.nickname;
  document.getElementById('reveal-char-emoji').textContent = main.emoji;
  document.getElementById('reveal-char-name').textContent  = main.name;
  document.getElementById('reveal-char-type').textContent  = main.entrepreneurType;
  document.getElementById('reveal-char-copy').textContent  = `「${main.catchcopy}」`;
  if (sub) {
    document.getElementById('reveal-sub-emoji').textContent = sub.emoji;
    document.getElementById('reveal-sub-name').textContent  = sub.name;
    document.getElementById('reveal-sub-type').textContent  = sub.entrepreneurType;
  }
  document.getElementById('reveal-hybrid-badge').classList.toggle('hidden', !r.isHybrid);
}

// ===== 結果詳細 =====
const P_COLORS = { VISION: '#60a5fa', ACTION: '#f87171', EMPATHY: '#34d399', ANALYSIS: '#818cf8', CREATIVE: '#a78bfa', RISK: '#fbbf24', TEAM: '#22d3ee', PERSIST: '#fb923c' };

function renderDetail() {
  const r = S.result; if (!r) return;
  const main = CHARACTERS[r.mainCharacter];
  document.getElementById('detail-emoji').textContent    = main.emoji;
  document.getElementById('detail-name').textContent     = main.name;
  document.getElementById('detail-type').textContent     = main.entrepreneurType;
  document.getElementById('detail-copy').textContent     = main.catchcopy;
  document.getElementById('detail-nickname').textContent = S.nickname;

  const norm   = normalizeScores(r.parameterScores);
  const params = [['VISION','ビジョン力'],['ACTION','実行力'],['EMPATHY','共感力'],['ANALYSIS','分析力'],['CREATIVE','創造力'],['RISK','挑戦力'],['TEAM','巻き込み力'],['PERSIST','継続力']];
  document.getElementById('detail-status').innerHTML = params.map(([K,L]) => `
    <div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:0.75rem;color:rgba(255,255,255,0.5)">${L}</span>
        <span style="font-size:0.75rem;font-weight:700;color:${P_COLORS[K]}">${r.parameterScores[K]}</span>
      </div>
      <div class="status-bar"><div class="status-fill" style="width:${norm[K]}%;background:${P_COLORS[K]};transition:width 1s ease 0.3s"></div></div>
    </div>`).join('');

  document.getElementById('detail-strengths').innerHTML = main.strengths.map(s =>
    `<li style="display:flex;align-items:flex-start;gap:8px;font-size:0.9rem"><span style="color:#60a5fa;margin-top:2px">▸</span><span>${s}</span></li>`).join('');

  document.getElementById('detail-weaknesses').innerHTML = main.weaknesses.map(w =>
    `<li style="display:flex;align-items:flex-start;gap:8px;font-size:0.9rem;color:rgba(255,255,255,0.75)"><span style="color:#818cf8;margin-top:2px">◇</span><span>${w}</span></li>`).join('');

  document.getElementById('detail-compat').innerHTML = main.compatibleCharacters.map(name => {
    const c = Object.values(CHARACTERS).find(x => x.name === name);
    return c ? `<div class="gec-card" style="padding:12px;text-align:center;flex:1"><div style="font-size:1.8rem;margin-bottom:4px">${c.emoji}</div><div style="font-size:0.8rem;font-weight:700">${c.name}</div><div style="font-size:0.65rem;color:rgba(255,255,255,0.45)">${c.entrepreneurType}</div></div>` : '';
  }).join('');

  renderPortraitState();
}

// ===== AIポートレート生成 =====
function renderPortraitState() {
  const img    = document.getElementById('detail-portrait-img');
  const btn    = document.getElementById('detail-portrait-btn');
  const status = document.getElementById('detail-portrait-status');
  if (!img || !btn) return;
  status.textContent = '';
  if (S.characterImage) {
    img.src = S.characterImage;
    img.classList.remove('hidden');
    btn.textContent = '🔄 再生成';
  } else {
    img.classList.add('hidden');
    btn.textContent = '🎨 AIポートレートを生成';
  }
  updateSharePortrait();
}

function updateSharePortrait() {
  const img   = document.getElementById('share-portrait-img');
  const emoji = document.getElementById('share-emoji');
  if (!img || !emoji) return;
  if (S.characterImage) {
    img.src = S.characterImage;
    img.classList.remove('hidden');
    emoji.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    emoji.classList.remove('hidden');
  }
}

// キャラごとに作り込んだ英語プロンプト（日本語や16進カラーコードを直接混ぜると
// モデルが混乱して破綻した絵になるため、character.id単位で手書きしている）
const PORTRAIT_PROMPTS = {
  hero: 'a valiant fantasy RPG hero in ornate gold-and-orange armor, holding a glowing sword aloft, radiating charisma and bold leadership, warm sunrise lighting, heroic pose',
  warrior: 'a battle-hardened fantasy RPG warrior in rugged crimson steel armor with a large shield, mid-charge stance, fierce determined expression, dramatic red lighting',
  monk: 'a serene fantasy RPG monk healer in flowing emerald-and-white robes, hands glowing with gentle healing light, calm compassionate expression, soft green lighting',
  mage: 'a mysterious fantasy RPG mage in a deep purple hooded robe, conjuring swirling violet arcane energy with glowing runes, dramatic purple lighting',
  thief: 'a cunning fantasy RPG rogue in dark navy leather armor with twin daggers, crouched in shadow, sharp watchful eyes, moody blue-black lighting',
  merchant: 'a shrewd fantasy RPG merchant in fine amber-and-gold robes, holding a ledger and coin pouch, confident friendly smile, warm golden lighting',
  strategist: 'a calm fantasy RPG strategist in blue robes, studying a glowing holographic map, sharp intelligent gaze, cool blue lighting',
  summoner: 'a mystical fantasy RPG summoner in teal-and-cyan robes, surrounded by softly glowing spirit orbs, warm welcoming expression, ethereal teal lighting'
};

// 8パラメータそれぞれの見た目上のニュアンス。回答で高かったパラメータを
// 上位2つ選んで演出に反映し、同じキャラでも人によって見た目に差が出るようにする
const PARAM_VISUAL_HINTS = {
  VISION: 'gazing toward a distant glowing horizon',
  ACTION: 'captured mid-motion in a dynamic action pose',
  EMPATHY: 'with a warm, gentle, compassionate expression',
  ANALYSIS: 'surrounded by floating glowing data charts and diagrams',
  CREATIVE: 'surrounded by swirling magical sparks and abstract shapes',
  RISK: 'standing fearlessly at a cliff edge in dramatic wind',
  TEAM: 'flanked by faint silhouettes of loyal allies',
  PERSIST: 'weathered but unbroken, standing firm despite battle scars'
};

function topParameters(scores, n) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

function buildPortraitPrompt(main, result) {
  const base = PORTRAIT_PROMPTS[main.id] || `a fantasy RPG character embodying ${main.entrepreneurType}`;
  const hints = topParameters(result.parameterScores, 2).map(p => PARAM_VISUAL_HINTS[p]).filter(Boolean);
  const extra = hints.length ? `, ${hints.join(', ')}` : '';
  return `${base}${extra}, bust-up portrait, detailed fantasy game concept art, digital painting, highly detailed, no text, no watermark, no logo, no signature`;
}

// 回答内容から決定的なハッシュ値を作る（同じ人が初めて生成する分には毎回同じ絵になり、
// 全く同じ回答でない限り他の人とは異なるシードになる「非重複因子」として使う）
function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function computeProfileSeed(result, nickname) {
  const key = `${nickname}|${JSON.stringify(result.parameterScores)}|${result.mainCharacter}|${result.subCharacter}`;
  return hashStringToInt(key) % 1000000;
}

async function generateCharacterImage() {
  const r = S.result; if (!r) return;
  const main   = CHARACTERS[r.mainCharacter];
  const btn    = document.getElementById('detail-portrait-btn');
  const status = document.getElementById('detail-portrait-status');
  const isRegenerate = !!S.characterImage;

  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 生成中…（数秒〜十数秒かかります）';
  status.textContent = '';

  try {
    const prompt = buildPortraitPrompt(main, r);
    // 初回は回答内容から決まるシード、再生成のたびにランダムなシードで変化を出す
    const seed = isRegenerate ? Math.floor(Math.random() * 1000000) : computeProfileSeed(r, S.nickname);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    S.characterImage = dataUrl;
    saveState();
    renderPortraitState();
  } catch (e) {
    console.error('generateCharacterImage failed:', e);
    status.textContent = '⚠️ 画像生成に失敗しました。もう一度お試しください。';
    btn.textContent = originalLabel;
  } finally {
    btn.disabled = false;
  }
}

// ===== ポートレート画像のアップロード差し替え =====
function resizeImageFile(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width  = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePortraitUpload(event) {
  const file = event.target.files[0];
  event.target.value = ''; // 同じファイルを選び直せるようにリセット
  if (!file) return;

  const status = document.getElementById('detail-portrait-status');
  if (!file.type.startsWith('image/')) {
    status.textContent = '⚠️ 画像ファイルを選択してください';
    return;
  }

  try {
    S.characterImage = await resizeImageFile(file, 640);
    saveState();
    renderPortraitState();
  } catch (e) {
    console.error('handlePortraitUpload failed:', e);
    status.textContent = '⚠️ 画像の読み込みに失敗しました';
  }
}

// ===== クエスト =====
const HINTS = {
  hero:['まずアイデアを1枚の紙にまとめましょう','信頼できる3人に話す機会を作りましょう','フィードバックはメモしておきましょう'],
  warrior:['24〜48時間の期限を設定しましょう','完璧より「まず動く」を優先しましょう','小さくても実行した記録を残しましょう'],
  monk:['会話しやすい場所を選びましょう','相手の話を7割聞くことを意識しましょう','共通するキーワードを書き出しましょう'],
  mage:['アイデアを3つ書き出しましょう','「誰の何の課題か」を各アイデアに書きましょう','最も顧客に近い1つを選びましょう'],
  thief:['SNS・ニュース・街中から変化を探しましょう','「なぜ今なのか？」を分析しましょう','気になったものは記録しておきましょう'],
  merchant:['誰が・何に・いくら払うかを1文で書きましょう','類似サービスの料金も調べてみましょう','自分なりの価格感覚をつけましょう'],
  strategist:['市場・競合・顧客の3つを分けて整理しましょう','それぞれ3つずつ書き出すだけでOKです','優先すべき課題を1つ決めましょう'],
  summoner:['どんな専門性を持つ仲間が必要かリストしましょう','既存のネットワークから候補者を探しましょう','まず1人に声をかけてみましょう']
};

function renderQuest() {
  const r = S.result; if (!r) return;
  const main = CHARACTERS[r.mainCharacter];
  document.getElementById('quest-char-name').textContent  = main.name;
  document.getElementById('quest-emoji').textContent      = main.emoji;
  document.getElementById('quest-description').textContent = main.firstQuest;
  const hints = HINTS[r.mainCharacter] || ['一歩ずつ、丁寧に取り組みましょう'];
  document.getElementById('quest-hints').innerHTML = hints.map(h => `<div style="display:flex;gap:8px"><span style="color:#60a5fa">▸</span><span>${h}</span></div>`).join('');
}

// ===== 共有 =====
function renderShare() {
  const r = S.result; if (!r) return;
  const main = CHARACTERS[r.mainCharacter];
  document.getElementById('share-emoji').textContent     = main.emoji;
  document.getElementById('share-char-name').textContent = main.name;
  document.getElementById('share-char-type').textContent = main.entrepreneurType;
  document.getElementById('share-char-copy').textContent = main.catchcopy;
  document.getElementById('share-nickname').textContent  = S.nickname;
  updateSharePortrait();

  const card = document.getElementById('share-card');
  card.style.background = `linear-gradient(135deg,#06091a 0%,${main.themeColor}22 55%,#0a1e3d 100%)`;
  card.style.borderColor = `${main.themeColor}66`;

  const norm   = normalizeScores(r.parameterScores);
  const params = [['VISION','ビジョン'],['ACTION','実行'],['EMPATHY','共感'],['ANALYSIS','分析'],['CREATIVE','創造'],['RISK','挑戦'],['TEAM','巻込'],['PERSIST','継続']];
  document.getElementById('share-params').innerHTML = params.map(([K,L]) =>
    `<div style="text-align:center"><div style="font-size:0.65rem;color:rgba(255,255,255,0.4);margin-bottom:2px">${L}</div><div style="font-size:0.85rem;font-weight:700">${r.parameterScores[K]}</div></div>`).join('');

  document.getElementById('share-strengths').innerHTML = main.strengths.map(s =>
    `<span style="font-size:0.72rem;padding:4px 10px;border-radius:50px;background:${main.themeColor}22;color:${main.themeColor};border:1px solid ${main.themeColor}44">${s}</span>`).join('');

  const txt = `私の起業家タイプは「${main.name}」でした。\n${main.catchcopy}\n\nあなたはどのキャラになる？\n#FounderQuest #起業家RPG診断 #GEC`;
  document.getElementById('share-text-area').textContent = txt;
}

function copyShareText() {
  const txt = document.getElementById('share-text-area').textContent;
  const msg = document.getElementById('copy-msg');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(() => { msg.style.display='block'; setTimeout(()=>msg.style.display='none',2000); });
  } else {
    const el = document.createElement('textarea');
    el.value = txt;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 2000);
  }
}

// ===== 自己紹介カード画像 =====
function showImageMsg(text, color) {
  const msg = document.getElementById('image-msg');
  msg.textContent = text;
  msg.style.color = color;
  msg.style.display = 'block';
}

async function saveOrShareCardImage() {
  const r = S.result; if (!r) return;
  const main = CHARACTERS[r.mainCharacter];
  const btn  = document.getElementById('save-image-btn');
  const originalLabel = btn.textContent;

  btn.disabled = true;
  btn.textContent = '⏳ 生成中…';
  document.getElementById('image-msg').style.display = 'none';

  const scrollY = window.scrollY;
  try {
    const cardEl  = document.getElementById('share-card');
    const canvas  = await html2canvas(cardEl, { backgroundColor: '#06091a', scale: 2, useCORS: true });
    const blob    = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const fileName = `founder-quest_${(S.nickname || main.name).replace(/[^\w\-぀-ヿ一-鿿]/g, '')}_${main.id}.png`;
    const file     = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Founder Quest 診断結果',
          text: `私の起業家タイプは「${main.name}」でした！ #FounderQuest #GEC`
        });
        btn.textContent = originalLabel;
        btn.disabled = false;
        return;
      } catch (shareErr) {
        // ユーザーがシェアをキャンセルした場合はダウンロードにフォールバック
      }
    }

    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showImageMsg('✅ 画像を保存しました！', '#34d399');
  } catch (err) {
    console.error(err);
    showImageMsg('⚠️ 生成に失敗しました。再度お試しください。', '#f87171');
  } finally {
    window.scrollTo(0, scrollY);
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
}

// ===== マイルーム =====
function renderRoom() {
  const r = S.result; if (!r) return;
  const main = CHARACTERS[r.mainCharacter];
  document.getElementById('room-nickname').textContent    = S.nickname;
  document.getElementById('room-char-emoji').textContent  = main.emoji;
  document.getElementById('room-char-name').textContent   = main.name;
  document.getElementById('room-char-type').textContent   = main.entrepreneurType;
  document.getElementById('room-title').textContent       = main.title;
  document.getElementById('room-quest-text').textContent  = main.firstQuest;
}

function showCharMessage() {
  const r = S.result; if (!r) return;
  const main   = CHARACTERS[r.mainCharacter];
  const bubble = document.getElementById('room-message-bubble');
  document.getElementById('room-message-text').textContent = main.roomMessage;
  bubble.style.display = 'block';
  setTimeout(() => bubble.style.display = 'none', 3000);
}

// ===== リセット =====
function resetAndStart() {
  if (!confirm('診断結果がリセットされます。もう一度診断しますか？')) return;
  S = { nickname:'', stage:null, interests:[], currentQ:0, answers:[], result:null, characterImage:null };
  localStorage.removeItem('fq_state');
  document.getElementById('nickname-input').value = '';
  document.querySelectorAll('#stage-options button').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.interest-chip').forEach(b => b.classList.remove('selected'));
  goTo('top');
}

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', () => {
  createParticles();

  if (loadState() && S.result) {
    const main  = CHARACTERS[S.result.mainCharacter];
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:8px;background:rgba(6,9,26,0.92);border:1px solid rgba(96,165,250,0.3);border-radius:50px;padding:6px 10px 6px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.4);max-width:92vw;transition:opacity 0.4s ease;';
    toast.innerHTML = `
      <span style="font-size:0.78rem;color:rgba(255,255,255,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">前回の診断：${main ? main.name : ''}タイプ</span>
      <button onclick="goTo('reveal');this.parentElement.remove()" style="background:rgba(37,99,235,0.35);color:#fff;font-weight:700;border:none;border-radius:20px;padding:5px 12px;font-size:0.72rem;cursor:pointer;white-space:nowrap">見る</button>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:0.95rem;cursor:pointer;padding:2px 4px;line-height:1">×</button>`;
    document.body.appendChild(toast);
  }

  const nicknameInput = document.getElementById('nickname-input');
  if (nicknameInput) {
    nicknameInput.addEventListener('input', function() {
      this.style.borderColor = this.value.trim() ? 'rgba(96,165,250,0.5)' : 'rgba(96,165,250,0.25)';
    });
  }
});
