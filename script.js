/* ====== Общие элементы ====== */
const topBar = document.getElementById('topBar');
const overlay = document.getElementById('overlay');
const API_BASE = "http://localhost:5000";
let lastScroll = 0;

/* ====== Telegram WebApp integration ====== */
let tgUser = { id: null, first_name: "Пользователь", username: "", photo_url: "https://via.placeholder.com/80" };
window.Telegram?.WebApp?.ready();
if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    document.getElementById('userAvatar').src = tgUser.photo_url || "https://via.placeholder.com/80";
}

/* ====== Top bar hide on scroll ====== */
window.addEventListener('scroll', () => {
    const cur = window.pageYOffset || document.documentElement.scrollTop;
    topBar.style.transform = cur > lastScroll ? 'translateY(-100%)' : 'translateY(0)';
    lastScroll = cur <= 0 ? 0 : cur;
});

/* ====== Elements ====== */
const workoutContainer = document.getElementById('workoutContainer');
const createModal = document.getElementById('createModal');
const inputTrainingName = document.getElementById('inputTrainingName');
const openCreateModal = document.getElementById('openCreateModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const stepTitle = document.getElementById('stepTitle');
const stepExercises = document.getElementById('stepExercises');
const toExercisesBtn = document.getElementById('toExercisesBtn');
const backToTitleBtn = document.getElementById('backToTitleBtn');
const trainingTitleDisplay = document.getElementById('trainingTitleDisplay');
const toggleExerciseFormBtn = document.getElementById('toggleExerciseFormBtn');
const exerciseForm = document.getElementById('exerciseForm');
const exName = document.getElementById('exName');
const exDesc = document.getElementById('exDesc');
const exReps = document.getElementById('exReps');
const exMin = document.getElementById('exMin');
const exSec = document.getElementById('exSec');
const saveExerciseBtn = document.getElementById('saveExerciseBtn');
const cancelExerciseBtn = document.getElementById('cancelExerciseBtn');
const exerciseList = document.getElementById('exerciseList');
const saveTrainingBtn = document.getElementById('saveTrainingBtn');

/* Profile modal */
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const createdCount = document.getElementById('createdCount');
const completedCount = document.getElementById('completedCount');
const notifyTime = document.getElementById('notifyTime');
const saveProfileBtn = document.getElementById('saveProfileBtn');

/* View modal */
const viewModal = document.getElementById('viewModal');
// viewTitle (заменен на viewTitleDisplayContainer и viewTitleEditForm)
const viewBody = document.getElementById('viewBody');
const closeViewBtn = document.getElementById('closeViewBtn');
const editWorkoutBtn = document.getElementById('editWorkoutBtn');
const startWorkoutBtn = document.getElementById('startWorkoutBtn');
const deleteWorkoutBtn = document.getElementById('deleteWorkoutBtn');
const saveViewChangesBtn = document.getElementById('saveViewChangesBtn'); // Оставляем, хотя функционал изменен
const cancelViewEditBtn = document.getElementById('cancelViewEditBtn');

// Элементы управления режимом редактирования
const mainViewActions = document.getElementById('mainViewActions');
const editModeActions = document.getElementById('editModeActions');
const exitEditModeBtn = document.getElementById('exitEditModeBtn');

// ⭐ НОВЫЕ ЭЛЕМЕНТЫ ДЛЯ РЕДАКТИРОВАНИЯ ЗАГОЛОВКА
const viewTitleDisplayContainer = document.getElementById('viewTitleDisplayContainer');
const viewTitleDisplay = document.getElementById('viewTitleDisplay'); 
const viewTitleEditBtn = document.getElementById('viewTitleEditBtn'); 
const viewTitleEditForm = document.getElementById('viewTitleEditForm');
const viewTitleInput = document.getElementById('viewTitleInput');
const viewTitleSaveBtn = document.getElementById('viewTitleSaveBtn');
const viewTitleCancelBtn = document.getElementById('viewTitleCancelBtn');


/* ====== Data ====== */
let workouts = [];
let currentTempTitle = '';
let tempExercises = [];
let editingWorkoutId = null;
let activeViewId = null;
let editingViewExerciseIndex = null; 
// ⭐ НОВОЕ: Флаг для отслеживания, откуда мы пришли в CreateModal
let cameFromViewModal = false;

/* ====== API Helper ====== */
async function api(path, method = 'GET', data = null) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : null
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return null;
}

