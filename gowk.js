/* ====== gowk.js (Полная логика плеера) ====== */

/* ====== Общие элементы и TWA ====== */
const API_BASE = "http://localhost:5000";
let tgUser = { id: null, first_name: "Пользователь", username: "" };
window.Telegram?.WebApp?.ready();
if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    tgUser = window.Telegram.WebApp.initDataUnsafe.user;
}

/* ====== API Helper (Оставлен для возможности будущего расширения) ====== */
async function api(path, method = 'GET', data = null) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : null
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`API error ${res.status}: ${text}`);
        throw new Error(`API error ${res.status}: ${text}`); 
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return null;
}

/* ====== Workout State & Constants ====== */
let activeWorkout = null;
let currentExIndex = 0;
// 'initial', 'running', 'paused', 'completed', 'rest_running', 'rest_paused'
let timerState = 'initial'; 
let totalSeconds = 0; 
let remainingSeconds = 0;
let timerInterval = null;

const REST_TIME_SECONDS = 30; // Перерыв между упражнениями (30 секунд)

/* ====== Elements (gowk.html) ====== */
const workoutTitleEl = document.getElementById('workoutTitle');
const currentExNameEl = document.getElementById('currentExName');
const currentExRepsEl = document.getElementById('currentExReps');
const timerSvg = document.getElementById('timerSvg');
const timerProgressEl = document.getElementById('timerProgress');
const timerControlEl = document.getElementById('timerControl');
const timerTextEl = document.getElementById('timerText');
const completionCheckEl = document.getElementById('completionCheck');
const skipExerciseBtn = document.getElementById('skipExerciseBtn');
const completedExercisesList = document.getElementById('completedExercisesList');
const endWorkoutModal = document.getElementById('endWorkoutModal');
const endWorkoutOverlay = document.getElementById('endWorkoutOverlay');
const repeatWorkoutBtn = document.getElementById('repeatWorkoutBtn');
const exitToMainBtn = document.getElementById('exitToMainBtn');
const backToMainBtn = document.getElementById('backToMainBtn');
const restTimerDisplay = document.getElementById('restTimerDisplay');
const restTimeEl = document.getElementById('restTime');

/* ====== Initialization and Data Loading ====== */

function initWorkoutPlayer() {
    // Загружаем данные тренировки из localStorage
    const storedWorkout = localStorage.getItem('activeWorkout');
    if (storedWorkout) {
        activeWorkout = JSON.parse(storedWorkout);
        if (activeWorkout.exercises && activeWorkout.exercises.length > 0) {
            setupUI();
            resetTimer(); 
            return;
        }
    }
    
    // Если данные не найдены, возвращаемся на главную
    window.location.href = 'index.html'; 
}

function setupUI() {
    workoutTitleEl.textContent = activeWorkout.title;
    timerControlEl.addEventListener('click', handleTimerClick);
    skipExerciseBtn.addEventListener('click', skipExercise);
    backToMainBtn.addEventListener('click', handleExit);
    repeatWorkoutBtn.addEventListener('click', repeatWorkout);
    exitToMainBtn.addEventListener('click', handleExit);
    
    // Вычисляем длину окружности для SVG (R=45)
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDasharray = circumference;
}


/* ====== Timer Logic and Control ====== */

/**
 * Обрабатывает клик по кругу. Запускает/Приостанавливает/Продолжает/Переходит.
 */
function handleTimerClick() {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); 

    if (timerState === 'initial' || timerState === 'paused' || timerState === 'rest_paused') {
        startTimer(); // Запуск/Возобновление
    } else if (timerState === 'running' || timerState === 'rest_running') {
        pauseTimer(); // Пауза
    } else if (timerState === 'completed') {
        moveToNextStep(); // Переход к следующему упражнению/отдыху
    }
}

function startTimer() {
    if (timerState === 'initial' || timerState === 'paused') {
        // Запуск/Возобновление упражнения
        timerState = 'running';
        timerTextEl.classList.add('time');
        skipExerciseBtn.classList.add('hidden');
        completionCheckEl.classList.add('hidden');
        
    } else if (timerState === 'rest_paused') {
        // Возобновление отдыха
        timerState = 'rest_running';
        restTimerDisplay.classList.remove('hidden');
        skipExerciseBtn.classList.add('hidden');
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    
    if (timerState === 'running') {
        timerState = 'paused';
        timerTextEl.textContent = 'Пауза';
        timerTextEl.classList.remove('time');
        skipExerciseBtn.classList.remove('hidden'); // Появляется кнопка пропуска
    } else if (timerState === 'rest_running') {
        timerState = 'rest_paused';
        timerTextEl.textContent = 'Отдых';
        skipExerciseBtn.classList.add('hidden'); 
    }
}

function tick() {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        
        if (timerState === 'running') {
            // Упражнение завершено по таймеру
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            showCompletionAnimation('завершено');
            
        } else if (timerState === 'rest_running') {
            // Отдых завершен, переходим к следующему упражнению
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            moveToNextExercise();
        }
        return;
    }

    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timerState === 'running' || timerState === 'paused') {
        timerTextEl.textContent = timeStr;
    } else if (timerState === 'rest_running' || timerState === 'rest_paused') {
        restTimeEl.textContent = timeStr;
    }

    // Анимация круга (прогресс)
    const circumference = 2 * Math.PI * 45;
    const offset = circumference * (remainingSeconds / totalSeconds);
    timerProgressEl.style.strokeDashoffset = offset;
}

