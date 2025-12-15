/* ====== gowk.js (Переработанная логика плеера) ====== */

/* ====== Общие элементы и TWA ====== */
const API_BASE = "http://localhost:5000"; 
let tgUser = { id: null, first_name: "Пользователь", username: "" };
window.Telegram?.WebApp?.ready();
if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    tgUser = window.Telegram.WebApp.initDataUnsafe.user;
}

/* ====== Workout State & Constants ====== */
let activeWorkout = null;
let currentExIndex = 0;
// 'initial', 'running', 'paused', 'completed', 'rest'
let timerState = 'initial'; 
let totalSeconds = 0; 
let remainingSeconds = 0;
let timerInterval = null;

/* ====== Elements (gowk.html) ====== */
const topBar = document.getElementById('topBar');
const workoutTitleEl = document.getElementById('workoutTitle');
const currentStateTitleEl = document.getElementById('currentStateTitle');
const currentExNameEl = document.getElementById('currentExName');
const currentExRepsEl = document.getElementById('currentExReps');

const timerProgressEl = document.getElementById('timerProgress');
const timerControlEl = document.getElementById('timerControl');
const timerTextEl = document.getElementById('timerText');

const skipExerciseBtn = document.getElementById('skipExerciseBtn');
const exercisesListContainer = document.getElementById('exercisesListContainer');
const endWorkoutOverlay = document.getElementById('endWorkoutOverlay');
const endWorkoutModal = document.getElementById('endWorkoutModal');
const repeatWorkoutBtn = document.getElementById('repeatWorkoutBtn');
const exitToMainBtn = document.getElementById('exitToMainBtn');
const backToMainBtn = document.getElementById('backToMainBtn');

const restIndicator = document.getElementById('restIndicator');
const nextExNameHint = document.getElementById('nextExNameHint');
const nextExRepsHint = document.getElementById('nextExRepsHint'); // ⭐ Новый элемент для повторений

const skipConfirmModal = document.getElementById('skipConfirmModal');
const skipConfirmOverlay = document.getElementById('skipConfirmOverlay');
const confirmSkipBtn = document.getElementById('confirmSkipBtn');
const cancelSkipBtn = document.getElementById('cancelSkipBtn');


/* ====== Initialization and Data Loading ====== */

function initWorkoutPlayer() {
    const storedWorkout = localStorage.getItem('activeWorkout');
    if (storedWorkout) {
        activeWorkout = JSON.parse(storedWorkout);
        if (activeWorkout.exercises && activeWorkout.exercises.length > 0) {
            setupUI();
            renderExerciseList(); 
            resetTimer(); 
            return;
        }
    }
    
    window.location.href = 'index.html'; 
}

function setupUI() {
    workoutTitleEl.textContent = activeWorkout.title;
    timerControlEl.addEventListener('click', handleTimerClick);
    skipExerciseBtn.addEventListener('click', showSkipConfirm);
    
    window.addEventListener('scroll', handleScroll); 
    
    backToMainBtn.addEventListener('click', handleExit);
    repeatWorkoutBtn.addEventListener('click', repeatWorkout);
    exitToMainBtn.addEventListener('click', handleExit);
    
    confirmSkipBtn.addEventListener('click', () => { skipExercise(true); });
    cancelSkipBtn.addEventListener('click', () => { skipConfirmOverlay.classList.add('hidden'); skipConfirmModal.classList.add('hidden'); });

    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDasharray = circumference;
}

let lastScroll = 0;
function handleScroll() {
    const cur = window.pageYOffset || document.documentElement.scrollTop;
    topBar.style.transform = cur > lastScroll ? 'translateY(-100%)' : 'translateY(0)';
    lastScroll = cur <= 0 ? 0 : cur;
}


/* ====== Timer Logic and Control ====== */

function handleTimerClick() {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); 

    if (timerState === 'initial') {
        startTimer(); 
    } else if (timerState === 'rest') {
        resetTimer(); 
        startTimer(); 
    } else if (timerState === 'running') {
        pauseTimer(); 
    } else if (timerState === 'paused') {
        startTimer(); 
    } else if (timerState === 'completed') {
        moveToNextStep(); 
    }
}

