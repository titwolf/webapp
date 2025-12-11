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
if (topBar) {
    window.addEventListener('scroll', () => {
        const cur = window.pageYOffset || document.documentElement.scrollTop;
        topBar.style.transform = cur > lastScroll ? 'translateY(-100%)' : 'translateY(0)';
        lastScroll = cur <= 0 ? 0 : cur;
    });
}

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

// ⭐ Элементы формы добавления упражнения внутри View Modal (Для фикса Бага 1)
const viewExerciseForm = document.getElementById('viewExerciseForm');
const viewExName = document.getElementById('viewExName');
const viewExDesc = document.getElementById('viewExDesc');
const viewExReps = document.getElementById('viewExReps');
const viewExMin = document.getElementById('viewExMin');
const viewExSec = document.getElementById('viewExSec');
const saveNewViewExerciseBtn = document.getElementById('saveNewViewExerciseBtn');
const cancelNewViewExerciseBtn = document.getElementById('cancelNewViewExerciseBtn');

// Кнопка, которую мы используем для отображения формы
const addExerciseToViewBtn = document.getElementById('addExerciseToViewBtn'); 


/* ====== Data ====== */
let workouts = [];
let currentTempTitle = '';
let tempExercises = [];
let editingWorkoutId = null;
let activeViewId = null;
let editingViewExerciseIndex = null; 

// ⭐ ГЛОБАЛЬНОЕ СОСТОЯНИЕ ДЛЯ ФИКСА БАГА 2
let isAddingNewExerciseInView = false;
let currentWorkoutId = null; 

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
    if (profileAvatar) profileAvatar.src = profile.avatar_url || tgUser.photo_url;
    if (profileName) profileName.textContent = profile.username ? `@${profile.username}` : (tgUser.first_name || "Неизвестный");
    if (createdCount) createdCount.textContent = profile.total_workouts;
    if (completedCount) completedCount.textContent = profile.completed_workouts;
    if (notifyTime) notifyTime.value = profile.notify_time || "08:00";
}

async function saveProfile() {
    const time = notifyTime?.value || "08:00";
    const payload = {
        Id: tgUser.id,
        Username: profileName?.textContent?.replace('@', '') || tgUser.username || tgUser.first_name || "",
        AvatarUrl: tgUser.photo_url || "",
        NotifyTime: time
    };
    await api('/api/save_profile', 'POST', payload);
}

/* ====== Workout API ====== */
async function fetchWorkouts() {
    if (!tgUser.id) return;
    try {
        workouts = await api(`/api/get_workouts?user_id=${tgUser.id}`);
    } catch (e) {
        console.error('Ошибка загрузки тренировок:', e);
        workouts = [];
    }
}

/**
 * Отправляет или обновляет тренировку на сервер.
 * @param {object} payload - Объект WorkoutDto
 */
async function saveWorkout(payload) {
    try {
        const saved = await api('/api/save_workout', 'POST', payload);
        if (!saved) return null;
        
        // Обновляем локальный список после сохранения
        await fetchWorkouts(); 
        return saved;
    } catch (error) {
        console.error('Ошибка сохранения тренировки:', error);
        alert(`Ошибка сохранения: ${error.message}`);
        return null;
    }
}

/**
 * Сохраняет изменения существующей тренировки в режиме просмотра.
 * Формирует payload из текущего состояния объекта в памяти.
 * @param {object} workout - Объект тренировки из массива workouts
 * @returns {Promise<boolean>}
 */
async function saveWorkoutChanges(workout) {
    const payload = {
        id: workout.id,
        user_id: workout.user_id,
        title: workout.title || workout.name,
        exercises: workout.exercises.map(e => ({
            id: e.id || 0, // Id может быть 0, если упражнение новое
            name: e.name,
            // ⭐ ИСПРАВЛЕНО: Использование 'desc' вместо 'description'
            desc: e.desc || null, 
            reps: e.reps,
            sets: e.sets || 1,
            min: e.min || 0,
            sec: e.sec || 0
        }))
    };

    const saved = await saveWorkout(payload);
    return !!saved;
}


async function deleteWorkoutFromServer(id) {
    return await api('/api/delete_workout', 'POST', { id: id, user_id: tgUser.id });
}

