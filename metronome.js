// 私有变量
let bpm = 80;
let isRunning = false;
let currentBeat = 0;
let beatsPerMeasure = 4;
let subBeats = 1;
let totalBeats = 4;
let audioContext = null;
let nextBeatTimeout = null;
let soundBuffers = {};
let selectedSound = 'wood';
let isLoadingAudio = false; // 音频加载状态标记

// 音频文件路径映射
const soundFiles = {
    wood: './sounds/wood.mp3',
    electronic: './sounds/electronic.mp3',
    drum: './sounds/drum.mp3'
};

// 缓存DOM元素（避免重复查询）
const domElements = {
    metronome: null,
    rhythmSelect: null,
    soundSelect: null,
    decreaseBpm: null,
    increaseBpm: null,
    playPauseBtn: null,
    bpmValue: null
};

/**
 * 初始化DOM元素缓存
 */
function cacheDomElements() {
    domElements.metronome = document.getElementById('metronome');
    domElements.rhythmSelect = document.getElementById('rhythmSelect');
    domElements.soundSelect = document.getElementById('soundSelect');
    domElements.decreaseBpm = document.getElementById('decreaseBpm');
    domElements.increaseBpm = document.getElementById('increaseBpm');
    domElements.playPauseBtn = document.getElementById('playPauseBtn');
    domElements.bpmValue = document.getElementById('bpmValue');
}

/**
 * 初始化音频上下文
 */
function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContext.onstatechange = () => {
                if (audioContext.state === 'suspended' && isRunning) {
                    audioContext.resume().catch(err => {
                        console.log('音频恢复失败:', err);
                        showToast('请点击页面恢复音频播放');
                    });
                }
            };
        } catch (err) {
            console.error('创建音频上下文失败:', err);
            showToast('浏览器不支持音频播放');
        }
    }
    return audioContext;
}

/**
 * 预加载音频文件（带状态提示）
 */