function startTimer() {
    clearInterval(timerInterval);

    if (timerState === 'initial') {
        timerState = 'running';
        restIndicator.classList.add('hidden');
        
        // ⭐ Убираем текст "Начать тренировку"
        timerTextEl.innerHTML = remainingSeconds > 0 ? formatTime(remainingSeconds) : 'Далее';
        timerTextEl.classList.add('time');
        timerTextEl.classList.remove('paused-color', 'start-text');
        
        // ⭐ Обновляем заголовок состояния
        currentStateTitleEl.textContent = 'ТЕКУЩЕЕ УПРАЖНЕНИЕ';
        currentExNameEl.classList.remove('hidden');
        currentExRepsEl.classList.remove('hidden');

        if (remainingSeconds === 0) {
            showCompletion('завершено', false); 
            return;
        }
    } else if (timerState === 'paused') {
        timerState = 'running';
        timerTextEl.classList.remove('paused-color');
        skipExerciseBtn.classList.add('hidden'); 
    }

    if (remainingSeconds > 0) {
        updateTimerDisplay(); 
        timerInterval = setInterval(tick, 1000);
    }
}

function pauseTimer() {
    if (timerState !== 'running') return;
    
    clearInterval(timerInterval);
    timerState = 'paused';

    timerTextEl.textContent = formatTime(remainingSeconds);
    timerTextEl.classList.add('paused-color'); 
    skipExerciseBtn.classList.remove('hidden'); 
}

function tick() {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        showCompletion('завершено'); 
        return;
    }

    updateTimerDisplay();
}

function updateTimerDisplay() {
    timerTextEl.textContent = formatTime(remainingSeconds);
    
    const circumference = 2 * Math.PI * 45;
    
    const completedRatio = (totalSeconds - remainingSeconds) / totalSeconds;
    const offset = circumference * completedRatio;
    
    timerProgressEl.style.strokeDashoffset = offset;
}