/* ====== Overlay & Create Modal ====== */
function showOverlay() {
    if(overlay) overlay.classList.add('show');
}

function hideOverlay() {
    if(overlay) overlay.classList.remove('show');
}

/**
 * Открывает модальное окно создания/редактирования тренировки.
 * @param {number|null} editId ID тренировки для редактирования, или null для создания.
 * @param {boolean} skipTitleStep Пропустить ли шаг ввода названия.
 */
function openCreate(editId = null, skipTitleStep = false) {
    editingWorkoutId = editId;
    tempExercises = [];
    currentTempTitle = '';

    if (editId) {
        const workout = workouts.find(w => w.id === editId);
        if (workout) {
            currentTempTitle = workout.title || workout.name;
            tempExercises = workout.exercises.map(ex => ({
                name: ex.name,
                // ⭐ ИСПРАВЛЕНО: Использование 'desc'
                desc: ex.desc, 
                reps: ex.reps,
                min: ex.min,
                sec: ex.sec,
                sets: ex.sets || 1
            }));
        }
    }
    
    if (inputTrainingName) inputTrainingName.value = currentTempTitle;
    
    if (skipTitleStep || editId) {
        if (stepTitle) stepTitle.classList.remove('active');
        if (stepExercises) stepExercises.classList.add('active');
    } else {
        if (stepTitle) stepTitle.classList.add('active');
        if (stepExercises) stepExercises.classList.remove('active');
    }

    renderExerciseForm(false);
    renderExerciseList();
    
    // Сброс полей формы добавления упражнения
    if(exName) exName.value = '';
    if(exDesc) exDesc.value = '';
    if(exReps) exReps.value = '';
    if(exMin) exMin.value = '';
    if(exSec) exSec.value = '';

    if (saveTrainingBtn) saveTrainingBtn.textContent = editId ? 'Сохранить изменения' : 'Сохранить тренировку';
    
    openModal(createModal);
}

function closeCreate() {
    closeModal(createModal);
    editingWorkoutId = null;
}

/* ====== Universal Modal functions ====== */
function openModal(modal) {
    modal.classList.add('show');
    showOverlay();
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('show');
    // Проверяем, если не осталось открытых модалок
    if (!createModal?.classList.contains('show') && !viewModal?.classList.contains('show') && !profileModal?.classList.contains('show')) {
        hideOverlay();
        document.body.style.overflow = '';
    }
}


/* ====== Create Modal Step Logic ====== */
if (toExercisesBtn) {
    toExercisesBtn.addEventListener('click', () => {
        const title = inputTrainingName?.value.trim();
        if (!title) {
            alert('Пожалуйста, введите название тренировки.');
            return;
        }
        currentTempTitle = title;
        if (stepTitle) stepTitle.classList.remove('active');
        if (stepExercises) stepExercises.classList.add('active');
        if (trainingTitleDisplay) trainingTitleDisplay.textContent = currentTempTitle;
    });
}

if (backToTitleBtn) {
    backToTitleBtn.addEventListener('click', () => {
        if (stepExercises) stepExercises.classList.remove('active');
        if (stepTitle) stepTitle.classList.add('active');
    });
}


/* ====== Create Modal Exercise Form Logic ====== */
function renderExerciseForm(show = false) {
    if (!exerciseForm) return;
    exerciseForm.style.display = show ? 'block' : 'none';
    if (toggleExerciseFormBtn) toggleExerciseFormBtn.textContent = show ? 'Скрыть форму' : 'Добавить упражнение';
    if (saveExerciseBtn) saveExerciseBtn.textContent = 'Сохранить';
    if (saveExerciseBtn) delete saveExerciseBtn.dataset.editIndex; // Сброс индекса редактирования
}

if (toggleExerciseFormBtn) {
    toggleExerciseFormBtn.addEventListener('click', () => {
        renderExerciseForm(exerciseForm.style.display === 'none');
    });
}

if (cancelExerciseBtn) {
    cancelExerciseBtn.addEventListener('click', () => {
        renderExerciseForm(false);
        // Сброс полей формы
        if(exName) exName.value = '';
        if(exDesc) exDesc.value = '';
        if(exReps) exReps.value = '';
        if(exMin) exMin.value = '';
        if(exSec) exSec.value = '';
    });
}

