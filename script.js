window.addEventListener('DOMContentLoaded', () => {
    /* ====== Общие элементы ====== */
    const topBar = document.getElementById('topBar');
    const overlay = document.getElementById('overlay');
    const workoutContainer = document.getElementById('workoutContainer');

    /* ====== Creation modal ====== */
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

    /* ====== Profile modal ====== */
    const profileBtn = document.getElementById('profileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const createdCount = document.getElementById('createdCount');
    const completedCount = document.getElementById('completedCount');
    const notifyTime = document.getElementById('notifyTime');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    /* ====== View modal ====== */
    const viewModal = document.getElementById('viewModal');
    const viewTitle = document.getElementById('viewTitle');
    const viewBody = document.getElementById('viewBody');
    const closeViewBtn = document.getElementById('closeViewBtn');
    const editWorkoutBtn = document.getElementById('editWorkoutBtn');
    const startWorkoutBtn = document.getElementById('startWorkoutBtn');
    const deleteWorkoutBtn = document.getElementById('deleteWorkoutBtn');

    /* ====== Telegram WebApp init ====== */
    let tgUser = { id: null, first_name: "Пользователь", username: "", photo_url: "https://via.placeholder.com/80" };
    window.Telegram?.WebApp?.ready();
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        document.getElementById('userAvatar').src = tgUser.photo_url || "https://via.placeholder.com/80";
    }

    /* ====== Scroll top bar hide ====== */
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const cur = window.pageYOffset || document.documentElement.scrollTop;
        topBar.style.transform = cur > lastScroll ? 'translateY(-100%)' : 'translateY(0)';
        lastScroll = cur <= 0 ? 0 : cur;
    });

    /* ====== Data ====== */
    let workouts = [];
    let currentTempTitle = '';
    let tempExercises = [];
    let editingWorkoutId = null;
    let activeViewId = null;

    /* ====== Helpers ====== */
    function showOverlay() {
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    }
    function hideOverlay() {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    }
    function showModal(modalEl) {
        [createModal, viewModal, profileModal].forEach(m => {
            if (m !== modalEl) { m.classList.remove('show'); m.setAttribute('aria-hidden', 'true'); }
        });
        showOverlay();
        modalEl.classList.add('show');
        modalEl.setAttribute('aria-hidden', 'false');
        enableFormInputs();
    }
    function hideModal(modalEl) {
        if (modalEl) {
            modalEl.classList.remove('show');
            modalEl.setAttribute('aria-hidden', 'true');
        } else {
            [createModal, viewModal, profileModal].forEach(m => {
                m.classList.remove('show');
                m.setAttribute('aria-hidden', 'true');
            });
        }
        if (![createModal, viewModal, profileModal].some(m => m.classList.contains('show'))) hideOverlay();
        enableFormInputs();
    }
    function enableFormInputs() {
        [inputTrainingName, exName, exDesc, exReps, exMin, exSec].forEach(el => {
            if (!el) return;
            el.removeAttribute('disabled');
            el.style.pointerEvents = '';
        });
    }

    /* ====== Creation modal ====== */
    function openCreate(editId = null) {
        editingWorkoutId = null;
        stepTitle.classList.add('active');
        stepExercises.classList.remove('active');
        exerciseForm.classList.remove('active');
        inputTrainingName.value = '';
        currentTempTitle = '';
        tempExercises = [];
        renderExerciseCards();
        updateSaveTrainingBtn();
        showModal(createModal);
        requestAnimationFrame(() => { inputTrainingName.focus({ preventScroll: true }); });

        if (editId !== null && editId !== undefined) {
            const w = workouts.find(x => Number(x.id) === Number(editId));
            if (!w) return;
            editingWorkoutId = Number(w.id);
            inputTrainingName.value = w.title || w.name || '';
            currentTempTitle = w.title || w.name || '';
            tempExercises = JSON.parse(JSON.stringify(w.exercises || []));
            trainingTitleDisplay.textContent = currentTempTitle;
            stepTitle.classList.remove('active');
            stepExercises.classList.add('active');
            renderExerciseCards();
            updateSaveTrainingBtn();
        }
    }
    function closeCreate() { hideModal(createModal); editingWorkoutId = null; }

    function openEditWorkout(id) {
        const w = workouts.find(x => Number(x.id) === Number(id));
        if (!w) return;
        editingWorkoutId = w.id;
        tempExercises = (w.exercises || []).map(e => ({ ...e }));
        currentTempTitle = w.title || w.name || '';
        inputTrainingName.value = currentTempTitle;
        trainingTitleDisplay.textContent = currentTempTitle;
        stepTitle.classList.remove('active');
        stepExercises.classList.add('active');
        exerciseForm.classList.remove('active');
        renderExerciseCards();
        updateSaveTrainingBtn();
        showModal(createModal);
    }

    /* ====== Exercises handlers ====== */
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
        } else tempExercises.push({ name, desc, reps, min, sec, sets: 1 });
        exName.value = exDesc.value = exReps.value = exMin.value = exSec.value = '';
        exerciseForm.classList.remove('active');
        renderExerciseCards();
        updateSaveTrainingBtn();
    });

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

    window.editExercise = function(idx) {
        const ex = tempExercises[idx];
        exName.value = ex.name; exDesc.value = ex.desc; exReps.value = ex.reps; exMin.value = ex.min; exSec.value = ex.sec;
        exerciseForm.classList.add('active');
        saveExerciseBtn.dataset.editIndex = idx;
    }

    window.deleteExercise = function(idx) {
        tempExercises.splice(idx, 1);
        renderExerciseCards();
        updateSaveTrainingBtn();
    }

    function updateSaveTrainingBtn() {
        saveTrainingBtn.disabled = tempExercises.length < 1;
        saveTrainingBtn.classList.toggle('disabled', tempExercises.length < 1);
    }

    /* ====== Workouts render ====== */
    function renderWorkouts() {
        workoutContainer.innerHTML = '';
        if (!workouts.length) {
            workoutContainer.innerHTML = '<p class="empty-text">Список тренировок пуст.</p>';
            return;
        }
        workouts.forEach(w => {
            const div = document.createElement('div');
            div.className = 'workout-card';
            div.innerHTML = `<div class="workout-title">${w.title || w.name || 'Без названия'}</div>
                <div class="workout-info">${(w.exercises || []).length} упражнений</div>`;
            div.onclick = () => openView(w.id);
            workoutContainer.appendChild(div);
        });
    }

    /* ====== Overlay and modal buttons ====== */
    openCreateModal.addEventListener('click', openCreate);
    closeCreateModal.addEventListener('click', closeCreate);
    overlay.addEventListener('click', () => {
        if (viewModal.classList.contains('show')) closeView();
        else if (profileModal.classList.contains('show')) hideModal(profileModal);
        else if (createModal.classList.contains('show')) closeCreate();
    });

    /* ====== Init ====== */
    async function loadWorkouts() {
        // сюда можно добавить API-загрузку
        workouts = [];
        renderWorkouts();
    }

    loadWorkouts();
});