/* ====== User API ====== */
async function registerUser() {
    if (!tgUser?.id) return;
    await api('/api/register_user', 'POST', {
        Id: tgUser.id,
        Username: tgUser.username || tgUser.first_name,
        AvatarUrl: tgUser.photo_url || ""
    });
}

async function getProfile() {
    const profile = await api(`/api/get_profile?user_id=${tgUser.id}`);
    profileAvatar.src = profile.avatar_url || tgUser.photo_url;
    profileName.textContent = profile.username ? `@${profile.username}` : (tgUser.first_name || "");
    createdCount.textContent = profile.total_workouts || 0;
    completedCount.textContent = profile.completed_workouts || 0;
    notifyTime.value = profile.notify_time || '';

    overlay.classList.add('show'); 
    profileModal.classList.add('show');
    profileModal.setAttribute('aria-hidden', 'false');
}

async function saveProfileToServer(payload) {
    await api('/api/save_profile', 'POST', payload);
}

/* ====== Workouts API ====== */
async function loadWorkouts() {
    try {
        await registerUser();
        const res = await api(`/api/get_workouts?user_id=${tgUser.id}`);
        workouts = res || [];
        workouts = workouts.map(w => ({
            id: w.id,
            title: w.title || w.name || '',
            name: w.name || w.title || '',
            user_id: w.user_id,
            exercises: w.exercises || []
        }));
        renderWorkouts();
    } catch (err) {
        console.error("loadWorkouts error:", err);
    }
}

async function saveWorkoutToServer(payload) {
    const body = {
        id: payload.id || 0,
        user_id: payload.user_id,
        title: payload.title,
        exercises: payload.exercises.map(e => ({
            name: e.name,
            reps: e.reps,
            sets: e.sets ?? 1,
            min: e.min ?? 0,
            sec: e.sec ?? 0,
            desc: e.desc ?? ""
        }))
    };
    const saved = await api('/api/save_workout', 'POST', body);
    if (!saved) return null;
    saved.title = saved.title || saved.name || '';
    saved.name = saved.name || saved.title || '';
    saved.exercises = saved.exercises || [];
    return saved;
}

async function deleteWorkoutFromServer(id) {
    return await api('/api/delete_workout', 'POST', { id: id, user_id: tgUser.id });
}

/* ====== Overlay & Create Modal ====== */
function showOverlay() {
    overlay.classList.add('show'); 
}
function hideOverlay() {
    overlay.classList.remove('show'); 
}

// Новая функция для закрытия ProfileModal (для использования в openCreate)
function closeProfileModal(hideOverlayFlag = true) {
    if (hideOverlayFlag) hideOverlay();
    profileModal.classList.remove('show');
    profileModal.setAttribute('aria-hidden', 'true');
}

function closeCreate() {
    hideOverlay();
    createModal.classList.remove('show'); 
    createModal.setAttribute('aria-hidden', 'true');
    editingWorkoutId = null;
    cameFromViewModal = false; // Сброс флага
}

/**
 * Открывает модальное окно создания/редактирования тренировки.
 * @param {number|null} editId ID тренировки для редактирования, или null для создания.
 * @param {boolean} skipTitleStep Пропустить ли шаг ввода названия (актуально при добавлении упражнений из ViewModal).
 */
