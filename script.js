/* ====== Общие элементы ====== */
const topBar = document.getElementById('topBar');
const overlay = document.getElementById('overlay');
const API_BASE = "http://localhost:5000"; 
let lastScroll = 0;

/* ====== Telegram WebApp integration ====== */
let tgUser = { id: null, first_name: "Пользователь", username: "", photo_url: "https://via.placeholder.com/80" };
window.Telegram.WebApp.ready();
if (window.Telegram.WebApp.initDataUnsafe?.user) {
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
let editingWorkoutId = null;
let activeViewId = null;

/* ====== API Helper ====== */
async function api(path, method = 'GET', data = null) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : null
    });
    return res.json();
}

/* ====== User API ====== */
async function registerUser() {
    await api('/api/register_user', 'POST', {
        telegram_id: tgUser.id,
        username: tgUser.username || tgUser.first_name,
        avatar_url: tgUser.photo_url
    });
}

async function getProfile() {
    const profile = await api(`/api/get_profile?user_id=${tgUser.id}`);
    profileAvatar.src = profile.avatar_url || tgUser.photo_url;
    profileName.textContent = profile.username ? `@${profile.username}` : tgUser.first_name;
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
    await registerUser();
    const res = await api(`/api/get_workouts?user_id=${tgUser.id}`);
    workouts = res || [];
    renderWorkouts();
}

async function saveWorkoutToServer(payload) {
    return await api('/api/save_workout', 'POST', payload);
}

async function deleteWorkoutFromServer(id) {
    return await api('/api/delete_workout', 'POST', { id, user_id: tgUser.id });
}

/* ====== Modals ====== */
function openCreate(editId = null) {
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
    editingWorkoutId = null;
    renderExerciseCards();
    updateSaveTrainingBtn();

    if (editId) {
        const w = workouts.find(x => x.id === editId);
        if (!w) return;
        editingWorkoutId = w.id;
        inputTrainingName.value = w.title;
        currentTempTitle = w.title;
        tempExercises = JSON.parse(JSON.stringify(w.exercises));
        trainingTitleDisplay.textContent = w.title;
        stepTitle.classList.remove('active');
        stepExercises.classList.add('active');
        renderExerciseCards();
        updateSaveTrainingBtn();
    }
}

function closeCreate() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    createModal.style.bottom = '-110%';
    createModal.setAttribute('aria-hidden', 'true');
}

function openView(id) {
    const w = workouts.find(x => x.id === id);
    if (!w) return;
    activeViewId = id;

    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    viewModal.classList.add('show');

    viewTitle.textContent = w.title;
    viewBody.innerHTML = '';

    w.exercises.forEach((ex, idx) => {
        const div = document.createElement('div');
        div.className = 'view-ex';
        div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-weight:700">${idx + 1}. ${ex.name}</div>
            <div style="color:rgba(255,255,255,0.7)">${ex.reps} повт • ${ex.min}м ${ex.sec}с</div>
        </div>${ex.desc ? `<div style="margin-top:6px;color:rgba(255,255,255,0.8)">${ex.desc}</div>` : ''}`;
        viewBody.appendChild(div);
    });

    startWorkoutBtn.onclick = () => {
        sessionStorage.setItem('currentWorkout', JSON.stringify(w));
        window.location.href = 'gowk.html';
    };
}

function closeView() {
    viewModal.classList.remove('show');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    activeViewId = null;
}

/* ====== Event listeners for modals ====== */
openCreateModal.addEventListener('click', () => openCreate());
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
        tempExercises[+editIndex] = { name, desc, reps, min, sec };
        delete saveExerciseBtn.dataset.editIndex;
    } else {
        tempExercises.push({ name, desc, reps, min, sec });
    }

    exName.value = exDesc.value = exReps.value = exMin.value = exSec.value = '';
    exerciseForm.classList.remove('active');
    renderExerciseCards();
    updateSaveTrainingBtn();
});

/* Переключение на шаг упражнений */
toExercisesBtn.addEventListener('click', () => {
    const title = inputTrainingName.value.trim();
    if (!title) { alert('Введите название тренировки'); return; }
    currentTempTitle = title;
    trainingTitleDisplay.textContent = title;
    stepTitle.classList.remove('active');
    stepExercises.classList.add('active');
});

/* Сохранение тренировки */
saveTrainingBtn.addEventListener('click', async () => {
    if (tempExercises.length < 1) { alert('Добавьте хотя бы одно упражнение'); return; }

    const payload = { 
        user_id: tgUser.id, 
        title: currentTempTitle, 
        exercises: tempExercises 
    };
    if (editingWorkoutId) payload.id = editingWorkoutId;

    const savedWorkout = await saveWorkoutToServer(payload);
    if (!editingWorkoutId) workouts.push(savedWorkout);
    renderWorkouts();
    closeCreate();
});

/* ====== Render workouts ====== */
function renderWorkouts() {
    workoutContainer.innerHTML = '';
    if (!workouts.length) { workoutContainer.innerHTML = '<p class="empty-text">Список тренировок пуст.</p>'; return; }
    workouts.forEach(w => {
        const div = document.createElement('div');
        div.className = 'workout-card';
        div.onclick = () => openView(w.id);
        div.innerHTML = `<div class="workout-title">${w.title}</div><div class="workout-info">${w.exercises.length} упражнений</div>`;
        workoutContainer.appendChild(div);
    });
}

/* ====== Exercise cards ====== */
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
    await saveProfileToServer({ user_id: tgUser.id, notify_time: notifyTime.value });
    alert('Настройки сохранены');
});

/* ====== Delete Workout ====== */
deleteWorkoutBtn.addEventListener('click', async () => {
    if (!activeViewId) return;
    if (!confirm("Удалить эту тренировку?")) return;
    await deleteWorkoutFromServer(activeViewId);
    await loadWorkouts();
    closeView();
});

/* ====== Init ====== */
window.addEventListener('DOMContentLoaded', loadWorkouts);
