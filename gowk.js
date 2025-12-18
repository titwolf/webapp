/* ====== gowk.js (Переработанная логика плеера) ====== */

/* ====== Общие элементы и TWA ====== */
const API_BASE = "http://localhost:5000"; 
let tgUser = { id: null, first_name: "Пользователь", username: "" };
window.Telegram?.WebApp?.ready();
if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    tgUser = window.Telegram.WebApp.initDataUnsafe.user;
}

/* ====== Workout State & Constants ====== */
const PROGRESS_STORAGE_KEY = 'activeWorkoutProgress'; // Ключ для сохранения прогресса
let activeWorkout = null;
let currentExIndex = 0;
// 'initial', 'running', 'paused', 'completed', 'rest'
let timerState = 'initial'; 
let totalSeconds = 0; 
let remainingSeconds = 0;
let timerInterval = null;
let endTime = null; // Точное время (ms), когда таймер должен обнулиться

/* ====== Elements (gowk.html) ====== */
const topBar = document.getElementById('topBar');
const workoutTitleEl = document.getElementById('workoutTitle');
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

// Элементы для модального окна выхода
const exitConfirmOverlay = document.getElementById('exitConfirmOverlay');
const exitConfirmModal = document.getElementById('exitConfirmModal');
const confirmExitBtn = document.getElementById('confirmExitBtn');
const cancelExitBtn = document.getElementById('cancelExitBtn');

const restIndicator = document.getElementById('restIndicator');
const nextExNameHint = document.getElementById('nextExNameHint');
const nextExRepsHint = document.getElementById('nextExRepsHint'); 

const skipConfirmModal = document.getElementById('skipConfirmModal');
const skipConfirmOverlay = document.getElementById('skipConfirmOverlay');
const confirmSkipBtn = document.getElementById('confirmSkipBtn');
const cancelSkipBtn = document.getElementById('cancelSkipBtn');


/* ====== Local Storage Handlers ====== */
// Проверка времени при возврате в приложение
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (timerState === 'running' || timerState === 'rest')) {
        if (!endTime) return;
        const now = Date.now();
        const diff = Math.ceil((endTime - now) / 1000);

        if (diff <= 0) {
            remainingSeconds = 0;
            finishStep(); // Создадим эту функцию ниже
        } else {
            remainingSeconds = diff;
            updateTimerDisplay();
        }
    }
});
/**
 * Сохраняет текущее состояние тренировки в LocalStorage
 */
function saveProgress() {
    // Не сохраняем прогресс, если тренировка не начиналась или завершена
    if (!activeWorkout || timerState === 'initial' || timerState === 'completed') return;

    const progressData = {
        exId: activeWorkout.id, 
        currentExIndex: currentExIndex,
        remainingSeconds: remainingSeconds,
        timerState: timerState,
        // Сохраняем статус каждого упражнения для корректного отображения списка
        exercises: activeWorkout.exercises.map(ex => ({ 
            id: ex.id, 
            status: ex.status || null
        })) 
    };
    
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressData));
}

/**
 * Удаляет сохраненный прогресс
 */
function clearProgress() {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
}


/* ====== Initialization and Data Loading ====== */

function initWorkoutPlayer() {
    // 1. Пытаемся загрузить сохраненный прогресс
    const storedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
    // 2. Загружаем данные самой тренировки (полагаемся на предыдущий шаг)
    const storedWorkout = localStorage.getItem('activeWorkout');

    if (storedWorkout) {
        activeWorkout = JSON.parse(storedWorkout);
        // Добавляем ID, если он не был установлен (для проверки совпадения прогресса)
        if (!activeWorkout.id) activeWorkout.id = activeWorkout.exercises.map(ex => ex.id).join('');

        if (activeWorkout.exercises && activeWorkout.exercises.length > 0) {
            setupUI();
            
            if (storedProgress) {
                const progress = JSON.parse(storedProgress);
                // Проверяем, что прогресс принадлежит этой тренировке
                if (progress.exId === activeWorkout.id) { 
                    restoreProgress(progress);
                } else {
                    // Если тренировки не совпадают, начинаем сначала
                    renderExerciseList(); 
                    resetTimer(); 
                }
            } else {
                // Если прогресса нет, начинаем сначала
                renderExerciseList(); 
                resetTimer(); 
            }
            
            return;
        }
    }
    
    // Если ничего не найдено или нет упражнений
    window.location.href = 'index.html'; 
}