if (saveExerciseBtn) {
    saveExerciseBtn.addEventListener('click', () => {
        const name = exName ? exName.value.trim() : '';
        const desc = exDesc ? exDesc.value.trim() : '';
        const reps = parseInt(exReps ? exReps.value : 0 || 0);
        const min = parseInt(exMin ? exMin.value : 0 || 0);
        const sec = parseInt(exSec ? exSec.value : 0 || 0);

        if (!name || !reps || reps < 1) {
            alert('Название и количество повторений (больше 0) обязательны');
            return;
        }

        const editIndex = saveExerciseBtn.dataset.editIndex;
        if (editIndex !== undefined && editIndex !== '') {
            // Мы редактируем tempExercises, так как это CreateModal
            tempExercises[+editIndex] = { name, 
                // ⭐ ИСПРАВЛЕНО: Использование 'desc'
                desc, 
                reps, min, sec, sets: 1 };
            delete saveExerciseBtn.dataset.editIndex;
        } else {
            tempExercises.push({ name, 
                // ⭐ ИСПРАВЛЕНО: Использование 'desc'
                desc, 
                reps, min, sec, sets: 1 });
        }

        if (exName) exName.value = '';
        if (exDesc) exDesc.value = '';
        if (exReps) exReps.value = '';
        if (exMin) exMin.value = '';
        if (exSec) exSec.value = '';

        renderExerciseForm(false); // Скрываем форму после сохранения/обновления
        renderExerciseList();
    });
}