async function preloadSounds() {
    if (isLoadingAudio) return;
    isLoadingAudio = true;
    showToast('正在加载节拍音效...');

    const ctx = initAudioContext();
    if (!ctx) {
        isLoadingAudio = false;
        return;
    }

    try {
        for (const [key, url] of Object.entries(soundFiles)) {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`加载失败: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            soundBuffers[key] = await ctx.decodeAudioData(arrayBuffer);
        }
        showToast('音效加载完成');
    } catch (err) {
        console.error('音频加载失败:', err);
        showToast('音效加载失败，将使用合成音');
    } finally {
        isLoadingAudio = false;
    }
}

/**
 * 初始化节拍设置
 * @param {string} rhythm - 节拍类型
 */
function initializeMetronomeSettings(rhythm) {
    const settings = {
        "4/4": { beats: 4, sub: 1 },
        "3/4": { beats: 3, sub: 1 },
        "6/8": { beats: 2, sub: 3 },
        "2/4": { beats: 2, sub: 1 },
        "5/4": { beats: 5, sub: 1 }
    };
    const { beats, sub } = settings[rhythm] || settings["4/4"];
    beatsPerMeasure = beats;
    subBeats = sub;
    totalBeats = beatsPerMeasure * subBeats;
}

/**
 * 播放节拍声音
 */
function playBeatSound(isFirstBeat = false, isWeakBeat = false) {
    const ctx = initAudioContext();
    if (!ctx) return;

    if (soundBuffers[selectedSound]) {
        const source = ctx.createBufferSource();
        source.buffer = soundBuffers[selectedSound];
        const gainNode = ctx.createGain();
        gainNode.gain.value = isFirstBeat ? 1.0 : isWeakBeat ? 0.5 : 0.8;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return;
    }

    // 合成音 fallback
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(
        isFirstBeat ? 659.25 : isWeakBeat ? 330 : 880, 
        ctx.currentTime
    );
    gainNode.gain.setValueAtTime(isFirstBeat ? 0.5 : 0.4, ctx.currentTime);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
}

/**
 * 节拍视觉反馈
 */
function pulseBackground() {
    if (!domElements.metronome) return;

    // 使用缓存的DOM元素
    const targetElements = [
        domElements.metronome,
        domElements.rhythmSelect,
        domElements.soundSelect,
        domElements.decreaseBpm,
        domElements.increaseBpm,
        domElements.playPauseBtn
    ];

    targetElements.forEach(el => {
        if (el) el.classList.remove('first-beat-bg', 'main-beat-bg');
    });

    const isMainBeat = currentBeat % subBeats === 0;
    const isFirstBeat = currentBeat === 0;

    if (isFirstBeat) {
        targetElements.forEach(el => el && el.classList.add('first-beat-bg'));
    } else if (isMainBeat) {
        targetElements.forEach(el => el && el.classList.add('main-beat-bg'));
    }

    const removeDelay = isFirstBeat ? 600 : 500;
    setTimeout(() => {
        targetElements.forEach(el => {
            if (el) el.classList.remove('first-beat-bg', 'main-beat-bg');
        });
    }, removeDelay);
}

/**
 * 处理单拍逻辑
 */
function handleBeat() {
    const isMainBeat = currentBeat % subBeats === 0;
    const isFirstBeat = currentBeat === 0;
    const isWeakBeat = !isMainBeat;

    playBeatSound(isFirstBeat, isWeakBeat);
    pulseBackground();
    currentBeat = (currentBeat + 1) % totalBeats;

    if (isRunning) {
        const beatInterval = 60000 / bpm;
        nextBeatTimeout = setTimeout(handleBeat, beatInterval);
    }
}

/**
 * 开始节拍器
 */
function startMetronome() {
    if (isRunning) return;
    // 检查音频上下文状态
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(err => {
            console.log('音频启动失败:', err);
            showToast('请点击页面启用音频');
            return;
        });
    }
    isRunning = true;
    domElements.playPauseBtn.textContent = '暂停';
    currentBeat = 0;
    handleBeat();
}

/**
 * 暂停节拍器
 */
function pauseMetronome() {
    if (!isRunning) return;
    isRunning = false;
    domElements.playPauseBtn.textContent = '播放';
    clearTimeout(nextBeatTimeout);
    // 清除动画
    if (domElements.metronome) {
        domElements.metronome.classList.remove('first-beat-bg', 'main-beat-bg');
    }
}

/**
 * 设置BPM（带验证反馈）
 */
function setBpm(value) {
    const num = parseInt(value);
    if (isNaN(num)) {
        showToast('请输入数字');
        domElements.bpmValue.value = bpm;
        return;
    }
    bpm = Math.min(240, Math.max(30, num));
    domElements.bpmValue.value = bpm;
}

/**
 * 显示提示消息
 */
function showToast(message) {
    // 创建临时提示元素
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 6px 12px;
            background: rgba(0,0,0,0.7);
            color: white;
            border-radius: 4px;
            font-size: 0.9rem;
            z-index: 1000;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
        toast.remove();
    }, 2000);
}

/**
 * 初始化节拍器
 */
export function initMetronome() {
    cacheDomElements(); // 缓存DOM元素
    if (!domElements.metronome) return; // 容错处理

    // 初始化设置
    setBpm(80);
    initializeMetronomeSettings(domElements.rhythmSelect.value);
    preloadSounds();

    // 绑定事件
    domElements.decreaseBpm.addEventListener('click', () => setBpm(bpm - 1));
    domElements.increaseBpm.addEventListener('click', () => setBpm(bpm + 1));
    domElements.playPauseBtn.addEventListener('click', () => {
        isRunning ? pauseMetronome() : startMetronome();
    });
    domElements.rhythmSelect.addEventListener('change', (e) => {
        initializeMetronomeSettings(e.target.value);
    });
    domElements.soundSelect.addEventListener('change', (e) => {
        selectedSound = e.target.value;
    });
    domElements.bpmValue.addEventListener('change', (e) => setBpm(e.target.value));
    domElements.bpmValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { 
            setBpm(e.target.value); 
            e.target.blur(); 
        }
        if (e.key === 'Escape') { 
            domElements.bpmValue.value = bpm; 
            e.target.blur(); 
        }
    });

    // 点击页面恢复音频（针对浏览器自动暂停）
    document.addEventListener('click', () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    });
}