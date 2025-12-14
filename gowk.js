/* ====== gowk.js (Переработанная логика плеера) ====== */

/* ====== Общие элементы и TWA ====== */
const API_BASE = "http://localhost:5000"; // Оставлен для возможности будущего расширения
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

const restIndicator = document.getElementById('restIndicator');
const nextExNameHint = document.getElementById('nextExNameHint');

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
            renderExerciseList(); // Рендерим все карточки
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
    skipExerciseBtn.addEventListener('click', showSkipConfirm);
    backToMainBtn.addEventListener('click', handleExit);
    repeatWorkoutBtn.addEventListener('click', repeatWorkout);
    exitToMainBtn.addEventListener('click', handleExit);
    
    // Подтверждение пропуска
    confirmSkipBtn.addEventListener('click', () => { skipExercise(true); });
    cancelSkipBtn.addEventListener('click', () => { skipConfirmOverlay.classList.add('hidden'); skipConfirmModal.classList.add('hidden'); });

    // Вычисляем длину окружности для SVG (R=45)
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDasharray = circumference;
}


/* ====== Timer Logic and Control ====== */

/**
 * Обрабатывает клик по кругу.
 */
function handleTimerClick() {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); 

    if (timerState === 'initial' || timerState === 'rest') {
        // Начать тренировку или Начать следующее упражнение
        startTimer(); 
    } else if (timerState === 'running') {
        // Пауза
        pauseTimer(); 
    } else if (timerState === 'paused') {
        // Возобновление
        startTimer(); 
    } else if (timerState === 'completed') {
        // Упражнение без таймера
        moveToNextStep(); 
    }
}

function startTimer() {
    clearInterval(timerInterval);

    if (timerState === 'initial' || timerState === 'rest') {
        // Сброс и подготовка к запуску
        timerState = 'running';
        restIndicator.classList.add('hidden');
        
        // Обновляем UI для первого запуска
        timerTextEl.textContent = remainingSeconds > 0 ? formatTime(remainingSeconds) : 'Далее';
        timerTextEl.classList.add('time');
        timerTextEl.classList.remove('paused-color', 'large-text');
        
        if (remainingSeconds === 0) {
            // Упражнение без таймера, ждем клика "Далее"
            showCompletion('завершено', false); // Обновляем только карточку, не запускаем таймер
            return;
        }
    } else if (timerState === 'paused') {
        // Возобновление
        timerState = 'running';
        timerTextEl.classList.remove('paused-color');
        skipExerciseBtn.classList.add('hidden'); // Кнопка пропуска исчезает
    }

    // Запускаем тик, только если есть время
    if (remainingSeconds > 0) {
        timerInterval = setInterval(tick, 1000);
    }
}

function pauseTimer() {
    if (timerState !== 'running') return;
    
    clearInterval(timerInterval);
    timerState = 'paused';

    // Визуальные изменения для паузы
    timerTextEl.textContent = formatTime(remainingSeconds);
    timerTextEl.classList.add('paused-color'); // Цифры становятся серыми
    skipExerciseBtn.classList.remove('hidden'); // Появляется кнопка пропуска
}

function tick() {
    remainingSeconds--;

    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        showCompletion('завершено'); // Упражнение завершено по таймеру
        return;
    }

    updateTimerDisplay();
}

function updateTimerDisplay() {
    timerTextEl.textContent = formatTime(remainingSeconds);
    
    // Анимация круга (прогресс)
    const circumference = 2 * Math.PI * 45;
    const offset = circumference * (remainingSeconds / totalSeconds);
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

    // Проверяем завершение тренировки
    if (currentExIndex >= activeWorkout.exercises.length) {
        showEndWorkoutModal();
        return;
    }
    
    const ex = activeWorkout.exercises[currentExIndex];
    
    // Обновляем текущее упражнение в списке
    updateCurrentExerciseHighlight(ex.id);
    
    currentExNameEl.textContent = ex.name;
    currentExRepsEl.textContent = `Повторения: ${ex.reps}`;

    totalSeconds = (ex.min * 60) + ex.sec;
    remainingSeconds = totalSeconds;

    timerState = 'initial';
    timerTextEl.textContent = totalSeconds > 0 ? 'Начать тренировку' : 'Далее';
    timerTextEl.classList.add('large-text');
    timerTextEl.classList.remove('time', 'paused-color');
    
    // Сброс круговой полосы
    const circumference = 2 * Math.PI * 45;
    timerProgressEl.style.strokeDashoffset = totalSeconds > 0 ? circumference : 0;
    timerProgressEl.style.stroke = 'var(--color-primary)';
}


/* ====== Exercise Flow Control (Смена состояния) ====== */

/**
 * Показывает завершение, обновляет UI и переходит в состояние 'completed'/'rest'.
 */
