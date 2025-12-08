/* ====== DOM Elements ====== */
const topBar = document.getElementById('topBar');
const overlay = document.getElementById('overlay');
const workoutContainer = document.getElementById('workoutContainer');

const createModal = document.getElementById('createModal');
const inputTrainingName = document.getElementById('inputTrainingName');
const stepTitle = document.getElementById('stepTitle');
const stepExercises = document.getElementById('stepExercises');
const exerciseForm = document.getElementById('exerciseForm');
const exerciseList = document.getElementById('exerciseList');

const openCreateModal = document.getElementById('openCreateModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const toExercisesBtn = document.getElementById('toExercisesBtn');
const backToTitleBtn = document.getElementById('backToTitleBtn');
const toggleExerciseFormBtn = document.getElementById('toggleExerciseFormBtn');

const exName = document.getElementById('exName');
const exDesc = document.getElementById('exDesc');
const exReps = document.getElementById('exReps');
const exMin = document.getElementById('exMin');
const exSec = document.getElementById('exSec');
const saveExerciseBtn = document.getElementById('saveExerciseBtn');
const cancelExerciseBtn = document.getElementById('cancelExerciseBtn');

const saveTrainingBtn = document.getElementById('saveTrainingBtn');
const trainingTitleDisplay = document.getElementById('trainingTitleDisplay');

/* ====== Data ====== */
let workouts = [];
let tempExercises = [];
let currentTempTitle = '';
let editingWorkoutId = null;

/* ====== Overlay & Modals ====== */
function showOverlay() {
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
}
function hideOverlay() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
}

function showModal(modalEl) {
    [createModal].forEach(m => {
        if (m !== modalEl) {
            m.classList.remove('show');
            m.setAttribute('aria-hidden', 'true');
        }
    });
    showOverlay();
    modalEl.classList.add('show');
    modalEl.setAttribute('aria-hidden', 'false');
}

function hideModal(modalEl) {
    modalEl.classList.remove('show');
    modalEl.setAttribute('aria-hidden', 'true');
    hideOverlay();
}

/* ====== Create Modal ====== */
function openCreate(editId = null) {
    editingWorkoutId = editId;
    stepTitle.classList.add('active');
    stepExercises.classList.remove('active');
    exerciseForm.classList.remove('active');

    if (editId !== null) {
        const w = workouts.find(w => w.id === editId);
        if (w) {
            currentTempTitle = w.title;
            inputTrainingName.value = w.title;
            tempExercises = JSON.parse(JSON.stringify(w.exercises));
        }
    } else {
        currentTempTitle = '';
        inputTrainingName.value = '';
        tempExercises = [];
    }

    renderExerciseCards();
    updateSaveTrainingBtn();
    showModal(createModal);

    requestAnimationFrame(() => inputTrainingName.focus());
}

function closeCreate() {
    hideModal(createModal);
    editingWorkoutId = null;
    tempExercises = [];
    currentTempTitle = '';
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
    if (editIndex !== undefined) {
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
    exName.value = ex.name;
    exDesc.value = ex.desc;
    exReps.value = ex.reps;
    exMin.value = ex.min;
    exSec.value = ex.sec;
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

/* ====== Steps navigation ====== */
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

/* ====== Save Workout (local only, можно потом API) ====== */
saveTrainingBtn.addEventListener('click', () => {
    if (tempExercises.length < 1) { alert('Добавьте хотя бы одно упражнение'); return; }
    const newWorkout = {
        id: editingWorkoutId || Date.now(),
        title: currentTempTitle,
        exercises: JSON.parse(JSON.stringify(tempExercises))
    };

    if (editingWorkoutId) {
        const idx = workouts.findIndex(w => w.id === editingWorkoutId);
        if (idx > -1) workouts[idx] = newWorkout;
    } else {
        workouts.push(newWorkout);
    }

    renderWorkouts();
    closeCreate();
});

/* ====== Render Workouts ====== */
function renderWorkouts() {
    workoutContainer.innerHTML = '';
    if (!workouts.length) {
        workoutContainer.innerHTML = '<p class="empty-text">Список тренировок пуст.</p>';
        return;
    }

    workouts.forEach(w => {
        const div = document.createElement('div');
        div.className = 'workout-card';
        div.innerHTML = `<div class="workout-title">${w.title}</div><div class="workout-info">${w.exercises.length} упражнений</div>`;
        div.onclick = () => openCreate(w.id); // временно открываем на редактирование
        workoutContainer.appendChild(div);
    });
}

/* ====== Event Listeners ====== */
openCreateModal.addEventListener('click', () => openCreate());
closeCreateModal.addEventListener('click', closeCreate);
overlay.addEventListener('click', () => {
    if (createModal.classList.contains('show')) closeCreate();
});

/* ====== Expose helpers globally for onclick buttons ====== */
window.editExercise = editExercise;
window.deleteExercise = deleteExercise;

/* ====== Init ====== */
document.addEventListener('DOMContentLoaded', () => {
    renderWorkouts();
});