/**
 * Установка параметров для нового упражнения или сброс
 */
function resetTimer() {
    clearInterval(timerInterval);
    completionCheckEl.classList.add('hidden');
    skipExerciseBtn.classList.add('hidden');
    restTimerDisplay.classList.add('hidden');

    if (currentExIndex >= activeWorkout.exercises.length) {
        showEndWorkoutModal();
        return;
    }

    const ex = activeWorkout.exercises[currentExIndex];
    
    currentExNameEl.textContent = ex.name;
    currentExRepsEl.textContent = `Повторения: ${ex.reps}`;

    totalSeconds = (ex.min * 60) + ex.sec;
    remainingSeconds = totalSeconds;

    timerState = 'initial';
    timerTextEl.textContent = totalSeconds > 0 ? 'Старт' : 'Далее';
    timerTextEl.classList.remove('time');
    
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDashoffset = circumference;
    timerProgressEl.style.stroke = 'var(--color-primary)';

    // Если время 0, упражнение считается выполненным сразу, но ждет клика "Далее"
    if (totalSeconds === 0) {
        timerState = 'completed';
        timerProgressEl.style.strokeDashoffset = 0; 
        timerProgressEl.style.stroke = 'var(--color-success)';
        addCompletedCard(ex, 'завершено'); 
    }
}


/* ====== Exercise Flow Control ====== */

function showCompletionAnimation(status) {
    // Добавляем карточку в список завершенных
    addCompletedCard(activeWorkout.exercises[currentExIndex], status);
    
    // Показываем галочку (только если выполнено по таймеру)
    if (status === 'завершено') {
        completionCheckEl.classList.remove('hidden');
    }
    
    timerTextEl.textContent = 'Далее';
    timerTextEl.classList.remove('time');

    // Снимаем полосу
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDashoffset = 0;
    timerProgressEl.style.stroke = (status === 'завершено') ? 'var(--color-success)' : 'var(--color-warning)';
    
    timerState = 'completed';
}

function skipExercise() {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
    clearInterval(timerInterval);
    showCompletionAnimation('пропущено');
    skipExerciseBtn.classList.add('hidden');
}

/**
 * Движение к следующему шагу (отдых или упражнение)
 */
function moveToNextStep() {
    currentExIndex++;
    
    // Если это было последнее упражнение
    if (currentExIndex >= activeWorkout.exercises.length) {
        showEndWorkoutModal();
        return;
    }
    
    // Начинаем отдых
    startRestTimer();
}

function startRestTimer() {
    currentExNameEl.textContent = "Отдых";
    currentExRepsEl.textContent = `Перерыв между подходами (${REST_TIME_SECONDS} сек)`;
    
    totalSeconds = REST_TIME_SECONDS;
    remainingSeconds = REST_TIME_SECONDS;
    
    timerState = 'rest_running';
    timerTextEl.textContent = 'Отдых';
    timerTextEl.classList.remove('time');
    restTimerDisplay.classList.remove('hidden');
    completionCheckEl.classList.add('hidden');
    
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDashoffset = circumference;
    timerProgressEl.style.stroke = 'var(--color-warning)';

    // Автоматический старт отдыха
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
}

function moveToNextExercise() {
    resetTimer(); // Начнет с "Старт" для нового упражнения
}

/* ====== Completed List UI ====== */

function addCompletedCard(exercise, status) {
    const div = document.createElement('div');
    const statusClass = status === 'завершено' ? 'status-completed' : 'status-skipped';
    
    div.className = 'completed-card';
    div.innerHTML = `
        <div class="completed-card-info">
            <div class="completed-card-title">${exercise.name}</div>
            <div class="completed-card-meta">${exercise.reps} повт.</div>
        </div>
        <div class="completed-card-status ${statusClass}">${status}</div>
    `;
    
    completedExercisesList.prepend(div); 
}


/* ====== End of Workout Logic ====== */

function showEndWorkoutModal() {
    endWorkoutOverlay.classList.remove('hidden');
    endWorkoutModal.classList.remove('hidden');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    
    // ⭐ УДАЛЕНО: Здесь должна была быть логика обновления счетчика завершенных тренировок.
}

function repeatWorkout() {
    endWorkoutOverlay.classList.add('hidden');
    endWorkoutModal.classList.add('hidden');
    currentExIndex = 0;
    completedExercisesList.innerHTML = '';
    resetTimer();
}

function handleExit() {
    window.location.href = 'index.html';
}

/* ====== Start Application ====== */
initWorkoutPlayer();