function showCompletion(status, move = true) {
    
    // 1. Обновляем карточку упражнения
    const exId = activeWorkout.exercises[currentExIndex].id;
    updateExerciseCardStatus(exId, status);
    
    // 2. Визуальное завершение (если есть таймер)
    if (totalSeconds > 0) {
        // Устанавливаем полный прогресс
        timerProgressEl.style.strokeDashoffset = 0;
        timerProgressEl.style.stroke = (status === 'завершено') ? 'var(--color-success)' : 'var(--color-error)';
    }

    timerState = 'completed'; // Переход в состояние, ожидающее следующего шага
    timerTextEl.textContent = 'Далее';
    timerTextEl.classList.remove('time', 'paused-color');
    timerTextEl.classList.add('large-text');
    skipExerciseBtn.classList.add('hidden');

    if (move) moveToNextStep();
}

/**
 * Показывает модальное окно подтверждения пропуска.
 */
function showSkipConfirm() {
    skipConfirmOverlay.classList.remove('hidden');
    skipConfirmModal.classList.remove('hidden');
}

/**
 * Пропускает упражнение (после подтверждения).
 */
function skipExercise(confirmed) {
    if (!confirmed) return;

    skipConfirmOverlay.classList.add('hidden');
    skipConfirmModal.classList.add('hidden');

    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
    clearInterval(timerInterval);
    showCompletion('пропущено');
}

/**
 * Движение к следующему шагу (отдых или завершение)
 */
function moveToNextStep() {
    currentExIndex++;
    
    // Если это было последнее упражнение
    if (currentExIndex >= activeWorkout.exercises.length) {
        showEndWorkoutModal();
        return;
    }
    
    // Начинаем отдых
    startRestState();
}

function startRestState() {
    
    const nextEx = activeWorkout.exercises[currentExIndex];
    
    currentExNameEl.textContent = "ПЕРЕРЫВ";
    currentExRepsEl.textContent = `Готовьтесь к следующему подходу`;
    
    restIndicator.classList.remove('hidden');
    nextExNameHint.textContent = nextEx.name;
    
    // Скрываем полосу
    timerProgressEl.style.strokeDashoffset = 2 * Math.PI * 45;
    timerProgressEl.style.stroke = 'var(--color-warning)';
    
    timerState = 'rest'; // Неограниченный отдых
    timerTextEl.textContent = 'СТАРТ';
    timerTextEl.classList.add('large-text');
    timerTextEl.classList.remove('time', 'paused-color');
}


/* ====== Exercise List UI ====== */

function renderExerciseList() {
    exercisesListContainer.innerHTML = '';
    
    activeWorkout.exercises.forEach((ex, index) => {
        const div = document.createElement('div');
        div.className = 'exercise-card';
        div.setAttribute('data-ex-id', ex.id);
        
        let timeStr = '';
        if (ex.min > 0 || ex.sec > 0) {
            timeStr = ` | ${ex.min > 0 ? ex.min + ' мин' : ''} ${ex.sec > 0 ? ex.sec + ' сек' : ''}`.trim();
        }

        div.innerHTML = `
            <div class="exercise-card-info">
                <div class="exercise-card-title">${index + 1}. ${ex.name}</div>
                <div class="exercise-card-meta">${ex.reps} повт.${timeStr}</div>
            </div>
            <div class="exercise-card-status"></div>
        `;
        
        exercisesListContainer.appendChild(div);
    });
}

function updateExerciseCardStatus(exId, status) {
    const card = document.querySelector(`.exercise-card[data-ex-id='${exId}']`);
    if (card) {
        // Убираем предыдущие классы статуса
        card.classList.remove('status-completed', 'status-skipped', 'current-highlight');
        
        // Добавляем новый класс статуса
        if (status === 'завершено') {
            card.classList.add('status-completed');
        } else if (status === 'пропущено') {
            card.classList.add('status-skipped');
        }
    }
}

function updateCurrentExerciseHighlight(exId) {
    // Снимаем выделение со всех
    document.querySelectorAll('.exercise-card').forEach(card => {
        card.classList.remove('current-highlight');
    });
    
    // Добавляем выделение текущему
    const currentCard = document.querySelector(`.exercise-card[data-ex-id='${exId}']`);
    if (currentCard) {
        currentCard.classList.add('current-highlight');
        // Прокрутка к текущему элементу (опционально)
        currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


/* ====== End of Workout Logic ====== */

function showEndWorkoutModal() {
    endWorkoutOverlay.classList.remove('hidden');
    endWorkoutModal.classList.remove('hidden');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
}

function repeatWorkout() {
    endWorkoutOverlay.classList.add('hidden');
    endWorkoutModal.classList.add('hidden');
    currentExIndex = 0;
    
    // Сброс статусов всех карточек
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