/* ====== Create Modal Exercise List Logic ====== */
function renderExerciseList() {
    if (!exerciseList) return;
    if (tempExercises.length === 0) {
        exerciseList.innerHTML = '<p class="empty-text">Список упражнений пуст.</p>';
        if (saveTrainingBtn) saveTrainingBtn.disabled = true;
        return;
    }
    
    if (saveTrainingBtn) saveTrainingBtn.disabled = false;
    
    exerciseList.innerHTML = '';
    tempExercises.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'exercise-card';
        // Формируем строку описания
        const descHtml = ex.desc ? `<div class="ex-desc">${ex.desc}</div>` : '';
        
        div.innerHTML = `
            <div class="ex-card-head">
                <div class="ex-title">${ex.name}</div>
                <div class="ex-meta">${ex.reps} повт • ${ex.min}м ${ex.sec}с</div>
            </div>
            ${descHtml}
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
    if (exName) exName.value = ex.name;
    if (exDesc) exDesc.value = ex.desc || '';
    if (exReps) exReps.value = ex.reps;
    if (exMin) exMin.value = ex.min;
    if (exSec) exSec.value = ex.sec;

    if (saveExerciseBtn) {
        saveExerciseBtn.textContent = 'Обновить';
        saveExerciseBtn.dataset.editIndex = idx;
    }
    renderExerciseForm(true);
}

function deleteExercise(idx) {
    if (confirm(`Удалить упражнение "${tempExercises[idx].name}"?`)) {
        tempExercises.splice(idx, 1);
        renderExerciseList();
    }
}


/* ====== Create Modal Save Training Logic ====== */
if (saveTrainingBtn) {
    saveTrainingBtn.addEventListener('click', async () => {
        if (tempExercises.length === 0) {
            alert('Добавьте хотя бы одно упражнение.');
            return;
        }

        const payload = {
            id: editingWorkoutId || 0,
            user_id: tgUser.id,
            title: currentTempTitle,
            exercises: tempExercises.map(ex => ({
                // Id не нужен, так как это DTO для сохранения новых/обновления.
                name: ex.name,
                // ⭐ ИСПРАВЛЕНО: Использование 'desc'
                desc: ex.desc || null, 
                reps: ex.reps,
                sets: ex.sets || 1,
                min: ex.min || 0,
                sec: ex.sec || 0
            }))
        };
        
        const saved = await saveWorkout(payload);
        if (saved) {
            closeCreate();
            renderWorkouts();
        }
    });
}


/* ====== Main App Logic ====== */
document.addEventListener('DOMContentLoaded', async () => {
    await registerUser();
    await fetchWorkouts();
    renderWorkouts();

    // Добавляем обработчики для модалок, чтобы они работали
    if (openCreateModal) openCreateModal.addEventListener('click', () => openCreate());
    if (closeCreateModal) closeCreateModal.addEventListener('click', closeCreate);

    // ИСПРАВЛЕННЫЙ ОБРАБОТЧИК КЛИКА ПО ОВЕРЛЕЮ
    if (overlay && viewModal && profileModal && createModal) {
        overlay.addEventListener('click', () => {
            if (viewModal.classList.contains('show')) {
                // Если открыт viewModal, проверяем режим редактирования
                if (viewModal.classList.contains('edit-mode') && (isAddingNewExerciseInView || editingViewExerciseIndex !== null)) {
                    // Если открыта форма добавления или редактирования упражнения, не закрываем модалку по оверлею
                    return; 
                }
                closeView();
            } else if (createModal.classList.contains('show')) {
                closeCreate();
            } else if (profileModal.classList.contains('show')) {
                closeProfile();
            }
        });
    }
});


/* ====== Profile Modal Logic ====== */
if (profileBtn) {
    profileBtn.addEventListener('click', async () => {
        if (!tgUser.id) {
            alert('Нет данных пользователя Telegram.');
            return;
        }
        try {
            await getProfile();
            openModal(profileModal);
        } catch (e) {
            alert('Не удалось загрузить данные профиля: ' + e.message);
        }
    });
}

if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', closeProfile);
}

function closeProfile() {
    closeModal(profileModal);
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        try {
            await saveProfile();
            alert('Профиль сохранен!');
            closeProfile();
        } catch (e) {
            alert('Ошибка сохранения профиля: ' + e.message);
        }
    });
}


/* ====== Rendering Main Workouts ====== */
function renderWorkouts() {
    if (!workoutContainer) return;
    if (workouts.length === 0) {
        workoutContainer.innerHTML = '<p class="empty-text">Список тренировок пуст.</p>';
        return;
    }

    workoutContainer.innerHTML = '';
    workouts.forEach(w => {
        const card = document.createElement('div');
        card.className = 'workout-card';
        const titleToDisplay = w.title || w.name || 'Без названия'; 
        const exerciseCount = w.exercises ? w.exercises.length : 0;
        card.innerHTML = `
            <h3>${titleToDisplay}</h3>
            <p>${exerciseCount} упражнений</p>
            <div class="row">
                <button class="btn primary small" onclick="openView(${w.id})">Просмотр</button>
                <button class="btn ghost small delete-btn" onclick="confirmDeleteWorkout(${w.id})">Удалить</button>
            </div>
        `;
        workoutContainer.appendChild(card);
    });
}


/* ====== View Modal Logic ====== */
function openView(id) {
    const w = workouts.find(x => Number(x.id) === Number(id));
    if (!w) {
        alert('Тренировка не найдена.');
        return;
    }
    
    activeViewId = id;
    
    // Сброс режима редактирования и добавления
    viewModal?.classList.remove('edit-mode');
    editingViewExerciseIndex = null;
    isAddingNewExerciseInView = false;
    
    if (viewTitleDisplay) viewTitleDisplay.textContent = w.title || w.name;
    if (viewTitleInput) viewTitleInput.value = w.title || w.name;
    
    // Скрываем форму добавления
    if (viewExerciseForm) viewExerciseForm.style.display = 'none';

    // Скрываем форму редактирования заголовка
    cancelTitleEdit(); 

    // Скрываем кнопки редактирования (если не в режиме)
    if (mainViewActions) mainViewActions.style.display = 'flex';
    if (editModeActions) editModeActions.style.display = 'none';

    renderViewExercises();
    openModal(viewModal);
}

function closeView() {
    closeModal(viewModal);
    activeViewId = null;
}

if (closeViewBtn) {
    closeViewBtn.addEventListener('click', closeView);
}


/* ====== View Modal Exercise Rendering ====== */
function renderViewExercises() {
    if (!viewBody) return;
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w || !w.exercises) {
        viewBody.innerHTML = '<p class="empty-text">Нет упражнений.</p>';
        return;
    }

    // Ищем список упражнений (если он есть)
    let listContainer = document.getElementById('viewExercisesList');
    if (!listContainer) {
        listContainer = document.createElement('div');
        listContainer.id = 'viewExercisesList';
        viewBody.appendChild(listContainer);
    }

    listContainer.innerHTML = '';
    const isEditMode = viewModal?.classList.contains('edit-mode');

    // Рисуем список упражнений
    (w.exercises || []).forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'view-ex';
        // Для удобства в DOM даем ему уникальный ID (если нет Id от сервера, используем локальный)
        const exDomId = ex.id || `local-${idx}`; 
        div.setAttribute('data-ex-id', exDomId);

        const isEditingThisExercise = isEditMode && editingViewExerciseIndex === idx;
        if (isEditingThisExercise) { 
            div.classList.add('is-editing');
        }

        // --- 1. БЛОК ОТОБРАЖЕНИЯ (только текст) --- 
        const timeStr = (ex.min > 0 || ex.sec > 0) ? `${ex.min}м ${ex.sec}с` : '—';
        const displayBlock = `
            <div class="view-display">
                <div style="font-weight:700">${idx + 1}. ${ex.name}</div>
                <div class="ex-meta">${ex.reps} повт • Подходы: ${ex.sets || 1} • Отдых: ${timeStr}</div>
                ${ex.desc ? `<div class="ex-desc-view">${ex.desc}</div>` : ''}
            </div>
        `;

        // --- 2. БЛОК РЕДАКТИРОВАНИЯ (форма) ---
        const editBlock = `
            <div class="view-edit-form" style="display:none;">
                <input type="text" value="${ex.name || ''}" placeholder="Название *" data-field="name">
                <input type="text" value="${ex.desc || ''}" placeholder="Описание (необязательно)" data-field="desc">
                <input type="number" value="${ex.reps || 1}" placeholder="Повторения *" min="1" data-field="reps">
                <div class="time-row">
                    <input type="number" value="${ex.min || 0}" placeholder="Мин" min="0" data-field="min">
                    <input type="number" value="${ex.sec || 0}" placeholder="Сек" min="0" max="59" data-field="sec">
                </div>
                <div class="row end">
                    <button class="btn primary small" onclick="saveOneViewExercise(event, ${idx})">Сохранить</button>
                    <button class="btn ghost small" onclick="cancelEditViewExercise()">Отмена</button>
                    <button class="btn ghost small delete-btn" onclick="deleteViewExercise(${idx})">Удалить</button>
                </div>
            </div>
        `;

        // --- 3. КНОПКА ДЕЙСТВИЯ ---
        const actionButton = isEditMode ? 
            `<button class="icon-btn edit-btn" onclick="startEditViewExercise(${idx})">✎</button>` : '';

        div.innerHTML = displayBlock + editBlock + actionButton;
        listContainer.appendChild(div);
    });
}


/* ====== View Modal Edit Mode Logic ====== */
if (editWorkoutBtn) {
    editWorkoutBtn.addEventListener('click', enterEditMode);
}

function enterEditMode() {
    if (viewModal) viewModal.classList.add('edit-mode');
    // Переключение главных действий на действия редактирования
    if (mainViewActions) mainViewActions.style.display = 'none';
    if (editModeActions) editModeActions.style.display = 'flex';
    // Сброс всех состояний редактирования, чтобы показать список
    editingViewExerciseIndex = null;
    isAddingNewExerciseInView = false;
    // Явно скрываем форму добавления упражнения
    if (viewExerciseForm) viewExerciseForm.style.display = 'none';
    renderViewExercises();
}

if (exitEditModeBtn) {
    exitEditModeBtn.addEventListener('click', exitEditMode);
}

// ⭐ ФУНКЦИЯ exitEditMode (теперь используется только для полного выхода)
function exitEditMode() {
    if (viewModal) viewModal.classList.remove('edit-mode');
    editingViewExerciseIndex = null;
    cancelTitleEdit(); 
    if (mainViewActions) mainViewActions.style.display = 'flex';
    if (editModeActions) editModeActions.style.display = 'none';
    // Скрываем форму добавления
    if (viewExerciseForm) viewExerciseForm.style.display = 'none';
    isAddingNewExerciseInView = false;
    renderViewExercises();
}


/* ====== View Modal Title Editing Logic ====== */
if (viewTitleEditBtn) {
    viewTitleEditBtn.addEventListener('click', startTitleEdit);
}

function startTitleEdit() {
    if (!viewTitleDisplayContainer || !viewTitleEditForm) return;
    viewTitleDisplayContainer.style.display = 'none';
    viewTitleEditForm.style.display = 'flex';
    if (viewTitleInput) viewTitleInput.focus();
}

if (viewTitleCancelBtn) {
    viewTitleCancelBtn.addEventListener('click', cancelTitleEdit);
}

function cancelTitleEdit() {
    if (!viewTitleDisplayContainer || !viewTitleEditForm) return;
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (w && viewTitleInput) viewTitleInput.value = w.title || w.name; 
    viewTitleDisplayContainer.style.display = 'flex';
    viewTitleEditForm.style.display = 'none';
}

if (viewTitleSaveBtn) {
    viewTitleSaveBtn.addEventListener('click', saveTitleEdit);
}

async function saveTitleEdit() {
    if (!viewTitleInput) return;
    const newTitle = viewTitleInput.value.trim();
    if (!newTitle) {
        alert("Название тренировки не может быть пустым.");
        viewTitleInput.focus();
        return;
    }

    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;

    w.title = newTitle;
    w.name = newTitle; // Обновляем оба поля для консистентности
    if(viewTitleDisplay) viewTitleDisplay.textContent = newTitle;

    const saved = await saveWorkoutChanges(w);

    if (saved) {
        cancelTitleEdit(); // Выходим из режима редактирования названия
    }
}
// ⭐ КОНЕЦ ЛОГИКИ РЕДАКТИРОВАНИЯ НАЗВАНИЯ ТРЕНИРОВКИ


/* ====== View Modal Existing Exercise Editing Logic ====== */
function startEditViewExercise(idx) {
    editingViewExerciseIndex = idx;
    isAddingNewExerciseInView = false;
    if (viewExerciseForm) viewExerciseForm.style.display = 'none'; // Скрываем форму добавления

    // Обновляем классы для отображения формы редактирования нужного элемента
    document.querySelectorAll('.view-ex').forEach((el, index) => {
        if (index === idx) {
            el.classList.add('is-editing');
            const nameInput = el.querySelector('input[data-field="name"]');
            if (nameInput) nameInput.focus();
        } else {
            el.classList.remove('is-editing');
        }
    });
}

function cancelEditViewExercise() {
    editingViewExerciseIndex = null;
    document.querySelectorAll('.view-ex').forEach(el => el.classList.remove('is-editing'));
}

async function saveOneViewExercise(event, idx) {
    event.preventDefault();

    const item = document.querySelectorAll('.view-ex')[idx];
    if (!item) return;

    // Сбор данных из полей формы
    const name = item.querySelector('input[data-field="name"]')?.value.trim() || "";
    // ⭐ ИСПРАВЛЕНО: Использование 'desc'
    const desc = item.querySelector('input[data-field="desc"]')?.value.trim() || ""; 
    const reps = Number(item.querySelector('input[data-field="reps"]')?.value) || 0;
    const min = Number(item.querySelector('input[data-field="min"]')?.value) || 0;
    const sec = Number(item.querySelector('input[data-field="sec"]')?.value) || 0;

    if (!name || reps <= 0) {
        alert('Пожалуйста, введите название и корректное количество повторений (Reps).');
        return;
    }

    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w || !w.exercises[idx]) return;

    // Обновляем объект в памяти
    const ex = w.exercises[idx];
    ex.name = name;
    // ⭐ ИСПРАВЛЕНО: Использование 'desc'
    ex.desc = desc || null;
    ex.reps = reps;
    ex.min = min;
    ex.sec = sec;

    const saved = await saveWorkoutChanges(w);

    if (saved) {
        editingViewExerciseIndex = null;
        renderViewExercises();
    }
}

function deleteViewExercise(idx) {
    if (!confirm('Вы уверены, что хотите удалить это упражнение?')) return;

    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;

    w.exercises.splice(idx, 1);

    saveWorkoutChanges(w).then(saved => {
        if (saved) {
            editingViewExerciseIndex = null;
            renderViewExercises();
        } else {
            alert('Не удалось удалить упражнение.');
        }
    });
}


/* ====== View Modal New Exercise Adding Logic ====== */
if (addExerciseToViewBtn) {
    addExerciseToViewBtn.addEventListener('click', () => {
        // Сбрасываем режим редактирования существующих
        editingViewExerciseIndex = null;
        document.querySelectorAll('.view-ex').forEach(el => el.classList.remove('is-editing'));

        // Показываем форму добавления
        if (viewExerciseForm) viewExerciseForm.style.display = 'block';
        isAddingNewExerciseInView = true;
        
        // Очистка формы перед фокусом
        if (viewExName) viewExName.value = '';
        if (viewExDesc) viewExDesc.value = '';
        if (viewExReps) viewExReps.value = '';
        if (viewExMin) viewExMin.value = '';
        if (viewExSec) viewExSec.value = '';
        if (viewExName) viewExName.focus();
        
        renderViewExercises(); // Перерисовываем, чтобы скрыть лишние элементы
    });
}

if (cancelNewViewExerciseBtn) {
    cancelNewViewExerciseBtn.addEventListener('click', () => {
        if (viewExerciseForm) viewExerciseForm.style.display = 'none';
        isAddingNewExerciseInView = false;
    });
}

// ⭐ ФИКС БАГА: Неработающая кнопка сохранения в режиме просмотра (400 Bad Request)
if (saveNewViewExerciseBtn) {
    saveNewViewExerciseBtn.addEventListener('click', async () => {
        
        // 1. Получаем актуальные значения из полей ввода
        const name = viewExName?.value.trim() || "";
        // ⭐ ИСПРАВЛЕНО: Использование viewExDesc
        const desc = viewExDesc?.value.trim() || ""; 
        const reps = Number(viewExReps?.value) || 0;
        const min = Number(viewExMin?.value) || 0;
        const sec = Number(viewExSec?.value) || 0;

        if (!name || reps <= 0) {
            alert('Пожалуйста, введите название и корректное количество повторений (Reps).');
            return;
        }

        const newExercise = {
            name: name,
            // ⭐ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Замена 'description' на 'desc' 
            desc: desc, 
            reps: reps,
            min: min,
            sec: sec,
            sets: 1,
            id: Date.now() 
        };
        
        let w = workouts.find(x => Number(x.id) === Number(activeViewId));
        if (!w) { alert('Ошибка: Тренировка не найдена.'); return; }
        
        if (!w.exercises) w.exercises = [];
        w.exercises.push(newExercise);
        
        // 2. Отправка изменений на бэкенд
        const saved = await saveWorkoutChanges(w); 
        
        if (saved) {
            // Сброс состояния после сохранения
            isAddingNewExerciseInView = false;
            if (viewExerciseForm) viewExerciseForm.style.display = 'none';
            
            // Обновляем отображение списка
            renderViewExercises(); 
        }
    });
}


/* ====== Global helpers ====== */
window.editExercise = editExercise;
window.deleteExercise = deleteExercise;
window.startEditViewExercise = startEditViewExercise; 
window.cancelEditViewExercise = cancelEditViewExercise; 
window.deleteViewExercise = deleteViewExercise; 
window.saveOneViewExercise = saveOneViewExercise; 
window.exitEditMode = exitEditMode; 
// Новые глобальные функции для заголовка
window.startTitleEdit = startTitleEdit; 
window.saveTitleEdit = saveTitleEdit;
window.cancelTitleEdit = cancelTitleEdit; 
// Новые глобальные функции для модального окна просмотра
window.openView = openView;
window.confirmDeleteWorkout = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить эту тренировку?')) return;
    try {
        if (await deleteWorkoutFromServer(id)) {
            await fetchWorkouts();
            renderWorkouts();
            if (Number(activeViewId) === Number(id)) {
                closeView();
            }
            alert('Тренировка удалена.');
        } else {
            alert('Не удалось удалить тренировку.');
        }
    } catch (e) {
        alert('Ошибка удаления: ' + e.message);
    }
};