function openCreate(editId = null, skipTitleStep = false) {
    // Закрываем модалки, если открыты
    if (viewModal.classList.contains('show')) closeView(false); // передаем false, чтобы не скрывать оверлей
    if (profileModal.classList.contains('show')) closeProfileModal(false); // используем новую функцию

    showOverlay();
    createModal.classList.add('show'); 
    createModal.setAttribute('aria-hidden', 'false');

    // Сбрасываем форму упражнения и поля ввода
    exName.value = exDesc.value = exReps.value = exMin.value = exSec.value = '';
    exerciseForm.classList.remove('active'); 

    inputTrainingName.value = '';
    currentTempTitle = '';
    tempExercises = [];
    editingWorkoutId = null; 
    
    // ⭐ НОВОЕ: Устанавливаем флаг, если пришли из ViewModal для добавления упражнения
    cameFromViewModal = skipTitleStep && editId !== null;

    let initialFocus = inputTrainingName;

    if (editId !== null) {
        const w = workouts.find(x => Number(x.id) === Number(editId));
        if (w) {
            editingWorkoutId = Number(w.id);
            currentTempTitle = w.title || w.name || '';
            inputTrainingName.value = currentTempTitle;

            tempExercises = JSON.parse(JSON.stringify(w.exercises || []));
            tempExercises = tempExercises.map(e => ({
                name: e.name || e.Name || '',
                desc: e.desc ?? '',
                reps: e.reps ?? 0,
                min: e.min ?? 0,
                sec: e.sec ?? 0,
                sets: e.sets ?? 1
            }));

            // !!! ИЗМЕНЕНИЕ: Если пришли из ViewModal для добавления упр. (skipTitleStep=true)
            if (cameFromViewModal) { 
                trainingTitleDisplay.textContent = currentTempTitle;
                stepTitle.classList.remove('active');
                stepExercises.classList.add('active');
                
                // ⭐ ГЛАВНОЕ ИСПРАВЛЕНИЕ 1: Активируем форму упражнения сразу, минуя список
                exerciseForm.classList.add('active'); 
                initialFocus = exName; // Фокусируемся на первом поле формы упражнения
            } else {
                // Обычное редактирование (через кнопку Edit на главной)
                stepTitle.classList.add('active');
                stepExercises.classList.remove('active');
            }
        }
    } else {
        // Создание новой тренировки
        stepTitle.classList.add('active');
        stepExercises.classList.remove('active');
    }

    renderExerciseCards();
    updateSaveTrainingBtn();

    document.activeElement.blur(); 
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); 
    window.Telegram?.WebApp?.disableVerticalScroll(true); 

    setTimeout(() => {
        initialFocus.focus();
        window.Telegram?.WebApp?.enableVerticalScroll(true);
    }, 150);
}

/* ====== Exercises (Create Modal) - Функции не изменились ====== */
toggleExerciseFormBtn.addEventListener('click', () => {
    // В режиме добавления упражнения (cameFromViewModal) этой кнопки нет.
    exerciseForm.classList.toggle('active');
    if (exerciseForm.classList.contains('active')) exName.focus();
});

cancelExerciseBtn.addEventListener('click', () => {
    // Если пришли из ViewModal, кнопка "Отмена" должна закрыть CreateModal
    if (cameFromViewModal) {
        closeCreate();
        openView(activeViewId, false); // Возвращаемся в ViewModal (не показывая снова оверлей)
        viewModal.classList.add('edit-mode'); // И в режим редактирования списка
        renderViewExercises();
        return;
    }

    // Стандартный функционал (отмена ввода данных)
    exName.value = exDesc.value = exReps.value = exMin.value = exSec.value = '';
    exerciseForm.classList.remove('active');
});

saveExerciseBtn.addEventListener('click', () => {
    const name = exName.value.trim();
    const desc = exDesc.value.trim();
    const reps = parseInt(exReps.value);
    const min = parseInt(exMin.value || 0);
    const sec = parseInt(exSec.value || 0);

    if (!name || !reps || reps < 1) { alert('Название и количество повторений (больше 0) обязательны'); return; }

    const editIndex = saveExerciseBtn.dataset.editIndex;
    if (editIndex !== undefined && editIndex !== '') {
        // Редактирование существующего упражнения
        tempExercises[+editIndex] = { name, desc, reps, min, sec, sets: 1 };
        delete saveExerciseBtn.dataset.editIndex;
    } else {
        // Добавление нового упражнения
        tempExercises.push({ name, desc, reps, min, sec, sets: 1 });
    }

    // Если пришли из ViewModal, сохраняем тренировку сразу и возвращаемся
    if (cameFromViewModal) {
        // Здесь мы уже имеем updated tempExercises.
        // Нужно обновить оригинальную тренировку и вернуться в ViewModal.
        saveAndReturnFromCreateModal();
        return;
    }

    // Стандартный функционал (продолжение редактирования/создания в CreateModal)
    exName.value = exDesc.value = exReps.value = exMin.value = exSec.value = '';
    exerciseForm.classList.remove('active');
    renderExerciseCards();
    updateSaveTrainingBtn();
});

