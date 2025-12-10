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
const viewTitle = document.getElementById('viewTitle');
const viewBody = document.getElementById('viewBody');
const closeViewBtn = document.getElementById('closeViewBtn');
const editWorkoutBtn = document.getElementById('editWorkoutBtn');
const startWorkoutBtn = document.getElementById('startWorkoutBtn');
const deleteWorkoutBtn = document.getElementById('deleteWorkoutBtn');
const saveViewChangesBtn = document.getElementById('saveViewChangesBtn');
const cancelViewEditBtn = document.getElementById('cancelViewEditBtn');

/* ====== Data ====== */
let workouts = [];
let currentTempTitle = '';
let tempExercises = [];
let editingWorkoutId = null;
let activeViewId = null;
let editingViewExerciseIndex = null; // НОВАЯ переменная для индекса редактируемого упражнения

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

    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
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
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
}
function hideOverlay() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
}

function openCreate(editId = null) {
    showOverlay();
    createModal.style.bottom = '0';
    createModal.setAttribute('aria-hidden', 'false');

    stepTitle.classList.add('active');
    stepExercises.classList.remove('active');
    exerciseForm.classList.remove('active');

    inputTrainingName.value = '';
    currentTempTitle = '';
    tempExercises = [];
    editingWorkoutId = null; 
    
    let initialFocus = inputTrainingName;

    // --- ЛОГИКА ЗАГРУЗКИ ТРЕНИРОВКИ ДЛЯ РЕДАКТИРОВАНИЯ/ДОБАВЛЕНИЯ (Возвращаем) ---
    if (editId !== null) {
        const w = workouts.find(x => Number(x.id) === Number(editId));
        if (w) {
            editingWorkoutId = Number(w.id);
            currentTempTitle = w.title || w.name || '';
            inputTrainingName.value = currentTempTitle;

            // Копируем упражнения из тренировки в tempExercises
            tempExercises = JSON.parse(JSON.stringify(w.exercises || []));
            tempExercises = tempExercises.map(e => ({
                name: e.name || e.Name || '',
                desc: e.desc ?? '',
                reps: e.reps ?? 0,
                min: e.min ?? 0,
                sec: e.sec ?? 0,
                sets: e.sets ?? 1
            }));
            
            // !!! Сразу переходим на шаг с упражнениями !!!
            trainingTitleDisplay.textContent = currentTempTitle;
            stepTitle.classList.remove('active');
            stepExercises.classList.add('active');
            initialFocus = exName; // Фокус на форму упражнения, если она активна
        }
    }
    // --- КОНЕЦ ЛОГИКИ ЗАГРУЗКИ ---

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

function closeCreate() {
    hideOverlay();
    createModal.style.bottom = '-110%';
    createModal.setAttribute('aria-hidden', 'true');
    editingWorkoutId = null;
}

/* ====== Exercises (Create Modal) ====== */
toggleExerciseFormBtn.addEventListener('click', () => {
    exerciseForm.classList.toggle('active');
    if (exerciseForm.classList.contains('active')) exName.focus();
});

cancelExerciseBtn.addEventListener('click', () => {
    exName.value = exDesc.value = exReps.value = exMin.value = exSec.value = '';
    exerciseForm.classList.remove('active');
});

saveExerciseBtn.addEventListener('click', () => {
    const name = exName.value.trim();
    const desc = exDesc.value.trim();
    const reps = parseInt(exReps.value);
    const min = parseInt(exMin.value || 0);
    const sec = parseInt(exSec.value || 0);

    if (!name || !reps) { alert('Название и количество повторений обязательны'); return; }

    const editIndex = saveExerciseBtn.dataset.editIndex;
    if (editIndex !== undefined && editIndex !== '') {
        tempExercises[+editIndex] = { name, desc, reps, min, sec, sets: 1 };
        delete saveExerciseBtn.dataset.editIndex;
    } else {
        tempExercises.push({ name, desc, reps, min, sec, sets: 1 });
    }

    exName.value = exDesc.value = exReps.value = exMin.value = exSec.value = '';
    exerciseForm.classList.remove('active');
    renderExerciseCards();
    updateSaveTrainingBtn();
});

/* ====== Switching steps ====== */
toExercisesBtn.addEventListener('click', () => {
    const name = inputTrainingName.value.trim();
    if (!name) { alert('Введите название тренировки'); return; }
    currentTempTitle = name;
    trainingTitleDisplay.textContent = name;
    stepTitle.classList.remove('active');
    stepExercises.classList.add('active');
});

backToTitleBtn.addEventListener('click', () => {
    stepTitle.classList.add('active');
    stepExercises.classList.remove('active');
});

/* ====== Save workout ====== */
saveTrainingBtn.addEventListener('click', async () => {
    if (tempExercises.length < 1) { alert('Добавьте хотя бы одно упражнение'); return; }
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

/* ====== Render workouts ====== */
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

/* ====== Exercise cards (Create Modal) ====== */
function renderExerciseCards() {
    exerciseList.innerHTML = '';
    tempExercises.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'exercise-card';
        div.innerHTML = `
            <div class="ex-card-head">
                <div class="ex-title">${ex.name}</div>
                <div class="ex-meta">${ex.reps} повт • ${ex.min}м ${ex.sec}с</div>
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

/* ====== Profile ====== */
profileBtn.addEventListener('click', getProfile);
closeProfileBtn.addEventListener('click', () => {
    hideOverlay();
    profileModal.classList.remove('show');
    profileModal.setAttribute('aria-hidden', 'true');
});
saveProfileBtn.addEventListener('click', async () => {
    await saveProfileToServer({ Id: tgUser.id, NotifyTime: notifyTime.value });
    alert('Настройки сохранены');
});

// --- НОВЫЕ ФУНКЦИИ УПРАВЛЕНИЯ РЕДАКТИРОВАНИЕМ В VIEW MODAL ---

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
        // alert("Изменения сохранены!"); // Отключим алерты при редактировании одного упражнения
    } catch (err) {
        console.error("Ошибка при сохранении редактирования:", err);
        alert("Ошибка при сохранении. Посмотрите консоль.");
    }
}

function startEditViewExercise(idx) {
    editingViewExerciseIndex = idx;
    // Копирование данных не требуется, так как мы работаем с w.exercises напрямую
    renderViewExercises(); 
    
    // Устанавливаем фокус
    const form = viewBody.querySelector(`.view-edit-form[data-index="${idx}"]`);
    form?.querySelector('[data-field="name"]')?.focus();
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
        renderViewExercises();
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
        alert('Название и количество повторений обязательны');
        return;
    }

    // Обновляем локальную копию
    w.exercises[idx] = { name, desc, reps, min, sec, sets: 1 };
    
    await saveWorkoutChanges(w);
    
    // Выход из режима редактирования одного упражнения и возврат к списку
    cancelEditViewExercise();
}

/* ====== View modal (Просмотр и Редактирование на месте) ====== */
function renderViewExercises() {
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;
    viewBody.innerHTML = '';
    
    const isEditMode = viewModal.classList.contains('edit-mode');

    (w.exercises || []).forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'view-ex';
        if (isEditMode && editingViewExerciseIndex === idx) {
            div.classList.add('is-editing');
        }

        // --- 1. БЛОК ОТОБРАЖЕНИЯ (только текст) ---
        const displayBlock = `
            <div class="view-display">
                <div style="font-weight:700">${idx + 1}. ${ex.name}</div>
                ${ex.desc ? `<div style="margin-top:4px;color:rgba(255,255,255,0.8)">${ex.desc}</div>` : ''}
                <div style="color:rgba(255,255,255,0.7)">${ex.reps} повт • ${ex.min}м ${ex.sec}с</div>
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

        div.innerHTML = displayBlock + editListBlock + editForm;
        viewBody.appendChild(div);
    });
    
    // Если в режиме редактирования списка (и форма одного упражнения не открыта), добавляем кнопку "Добавить упражнение"
    if (isEditMode && editingViewExerciseIndex === null) {
        const addBtn = document.createElement('div');
        addBtn.innerHTML = `<button class="btn add-ex" onclick="openCreate(${w.id})">+ Добавить упражнение</button>`;
        addBtn.style.marginTop = '15px';
        viewBody.appendChild(addBtn);
    }
}


function openView(id) {
    activeViewId = Number(id);
    showOverlay();
    viewModal.classList.add('show');
    viewModal.classList.remove('edit-mode'); 
    editingViewExerciseIndex = null; // Сброс состояния редактирования
    const w = workouts.find(x => Number(x.id) === Number(id));
    viewTitle.textContent = w?.title || w?.name || 'Без названия';
    renderViewExercises();
}

function closeView() {
    viewModal.classList.remove('show');
    viewModal.classList.remove('edit-mode'); 
    editingViewExerciseIndex = null; // Сброс состояния редактирования
    hideOverlay();
    activeViewId = null;
}

/* ====== Event listeners ====== */
openCreateModal.addEventListener('click', () => openCreate());
closeCreateModal.addEventListener('click', closeCreate);
overlay.addEventListener('click', () => {
    if (viewModal.classList.contains('show')) closeView();
    else if (profileModal.classList.contains('show')) closeProfileBtn.click();
    else closeCreate();
});

editWorkoutBtn.addEventListener('click', () => { 
    if (activeViewId === null) return;
    
    // Переключаем модалку просмотра в режим редактирования списка
    viewModal.classList.toggle('edit-mode'); 
    editingViewExerciseIndex = null; // Сбрасываем редактирование отдельной формы
    
    // Перерисовываем
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
    } catch (err) { console.error(err); alert("Ошибка при удалении тренировки."); }
});
closeViewBtn.addEventListener('click', closeView);

