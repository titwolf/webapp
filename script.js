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

/* ====== Data ====== */
let workouts = [];
let currentTempTitle = '';
let tempExercises = [];
let editingWorkoutId = null; // null or numeric id of workout being edited
let activeViewId = null; // id of workout opened in view modal

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

/* ====== Creation modal (ONLY creation!) ====== */
function openCreate() {
    editingWorkoutId = null;
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    createModal.style.bottom = '0';
    createModal.setAttribute('aria-hidden', 'false');

    stepTitle.classList.add('active');
    stepExercises.classList.remove('active');
    exerciseForm.classList.remove('active');

    inputTrainingName.value = '';
    currentTempTitle = '';
    tempExercises = [];

    renderExerciseCards();
    updateSaveTrainingBtn();
}

function closeCreate() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    createModal.style.bottom = '-110%';
    createModal.setAttribute('aria-hidden', 'true');
    editingWorkoutId = null;
}

/* ====== Edit modal (separate!) ====== */
function openEditWorkout(id) {
    const w = workouts.find(x => Number(x.id) === Number(id));
    if (!w) return;

    editingWorkoutId = w.id;
    tempExercises = (w.exercises || []).map(e => ({ ...e }));
    currentTempTitle = w.title || w.name || '';

    inputTrainingName.value = currentTempTitle;
    trainingTitleDisplay.textContent = currentTempTitle;

    // Открываем модалку сразу на списке упражнений
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    createModal.style.bottom = '0';
    createModal.setAttribute('aria-hidden', 'false');

    stepTitle.classList.remove('active');
    stepExercises.classList.add('active');

    renderExerciseCards();
    updateSaveTrainingBtn();
}

/* ====== Exercises ====== */
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
            if (index > -1) workouts[index] = {
                id: savedWorkout.id,
                title: savedWorkout.title,
                name: savedWorkout.name,
                user_id: savedWorkout.user_id,
                exercises: savedWorkout.exercises
            };
        } else {
            workouts.push({
                id: savedWorkout.id,
                title: savedWorkout.title,
                name: savedWorkout.name,
                user_id: savedWorkout.user_id,
                exercises: savedWorkout.exercises
            });
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

        div.innerHTML = `
            <div class="workout-title">${title}</div>
            <div class="workout-info">${(w.exercises || []).length} упражнений</div>
            <div class="ex-actions" style="margin-top:6px; display:flex; gap:6px;">
                <button class="icon-small" onclick="openEditWorkout(${w.id})">✎</button>
                <button class="icon-small" onclick="deleteWorkoutFromCard(${w.id})">🗑</button>
            </div>
        `;

        // Клик по остальной части карточки открывает просмотр
        div.addEventListener('click', e => {
            if (!e.target.closest('button')) openView(w.id);
        });

        workoutContainer.appendChild(div);
    });
}

/* ====== Exercise cards (in create modal) ====== */
function renderExerciseCards() {
    exerciseList.innerHTML = '';
    tempExercises.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'exercise-card';
        div.innerHTML = `<div class="ex-card-head"><div class="ex-title">${ex.name}</div><div class="ex-meta">${ex.reps} повт • ${ex.min}м ${ex.sec}с</div></div>
            <div class="ex-actions"><button class="icon-small" onclick="editExercise(${idx})">✎</button><button class="icon-small" onclick="deleteExercise(${idx})">🗑</button></div>`;
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
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    profileModal.classList.remove('show');
    profileModal.setAttribute('aria-hidden', 'true');
});
saveProfileBtn.addEventListener('click', async () => {
    await saveProfileToServer({ Id: tgUser.id, NotifyTime: notifyTime.value });
    alert('Настройки сохранены');
});

/* ====== View Modal ====== */
function renderViewExercises() {
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;
    viewBody.innerHTML = '';

    (w.exercises || []).forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'view-ex';
        div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="font-weight:700">${idx + 1}. ${ex.name}</div>
                ${ex.desc ? `<div style="margin-top:4px;color:rgba(255,255,255,0.8)">${ex.desc}</div>` : ''}
                <div style="color:rgba(255,255,255,0.7)">${ex.reps} повт • ${ex.min}м ${ex.sec}с</div>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="icon-small" onclick="editViewExercise(${idx})">✎</button>
                <button class="icon-small" onclick="deleteViewExercise(${idx})">🗑</button>
            </div>
        </div>`;
        viewBody.appendChild(div);
    });
}

function editViewExercise(idx) {
    closeView();
    openEditWorkout(activeViewId); // теперь открыта модалка редактирования

    const ex = tempExercises[idx];
    if (!ex) return;

    exerciseForm.classList.add('active');
    exName.value = ex.name;
    exDesc.value = ex.desc;
    exReps.value = ex.reps;
    exMin.value = ex.min;
    exSec.value = ex.sec;

    saveExerciseBtn.dataset.editIndex = idx;
}

function deleteViewExercise(idx) {
    const w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;
    if (!confirm('Удалить это упражнение?')) return;

    w.exercises.splice(idx, 1);

    if (editingWorkoutId === Number(activeViewId)) {
        tempExercises = JSON.parse(JSON.stringify(w.exercises));
        renderExerciseCards();
        updateSaveTrainingBtn();
    }

    (async () => {
        try {
            await saveWorkoutToServer({ id: w.id, user_id: w.user_id, title: w.title, exercises: w.exercises });
        } catch (err) {
            console.error("Ошибка при сохранении после удаления упражнения:", err);
        }
    })();

    renderViewExercises();
}

function openView(id) {
    activeViewId = Number(id);
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    viewModal.classList.add('show');

    const w = workouts.find(x => Number(x.id) === Number(id));
    viewTitle.textContent = w?.title || w?.name || 'Без названия';
    renderViewExercises();
}

function closeView() {
    viewModal.classList.remove('show');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    activeViewId = null;
}

/* ====== Modals event listeners ====== */
openCreateModal.addEventListener('click', openCreate);
closeCreateModal.addEventListener('click', closeCreate);
overlay.addEventListener('click', () => {
    if (viewModal.classList.contains('show')) closeView();
    else if (profileModal.classList.contains('show')) closeProfileBtn.click();
    else closeCreate();
});
backToTitleBtn.addEventListener('click', () => {
    stepTitle.classList.add('active');
    stepExercises.classList.remove('active');
});

/* ====== Edit/Delete workout buttons ====== */
editWorkoutBtn.addEventListener('click', () => {
    if (activeViewId !== null) {
        closeView();
        openEditWorkout(activeViewId);
    }
});
deleteWorkoutBtn.addEventListener('click', async () => {
    if (!activeViewId) return;
    if (!confirm('Удалить эту тренировку?')) return;
    try {
        await deleteWorkoutFromServer(activeViewId);
        workouts = workouts.filter(w => Number(w.id) !== Number(activeViewId));
        renderWorkouts();
        closeView();
    } catch (err) {
        console.error("deleteWorkout error:", err);
        alert("Ошибка при удалении");
    }
});

/* ====== Init ====== */
loadWorkouts();