// ⭐ НОВАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ СОХРАНЕНИЯ И ВОЗВРАТА ИЗ CREATE MODAL
async function saveAndReturnFromCreateModal() {
    const payload = {
        id: editingWorkoutId,
        user_id: tgUser.id,
        title: currentTempTitle,
        exercises: tempExercises
    };

    try {
        await saveWorkoutToServer(payload);
        
        // Обновляем список workouts на главной
        await loadWorkouts(); 

        closeCreate(); // Закрываем CreateModal
        
        // Возвращаемся в ViewModal в режиме редактирования списка
        if (activeViewId) {
            openView(activeViewId, false); // Открываем ViewModal, не показывая оверлей (он уже открыт)
            viewModal.classList.add('edit-mode'); 
            renderViewExercises();
        }

    } catch (err) {
        console.error("saveAndReturnFromCreateModal error:", err);
        alert("Ошибка при сохранении упражнения. Посмотрите консоль.");
    }
}

/* ====== Switching steps ====== */
toExercisesBtn.addEventListener('click', () => {
    const name = inputTrainingName.value.trim();
    if (!name) { alert('Введите название тренировки'); return; }
    currentTempTitle = name;
    trainingTitleDisplay.textContent = name;
    stepTitle.classList.remove('active');
    stepExercises.classList.add('active');
    // Фокусировка на кнопке "Добавить упражнение"
    toggleExerciseFormBtn.focus();
});

// ⭐ ГЛАВНОЕ ИСПРАВЛЕНИЕ 2: Обработчик кнопки "Назад" (для CreateModal)
backToTitleBtn.addEventListener('click', () => {
    if (cameFromViewModal) {
        // Если пришли из ViewModal, закрываем CreateModal и возвращаемся в ViewModal
        closeCreate();
        // openView(activeViewId, false); // ViewModal уже был открыт, но был закрыт openCreate.
        // Нужно его открыть снова и активировать режим редактирования.
        if (activeViewId) {
            openView(activeViewId, false); // Открываем ViewModal, не показывая оверлей
            viewModal.classList.add('edit-mode');
            renderViewExercises();
        }
    } else {
        // Стандартный путь: возврат на шаг ввода названия
        stepTitle.classList.add('active');
        stepExercises.classList.remove('active');
    }
});

/* ====== Save workout (Create Modal) ====== */
saveTrainingBtn.addEventListener('click', async () => {
    if (tempExercises.length < 1) { alert('Добавьте хотя бы одно упражнение'); return; }
    
    // Если пришли из ViewModal, мы уже сохранили в saveExerciseBtn
    if (cameFromViewModal) {
        closeCreate();
        return;
    }

    const payload = {
        id: editingWorkoutId || 0,
        user_id: tgUser.id,
        title: currentTempTitle,
        exercises: tempExercises
    };

    try {
        const savedWorkout = await saveWorkoutToServer(payload);
        if (!savedWorkout) throw new Error("Не удалось сохранить тренировку");

        if (editingWorkoutId) {
            const index = workouts.findIndex(w => Number(w.id) === Number(editingWorkoutId));
            if (index > -1) workouts[index] = savedWorkout;

            if (activeViewId === editingWorkoutId && viewModal.classList.contains('show')) {
                if (viewTitleDisplay) viewTitleDisplay.textContent = savedWorkout.title; 
                if (viewModal.classList.contains('edit-mode')) {
                    exitEditMode(); 
                    renderViewExercises();
                } else {
                    renderViewExercises(); 
                }
            }
        } else {
            workouts.push(savedWorkout);
        }

        renderWorkouts();
        closeCreate();
    } catch (err) {
        console.error("saveTraining error:", err);
        alert("Ошибка при сохранении тренировки. Посмотрите консоль.");
    }
});