// ОТМЕНА РЕДАКТИРОВАНИЯ (Теперь только выход из общего режима редактирования списка)
cancelViewEditBtn.addEventListener('click', () => {
    viewModal.classList.remove('edit-mode');
    editingViewExerciseIndex = null;
    renderViewExercises(); 
});

// СОХРАНЕНИЕ ИЗМЕНЕНИЙ В МОДАЛКЕ ПРОСМОТРА
// ЭТА КНОПКА БОЛЬШЕ НЕ НУЖНА ДЛЯ СОХРАНЕНИЯ, Т.К. ОНО ПРОИСХОДИТ В saveOneViewExercise
// Оставляем пустой, чтобы не вызывало ошибок, если элемент еще где-то используется, 
// но в идеале его нужно скрыть через CSS
saveViewChangesBtn.addEventListener('click', async () => {
    alert("Кнопка Сохранить изменения больше не используется. Сохранение происходит при редактировании каждого упражнения.");
});

/* ====== Global helpers ====== */
window.editExercise = editExercise;
window.deleteExercise = deleteExercise;
window.startEditViewExercise = startEditViewExercise; // НОВАЯ
window.cancelEditViewExercise = cancelEditViewExercise; // НОВАЯ
window.deleteViewExercise = deleteViewExercise; // НОВАЯ
window.saveOneViewExercise = saveOneViewExercise; // НОВАЯ

/* ====== Init ====== */
window.addEventListener('DOMContentLoaded', loadWorkouts);