function restoreProgress(progress) {
    currentExIndex = progress.currentExIndex;
    remainingSeconds = progress.remainingSeconds;
    timerState = progress.timerState;
    
    // Восстановление статусов упражнений в активной тренировке
    progress.exercises.forEach(pEx => {
        const ex = activeWorkout.exercises.find(aEx => aEx.id === pEx.id);
        if (ex) {
            ex.status = pEx.status;
        }
    });

    renderExerciseList(); 

    // Загружаем данные текущего упражнения в таймер
    const ex = activeWorkout.exercises[currentExIndex];
    totalSeconds = (ex.min * 60) + ex.sec;
    
    // UI для текущего упражнения
    updateCurrentExerciseHighlight(ex.id);
    currentExNameEl.textContent = ex.name;
    currentExRepsEl.textContent = `Повторения: ${ex.reps}`;

    // Обновляем состояние таймера в зависимости от сохраненного
    if (timerState === 'rest') {
        startRestState(true); // Запускаем режим отдыха без сдвига индекса
        // Переход в 'rest' сам установит remainingSeconds и обновит UI
    } else {
        // Устанавливаем UI как для паузы
        if (timerState === 'running') {
            // Если было 'running', то переводим в 'paused', а потом сразу запускаем
            pauseTimer(); 
            startTimer();
        } else if (timerState === 'paused') {
             // Если было 'paused', просто ставим на паузу
            pauseTimer();
        }
        
        // Обновляем текст на таймере после всех манипуляций
        updateTimerDisplay();
    }
    
    // Если тренировка была на паузе, показываем кнопку "Пропустить"
    if (timerState === 'paused') {
        skipExerciseBtn.classList.remove('hidden');
    }
    updateTimerVisualState(); // Добавить сюда
}


function setupUI() {
    workoutTitleEl.textContent = activeWorkout.title;
    timerControlEl.addEventListener('click', handleTimerClick);
    skipExerciseBtn.addEventListener('click', showSkipConfirm);
    
    window.addEventListener('scroll', handleScroll); 
    
    backToMainBtn.addEventListener('click', handleBackButtonClick);
    repeatWorkoutBtn.addEventListener('click', repeatWorkout);
    exitToMainBtn.addEventListener('click', handleExit);
    
    confirmExitBtn.addEventListener('click', handleExitWorkout);
    cancelExitBtn.addEventListener('click', hideExitConfirmModal);

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
        resetTimer(); // Здесь resetTimer по сути начинает следующее упражнение
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
    
    // ⭐ ГЛАВНОЕ: ставим метку времени окончания
    endTime = Date.now() + (remainingSeconds * 1000);

    if (timerState === 'initial') {
        timerState = 'running';
        restIndicator.classList.add('hidden');
        timerTextEl.classList.add('time');
        timerTextEl.classList.remove('paused-color', 'start-text');
    } else if (timerState === 'paused') {
        timerState = (restIndicator.classList.contains('hidden')) ? 'running' : 'rest';
        timerTextEl.classList.remove('paused-color');
        skipExerciseBtn.classList.add('hidden'); 
    }

    saveProgress();
    if (remainingSeconds > 0) {
        updateTimerDisplay(); 
        timerInterval = setInterval(tick, 250); // Проверяем чаще для точности
    }
    updateTimerVisualState();
}

function pauseTimer() {
    if (timerState !== 'running' && timerState !== 'rest') return;
    
    clearInterval(timerInterval);
    timerState = 'paused';

    timerTextEl.textContent = formatTime(remainingSeconds);
    timerTextEl.classList.add('paused-color'); 
    skipExerciseBtn.classList.remove('hidden'); 

    // ⭐ Сохраняем состояние при паузе
    saveProgress();
    updateTimerVisualState(); // Добавить сюда
}

function tick() {
    const now = Date.now();
    const diff = Math.ceil((endTime - now) / 1000);

    if (diff <= 0) {
        finishStep();
    } else {
        remainingSeconds = diff;
        updateTimerDisplay();
        if (remainingSeconds % 2 === 0) saveProgress(); // Сохраняем раз в 2 секунды
    }
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
    // ⭐ Очищаем прогресс, если мы начинаем с первого упражнения
    if (currentExIndex === 0) clearProgress();
    
    // ⭐ Форматирование текста для "Начать тренировку" с переносом строки
    if (totalSeconds > 0) {
        timerTextEl.innerHTML = '<tspan x="50" dy="-0.6em">Начать</tspan><tspan x="50" dy="1.2em">тренировку</tspan>';
    } else {
        timerTextEl.textContent = 'Далее';
    }
    
    timerTextEl.classList.add('start-text');
    timerTextEl.classList.remove('time', 'paused-color');
    
    currentExNameEl.classList.remove('hidden');
    currentExRepsEl.classList.remove('hidden');
    
    timerProgressEl.style.strokeDashoffset = 0; 
    timerProgressEl.style.stroke = 'var(--color-text-primary)'; 
updateTimerVisualState(); // Добавить сюда
}