/* ====== Render workouts - Функция не изменилась ====== */
function renderWorkouts() {
    workoutContainer.innerHTML = '';
    if (!workouts.length) { 
        workoutContainer.innerHTML = '<p class="empty-text">Список тренировок пуст.</p>'; 
        return; 
    }
    workouts.forEach(w => {
        const title = w.title || w.name || 'Без названия';
        const div = document.createElement('div');
        div.className = 'workout-card';
        div.innerHTML = `<div class="workout-title">${title}</div><div class="workout-info">${(w.exercises || []).length} упражнений</div>`;
        div.onclick = () => openView(w.id);
        workoutContainer.appendChild(div);
    });
}

/* ====== Exercise cards (Create Modal) - Функции не изменились ====== */
function renderExerciseCards() {
    exerciseList.innerHTML = '';
    tempExercises.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'exercise-card';
        // Улучшаем отображение в модалке создания/редактирования
        const timeDisplay = ex.min > 0 || ex.sec > 0 ? `${ex.min}м ${ex.sec}с` : '';
        div.innerHTML = `
            <div class="ex-card-head">
                <div class="ex-title">${ex.name}</div>
                <div class="ex-meta">${ex.reps} повт ${timeDisplay ? `• ${timeDisplay}` : ''}</div>
            </div>
            <div class="ex-actions">
                <button class="icon-small" onclick="editExercise(${idx})">✎</button>
                <button class="icon-small" onclick="deleteExercise(${idx})">🗑</button>
            </div>
        `;
        exerciseList.appendChild(div);
    });
}

function editExercise(idx) {
    const ex = tempExercises[idx];
    exName.value = ex.name; exDesc.value = ex.desc; exReps.value = ex.reps; exMin.value = ex.min; exSec.value = ex.sec;
    exerciseForm.classList.add('active');
    saveExerciseBtn.dataset.editIndex = idx;
    exName.focus(); // Фокусируемся на имени
}

function deleteExercise(idx) {
    tempExercises.splice(idx, 1);
    renderExerciseCards();
    updateSaveTrainingBtn();
}

function updateSaveTrainingBtn() {
    saveTrainingBtn.disabled = tempExercises.length < 1;
    saveTrainingBtn.classList.toggle('disabled', tempExercises.length < 1);
}

/* ====== Profile - Функции не изменились ====== */
profileBtn.addEventListener('click', getProfile);
closeProfileBtn.addEventListener('click', () => closeProfileModal(true));

saveProfileBtn.addEventListener('click', async () => {
    await saveProfileToServer({ Id: tgUser.id, NotifyTime: notifyTime.value });
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    closeProfileModal(true);
});

// --- НОВЫЕ/ИЗМЕНЕННЫЕ ФУНКЦИИ УПРАВЛЕНИЯ РЕДАКТИРОВАНИЕМ В VIEW MODAL ---

/**
 * Асинхронно сохраняет изменения тренировки на сервере и обновляет UI.
 * @param {object} workout - Объект тренировки.
 */
async function saveWorkoutChanges(workout) {
    try {
        const savedWorkout = await saveWorkoutToServer({ 
            id: workout.id, 
            user_id: workout.user_id, 
            title: workout.title, 
            exercises: workout.exercises 
        });
        
        const index = workouts.findIndex(x => Number(x.id) === Number(activeViewId));
        if (index > -1) workouts[index] = savedWorkout;

        renderWorkouts(); 
        renderViewExercises();
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err) {
        console.error("Ошибка при сохранении редактирования:", err);
        alert("Ошибка при сохранении. Посмотрите консоль.");
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    }
}

// ⭐ ЛОГИКА РЕДАКТИРОВАНИЯ НАЗВАНИЯ ТРЕНИРОВКИ (Осталась без изменений)

function startTitleEdit() {
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;
    
    if (viewTitleEditForm && viewTitleInput && viewTitleDisplayContainer) {
        viewTitleEditForm.style.display = 'flex';
        viewTitleDisplayContainer.style.display = 'none';
        
        viewTitleInput.value = w.title;
        viewTitleInput.focus();
        
        renderViewExercises();
    }
}