function formatTime(totalSec) {
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Сброс таймера и установка UI для текущего упражнения
 */
function resetTimer() {
    clearInterval(timerInterval);
    skipExerciseBtn.classList.add('hidden');
    restIndicator.classList.add('hidden');

    if (currentExIndex >= activeWorkout.exercises.length) {
        showEndWorkoutModal();
        return;
    }
    
    const ex = activeWorkout.exercises[currentExIndex];
    
    updateCurrentExerciseHighlight(ex.id);
    
    currentExNameEl.textContent = ex.name;
    currentExRepsEl.textContent = `Повторения: ${ex.reps}`;

    totalSeconds = (ex.min * 60) + ex.sec;
    remainingSeconds = totalSeconds;

    timerState = 'initial';
    
    // ⭐ Форматирование текста для "Начать тренировку" с переносом строки
    if (totalSeconds > 0) {
        timerTextEl.innerHTML = '<tspan x="50" dy="-0.6em">Начать</tspan><tspan x="50" dy="1.2em">тренировку</tspan>';
    } else {
        timerTextEl.textContent = 'Далее';
    }
    
    timerTextEl.classList.add('start-text');
    timerTextEl.classList.remove('time', 'paused-color');
    
    // ⭐ Обновляем заголовок состояния
    currentStateTitleEl.textContent = 'ТЕКУЩЕЕ УПРАЖНЕНИЕ';
    currentExNameEl.classList.remove('hidden');
    currentExRepsEl.classList.remove('hidden');
    
    timerProgressEl.style.strokeDashoffset = 0; 
    timerProgressEl.style.stroke = 'var(--color-primary-light)'; 
}


/* ====== Exercise Flow Control (Смена состояния) ====== */

function showCompletion(status, move = true) {
    
    const exId = activeWorkout.exercises[currentExIndex].id;
    updateExerciseCardStatus(exId, status);
    
    if (totalSeconds > 0) {
        const circumference = 2 * Math.PI * 45;
        timerProgressEl.style.strokeDashoffset = circumference;
        timerProgressEl.style.stroke = (status === 'завершено') ? 'var(--color-success)' : 'var(--color-error)';
    }

    timerState = 'completed'; 
    timerTextEl.textContent = 'Далее';
    timerTextEl.classList.remove('time', 'paused-color');
    timerTextEl.classList.add('start-text');
    skipExerciseBtn.classList.add('hidden');

    if (move) moveToNextStep();
}

function showSkipConfirm() {
    skipConfirmOverlay.classList.remove('hidden');
    skipConfirmModal.classList.remove('hidden');
}

function skipExercise(confirmed) {
    if (!confirmed) return;

    skipConfirmOverlay.classList.add('hidden');
    skipConfirmModal.classList.add('hidden');

    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
    clearInterval(timerInterval);
    showCompletion('пропущено');
}

function moveToNextStep() {
    currentExIndex++;
    
    if (currentExIndex >= activeWorkout.exercises.length) {
        showEndWorkoutModal();
        return;
    }
    
    startRestState();
}

function startRestState() {
    
    const nextEx = activeWorkout.exercises[currentExIndex];
    
    // ⭐ РЕЖИМ ОТДЫХА: Скрываем текущее упражнение и показываем информацию о следующем внутри индикатора отдыха.
    currentStateTitleEl.textContent = ''; // Убираем заголовок "ТЕКУЩЕЕ УПРАЖНЕНИЕ"
    currentExNameEl.classList.add('hidden');
    currentExRepsEl.classList.add('hidden');
    
    restIndicator.classList.remove('hidden');
    nextExNameHint.textContent = nextEx.name;
    nextExRepsHint.textContent = `Повторения: ${nextEx.reps}`; // ⭐ Добавление повторений
    
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDashoffset = circumference; 
    timerProgressEl.style.stroke = 'var(--color-warning)';
    
    timerState = 'rest'; 
    timerTextEl.textContent = 'СТАРТ';
    timerTextEl.classList.add('start-text');
    timerTextEl.classList.remove('time', 'paused-color');
}


/* ====== Exercise List UI (Без изменений) ====== */

function renderExerciseList() {
    exercisesListContainer.innerHTML = '';
    
    activeWorkout.exercises.forEach((ex, index) => {
        const div = document.createElement('div');
        div.className = 'exercise-card';
        div.setAttribute('data-ex-id', ex.id);
        
        let metaParts = [];
        if (ex.reps) metaParts.push(`${ex.reps} повт.`);
        if (ex.min > 0) metaParts.push(`${ex.min} мин`);
        if (ex.sec > 0) metaParts.push(`${ex.sec} сек`);
        
        const metaStr = metaParts.join(' | ');
        
        div.innerHTML = `
            <div class="exercise-card-info">
                <div class="exercise-card-title">${index + 1}. ${ex.name}</div>
                <div class="exercise-card-meta">${metaStr}</div>
            </div>
            <div class="exercise-card-status"></div>
        `;
        
        exercisesListContainer.appendChild(div);
    });
}

function updateExerciseCardStatus(exId, status) {
    const card = document.querySelector(`.exercise-card[data-ex-id='${exId}']`);
    if (card) {
        card.classList.remove('status-completed', 'status-skipped', 'current-highlight');
        
        if (status === 'завершено') {
            card.classList.add('status-completed');
        } else if (status === 'пропущено') {
            card.classList.add('status-skipped');
        }
    }
}

function updateCurrentExerciseHighlight(exId) {
    document.querySelectorAll('.exercise-card').forEach(card => {
        card.classList.remove('current-highlight');
    });
    
    const currentCard = document.querySelector(`.exercise-card[data-ex-id='${exId}']`);
    if (currentCard) {
        currentCard.classList.add('current-highlight');
        currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


/* ====== End of Workout Logic (Без изменений) ====== */

function showEndWorkoutModal() {
    endWorkoutOverlay.classList.remove('hidden');
    endWorkoutModal.classList.remove('hidden');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
}

function repeatWorkout() {
    endWorkoutOverlay.classList.add('hidden');
    endWorkoutModal.classList.add('hidden');
    currentExIndex = 0;
    
    document.querySelectorAll('.exercise-card').forEach(card => {
        card.classList.remove('status-completed', 'status-skipped', 'current-highlight');
    });
    
    resetTimer();
}

function handleExit() {
    window.location.href = 'index.html';
}

/* ====== Start Application ====== */
initWorkoutPlayer();