/* ====== Exercise Flow Control (Смена состояния) ====== */

function showCompletion(status, move = true) {
    
    const ex = activeWorkout.exercises[currentExIndex];
    ex.status = status; // Сохраняем статус в объекте
    updateExerciseCardStatus(ex.id, status);
    
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
    
    // ⭐ Сохраняем состояние после завершения/пропуска
    saveProgress();

    if (move) moveToNextStep();
}

function showSkipConfirm() {
    skipConfirmOverlay.classList.remove('hidden');
    skipConfirmModal.classList.remove('hidden');
}

/* ====== Exit Confirmation Logic ====== */

function handleBackButtonClick(e) {
    e.preventDefault(); 
    
    if (timerState !== 'initial' && timerState !== 'completed') {
        showExitConfirmModal();
    } else {
        handleExitWorkout(); 
    }
}

function showExitConfirmModal() {
    exitConfirmOverlay.classList.remove('hidden');
    exitConfirmModal.classList.remove('hidden');
}

function hideExitConfirmModal() {
    exitConfirmOverlay.classList.add('hidden');
    exitConfirmModal.classList.add('hidden');
}

function handleExitWorkout() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    // ⭐ Очищаем прогресс при выходе
    clearProgress();
    window.location.href = 'index.html'; 
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

function startRestState(skipNextStep = false) {
    
    const nextEx = activeWorkout.exercises[currentExIndex];
    
    currentExNameEl.classList.add('hidden');
    currentExRepsEl.classList.add('hidden');
    
    restIndicator.classList.remove('hidden');
    nextExNameHint.textContent = nextEx.name;
    nextExRepsHint.textContent = `Повторения: ${nextEx.reps}`; 
    
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDashoffset = circumference; 
    timerProgressEl.style.stroke = 'var(--color-warning)';
    
    timerState = 'rest'; 
    timerTextEl.textContent = 'СТАРТ';
    timerTextEl.classList.add('start-text');
    timerTextEl.classList.remove('time', 'paused-color');

    // Если мы не восстанавливаем прогресс, устанавливаем время отдыха (30 сек)
    if (!skipNextStep) {
        totalSeconds = 30; 
        remainingSeconds = 30;
    }
    
    // ⭐ Сохраняем состояние при начале отдыха
    saveProgress();
}


/* ====== Exercise List UI ====== */

function renderExerciseList() {
    exercisesListContainer.innerHTML = '';
    
    activeWorkout.exercises.forEach((ex, index) => {
        const div = document.createElement('div');
        div.className = 'exercise-card';
        div.setAttribute('data-ex-id', ex.id);
        
        // Добавляем класс, если статус уже сохранен
        if (ex.status === 'завершено') div.classList.add('status-completed');
        if (ex.status === 'пропущено') div.classList.add('status-skipped');

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


/* ====== End of Workout Logic ====== */

function showEndWorkoutModal() {
    endWorkoutOverlay.classList.remove('hidden');
    endWorkoutModal.classList.remove('hidden');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    // ⭐ Очищаем прогресс при завершении
    clearProgress();
}

function repeatWorkout() {
    endWorkoutOverlay.classList.add('hidden');
    endWorkoutModal.classList.add('hidden');
    currentExIndex = 0;
    
    document.querySelectorAll('.exercise-card').forEach(card => {
        card.classList.remove('status-completed', 'status-skipped', 'current-highlight');
        // Сбрасываем статус в объекте
        const exId = card.getAttribute('data-ex-id');
        const ex = activeWorkout.exercises.find(aEx => aEx.id === Number(exId));
        if (ex) ex.status = null;
    });
    
    // ⭐ Очищаем прогресс перед повтором
    clearProgress();
    
    resetTimer();
}

function handleExit() {
    // ⭐ Эта функция используется только в EndWorkoutModal, где прогресс уже очищен
    window.location.href = 'index.html';
}

// Функция управления визуальным состоянием контейнера таймера
function updateTimerVisualState() {
    const container = document.querySelector('.timer-container');
    if (!container) return;
    
    if (timerState === 'running' || timerState === 'rest') {
        container.classList.add('is-running');
    } else {
        container.classList.remove('is-running');
    }
}

/* ====== Start Application ====== */
initWorkoutPlayer();