function cancelTitleEdit() {
    if (viewTitleEditForm && viewTitleDisplayContainer) {
        viewTitleEditForm.style.display = 'none';
        viewTitleDisplayContainer.style.display = 'flex';
        
        renderViewExercises(); 
    }
}

async function saveTitleEdit() {
    const newTitle = viewTitleInput.value.trim();
    if (!newTitle) {
        alert("Название тренировки не может быть пустым.");
        viewTitleInput.focus();
        return;
    }
    
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;
    
    w.title = newTitle;
    w.name = newTitle; 
    
    if(viewTitleDisplay) viewTitleDisplay.textContent = newTitle; 
    
    await saveWorkoutChanges(w); 
    
    cancelTitleEdit(); 
}

// ⭐ КОНЕЦ ЛОГИКИ РЕДАКТИРОВАНИЯ НАЗВАНИЯ ТРЕНИРОВКИ

function startEditViewExercise(idx) {
    if (viewTitleEditForm && viewTitleEditForm.style.display === 'flex') return;

    editingViewExerciseIndex = idx;
    renderViewExercises(); 
    
    setTimeout(() => {
        const form = viewBody.querySelector(`.view-edit-form[data-index="${idx}"]`);
        form?.querySelector('[data-field="name"]')?.focus();
    }, 0); 
}

function cancelEditViewExercise() {
    editingViewExerciseIndex = null;
    renderViewExercises();
}

function deleteViewExercise(idx) {
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;
    
    if (confirm('Удалить это упражнение из тренировки?')) {
        w.exercises.splice(idx, 1);
        saveWorkoutChanges(w);
    }
}

async function saveOneViewExercise(idx) {
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;

    const form = viewBody.querySelector(`.view-edit-form[data-index="${idx}"]`);
    const name = form.querySelector('[data-field="name"]').value.trim();
    const desc = form.querySelector('[data-field="desc"]').value.trim();
    const reps = parseInt(form.querySelector('[data-field="reps"]').value) || 0;
    const min = parseInt(form.querySelector('[data-field="min"]').value) || 0;
    const sec = parseInt(form.querySelector('[data-field="sec"]').value) || 0;

    if (!name || reps <= 0) {
        alert('Название и количество повторений (больше 0) обязательны');
        return;
    }

    w.exercises[idx] = { name, desc, reps, min, sec, sets: 1 };
    
    await saveWorkoutChanges(w);
    
    cancelEditViewExercise();
}

function exitEditMode() {
    viewModal.classList.remove('edit-mode');
    editingViewExerciseIndex = null;
    cancelTitleEdit(); 
    renderViewExercises(); 
}

/* ====== View modal (Просмотр и Редактирование на месте) ====== */
function renderViewExercises() {
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;
    viewBody.innerHTML = '';
    
    const isEditMode = viewModal.classList.contains('edit-mode');
    const isTitleEditing = viewTitleEditForm?.style.display === 'flex';

    // Управление отображением кнопок в заголовке
    if (mainViewActions && editModeActions) {
        mainViewActions.style.display = isEditMode ? 'none' : 'flex'; 
        editModeActions.style.display = isEditMode && !isTitleEditing ? 'flex' : 'none'; 
    }
    
    // Управление видимостью кнопки-карандаша для названия
    if (viewTitleEditBtn) {
        viewTitleEditBtn.style.display = (isEditMode && !isTitleEditing) ? 'block' : 'none'; 
    }
    if (viewTitleDisplay) {
        viewTitleDisplay.textContent = w.title || w.name || 'Без названия';
    }
    if (viewTitleDisplayContainer) {
        viewTitleDisplayContainer.style.display = isTitleEditing ? 'none' : 'flex';
    }


    (w.exercises || []).forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'view-ex';
        
        const isEditingThisExercise = isEditMode && editingViewExerciseIndex === idx;

        if (isTitleEditing) {
             div.classList.remove('is-editing');
        } else if (isEditingThisExercise) {
             div.classList.add('is-editing');
        }
        
        // ⭐ ГЛАВНОЕ ИСПРАВЛЕНИЕ 3: Улучшение отображения карточек упражнений
        const meta = `${ex.reps} повт ${ex.min > 0 || ex.sec > 0 ? `• ${ex.min}м ${ex.sec}с` : ''}`;
        
        // --- 1. БЛОК ОТОБРАЖЕНИЯ (только текст) ---
        const displayBlock = `
            <div class="view-display">
                <div style="font-weight:700">${idx + 1}. ${ex.name}</div>
                ${ex.desc ? `<div style="margin-top:4px;color:rgba(255,255,255,0.8);font-size:0.9em;">${ex.desc}</div>` : ''}
                <div style="color:rgba(255,255,255,0.7);margin-top:4px;">${meta}</div>
            </div>`;
        
        // --- 2. БЛОК РЕДАКТИРОВАНИЯ СПИСКА (кнопки) ---
        const editListBlock = `
            <div class="view-edit-list-item">
                <div style="font-weight:600; flex-grow:1;">${idx + 1}. ${ex.name}</div>
                <div class="ex-actions" style="display:flex; gap:8px;">
                    <button class="icon-small" onclick="startEditViewExercise(${idx})">✎</button>
                    <button class="icon-small" onclick="deleteViewExercise(${idx})">🗑</button>
            </div>
            </div>`;
        
        // --- 3. ФОРМА РЕДАКТИРОВАНИЯ (поля ввода) ---
        const editForm = `
            <div class="view-edit-form" data-index="${idx}">
                <div style="font-weight:700; margin-bottom:10px;">Редактирование: ${ex.name}</div>
                <input type="text" value="${ex.name}" placeholder="Название упражнения" data-field="name">
                <input type="text" value="${ex.desc || ''}" placeholder="Описание" data-field="desc">
                <input type="number" value="${ex.reps}" placeholder="Повторения *" min="1" data-field="reps">
                <div class="time-row">
                    <input type="number" value="${ex.min}" placeholder="Мин" min="0" data-field="min">
                    <input type="number" value="${ex.sec}" placeholder="Сек" min="0" max="59" data-field="sec">
                </div>
                <div class="row end" style="margin-top:10px;">
                    <button class="btn ghost" onclick="cancelEditViewExercise()">Отмена</button>
                    <button class="btn primary" onclick="saveOneViewExercise(${idx})">Сохранить упражнение</button>
                </div>
            </div>`;

        if (isEditMode && !isTitleEditing) {
            if (isEditingThisExercise) {
                 div.innerHTML = editForm;
            } else {
                // В режиме редактирования списка показываем имя и кнопки
                // Добавляем мета-информацию, чтобы карточки были похожи на карточки в CreateModal
                div.innerHTML = `
                    <div class="view-ex-card-wrapper">
                        <div style="font-weight:600; flex-grow:1;">${idx + 1}. ${ex.name}</div>
                        <div style="color:rgba(255,255,255,0.7); font-size: 0.8em; margin-bottom: 5px;">${meta}</div>
                        <div class="ex-actions" style="display:flex; gap:8px;">
                            <button class="icon-small" onclick="startEditViewExercise(${idx})">✎</button>
                            <button class="icon-small" onclick="deleteViewExercise(${idx})">🗑</button>
                        </div>
                    </div>
                `;
                div.className = 'view-ex edit-mode-list-item'; // Новый класс для стилизации списка редактирования
            }
        } else {
            // Режим просмотра (улучшенная карточка)
            div.innerHTML = displayBlock;
        }

        viewBody.appendChild(div);
    });
    
    // Кнопка "Добавить упражнение"
    if (isEditMode && editingViewExerciseIndex === null && !isTitleEditing) {
        const addBtn = document.createElement('div');
        addBtn.innerHTML = `<button class="btn add-ex" onclick="openCreate(${w.id}, true)">+ Добавить упражнение</button>`;
        addBtn.style.marginTop = '15px';
        viewBody.appendChild(addBtn);
    }
}


/**
 * Открывает модальное окно просмотра.
 * @param {number|null} id ID тренировки.
 * @param {boolean} showOverlayFlag Отображать ли оверлей (по умолчанию true).
 */
function openView(id, showOverlayFlag = true) {
    activeViewId = Number(id);
    if (showOverlayFlag) showOverlay();
    viewModal.classList.add('show');
    viewModal.classList.remove('edit-mode'); 
    editingViewExerciseIndex = null; 
    
    const w = workouts.find(x => Number(x.id) === Number(id));
    if(viewTitleDisplay) viewTitleDisplay.textContent = w?.title || w?.name || 'Без названия';
    
    if (viewTitleEditForm) viewTitleEditForm.style.display = 'none';
    
    renderViewExercises();
}

/**
 * Закрывает модальное окно просмотра.
 * @param {boolean} hideOverlayFlag Скрывать ли оверлей (по умолчанию true).
 */
function closeView(hideOverlayFlag = true) {
    viewModal.classList.remove('show');
    viewModal.classList.remove('edit-mode'); 
    editingViewExerciseIndex = null; 
    if (hideOverlayFlag) hideOverlay();
    activeViewId = null;
    cancelTitleEdit(); 
}

/* ====== Event listeners ====== */
openCreateModal.addEventListener('click', () => openCreate());
closeCreateModal.addEventListener('click', closeCreate);

// ИСПРАВЛЕННЫЙ ОБРАБОТЧИК КЛИКА ПО ОВЕРЛЕЮ
overlay.addEventListener('click', () => {
    // Внимание: если cameFromViewModal = true, закрытие оверлея может быть нежелательным,
    // так как мы переходим между модалками. Однако, если пользователь кликнул вне модалок, 
    // скорее всего, он хочет закрыть текущий процесс.
    if (viewModal.classList.contains('show')) {
        closeView();
    } else if (profileModal.classList.contains('show')) {
        closeProfileModal();
    } else if (createModal.classList.contains('show')) { 
        // Здесь мы можем решить, что если мы в CreateModal, просто закрываем ее.
        closeCreate();
    }
});

// Кнопка "Редактировать" в View Modal
editWorkoutBtn.addEventListener('click', () => { 
    if (activeViewId === null) return;
    viewModal.classList.add('edit-mode'); 
    editingViewExerciseIndex = null; 
    renderViewExercises(); 
});

deleteWorkoutBtn.addEventListener('click', async () => {
    if (activeViewId === null) return;
    if (!confirm("Удалить эту тренировку?")) return;
    try {
        await deleteWorkoutFromServer(Number(activeViewId));
        workouts = workouts.filter(w => Number(w.id) !== Number(activeViewId));
        renderWorkouts();
        closeView();
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err) { 
        console.error(err); 
        alert("Ошибка при удалении тренировки."); 
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    }
});
closeViewBtn.addEventListener('click', closeView);

if (exitEditModeBtn) exitEditModeBtn.addEventListener('click', exitEditMode);
cancelViewEditBtn.addEventListener('click', exitEditMode); 

saveViewChangesBtn.addEventListener('click', async () => {
    alert("Кнопка 'Сохранить изменения' теперь не используется. Сохранение происходит автоматически при редактировании названия или при нажатии 'Сохранить упражнение'.");
});

if (viewTitleEditBtn) viewTitleEditBtn.addEventListener('click', startTitleEdit);
if (viewTitleSaveBtn) viewTitleSaveBtn.addEventListener('click', saveTitleEdit);
if (viewTitleCancelBtn) viewTitleCancelBtn.addEventListener('click', cancelTitleEdit);


/* ====== Global helpers ====== */
window.editExercise = editExercise;
window.deleteExercise = deleteExercise;
window.startEditViewExercise = startEditViewExercise; 
window.cancelEditViewExercise = cancelEditViewExercise; 
window.deleteViewExercise = deleteViewExercise; 
window.saveOneViewExercise = saveOneViewExercise; 
window.exitEditMode = exitEditMode; 
window.startTitleEdit = startTitleEdit; 
window.saveTitleEdit = saveTitleEdit; 
window.cancelTitleEdit = cancelTitleEdit; 
window.closeProfileModal = closeProfileModal; // Сделаем глобальной для чистоты

/* ====== Init ====== */
window.addEventListener('DOMContentLoaded', loadWorkouts);