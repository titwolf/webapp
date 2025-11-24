/* ====== Общие элементы ====== */
const topBar = document.getElementById('topBar');
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const cur = window.pageYOffset || document.documentElement.scrollTop;
  if (cur > lastScroll) topBar.style.transform = 'translateY(-100%)';
  else topBar.style.transform = 'translateY(0)';
  lastScroll = cur <= 0 ? 0 : cur;
});

/* ====== Элементы UI ====== */
const overlay = document.getElementById('overlay');

/* Create modal (bottom) */
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

let currentTempTitle = '';
let tempExercises = [];
let editingWorkoutId = null; // id if editing existing workout

/* View modal */
const viewModal = document.getElementById('viewModal');
const viewTitle = document.getElementById('viewTitle');
const viewBody = document.getElementById('viewBody');
const closeViewBtn = document.getElementById('closeViewBtn');
const editWorkoutBtn = document.getElementById('editWorkoutBtn');
const startWorkoutBtn = document.getElementById('startWorkoutBtn');
const deleteWorkoutBtn = document.getElementById('deleteWorkoutBtn');

/* Main list */
const workoutContainer = document.getElementById('workoutContainer');

let workouts = []; // array of {id, title, exercises: [{name,desc,reps,min,sec}], createdAt}

/* ====== Storage ====== */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem('fitplan_workouts');
    workouts = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Ошибка чтения storage', e);
    workouts = [];
  }
}
function saveToStorage() {
  localStorage.setItem('fitplan_workouts', JSON.stringify(workouts));
}

/* ====== Open/Close create modal ====== */
function openCreate(editId=null) {
  overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto';
  createModal.style.bottom = '0';
  createModal.setAttribute('aria-hidden','false');
  // reset to step 1
  stepTitle.classList.add('active'); stepExercises.classList.remove('active');
  exerciseForm.classList.remove('active');
  inputTrainingName.value = '';
  currentTempTitle = '';
  tempExercises = [];
  editingWorkoutId = null;
  renderExerciseCards();
  updateSaveTrainingBtn();

  if (editId) {
    // populate for editing
    const w = workouts.find(x=>x.id===editId);
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
  overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none';
  createModal.style.bottom = '-110%';
  createModal.setAttribute('aria-hidden','true');
}

/* overlay click closes modals */
overlay.addEventListener('click', () => {
  if (viewModal.classList.contains('show')) closeView();
  else closeCreate();
});

/* buttons */
openCreateModal.addEventListener('click', () => openCreate());
closeCreateModal.addEventListener('click', closeCreate);

/* Step navigation */
toExercisesBtn.addEventListener('click', () => {
  const name = inputTrainingName.value.trim();
  if (!name) { alert('Введите название тренировки.'); return; }
  currentTempTitle = name;
  trainingTitleDisplay.textContent = name;
  stepTitle.classList.remove('active');
  stepExercises.classList.add('active');
  exerciseForm.classList.remove('active');
});

backToTitleBtn.addEventListener('click', () => {
  stepExercises.classList.remove('active');
  stepTitle.classList.add('active');
});

/* Toggle exercise form */
toggleExerciseFormBtn.addEventListener('click', () => {
  exerciseForm.classList.toggle('active');
  if (exerciseForm.classList.contains('active')) exName.focus();
});

/* Cancel exercise add */
cancelExerciseBtn.addEventListener('click', () => {
  exName.value=''; exDesc.value=''; exReps.value=''; exMin.value=''; exSec.value='';
  exerciseForm.classList.remove('active');
});

/* ====== Manage exercises (temp) ====== */
function renderExerciseCards() {
  exerciseList.innerHTML = '';
  if (!tempExercises.length) {
    const note = document.createElement('div');
    note.className = 'empty-text';
    note.textContent = 'Упражнений пока нет.';
    exerciseList.appendChild(note);
    updateSaveTrainingBtn();
    return;
  }

  tempExercises.forEach((ex, idx) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.draggable = true;
    card.dataset.index = idx;

    const head = document.createElement('div'); head.className='ex-card-head';
    const title = document.createElement('div'); title.className='ex-title'; title.textContent = ex.name;
    const actions = document.createElement('div'); actions.className='ex-actions';
    const editBtn = document.createElement('button'); editBtn.className='icon-small'; editBtn.innerHTML='✎';
    const delBtn = document.createElement('button'); delBtn.className='icon-small'; delBtn.innerHTML='✕';
    actions.appendChild(editBtn); actions.appendChild(delBtn);
    head.appendChild(title); head.appendChild(actions);

    const meta = document.createElement('div'); meta.className='ex-meta';
    meta.innerHTML = `Повторения: <strong>${ex.reps}</strong> • Таймер: ${ex.min}мин ${ex.sec}сек`;

    if (ex.desc) {
      const desc = document.createElement('div'); desc.className='ex-desc'; desc.textContent = ex.desc;
      card.appendChild(head); card.appendChild(meta); card.appendChild(desc);
    } else {
      card.appendChild(head); card.appendChild(meta);
    }

    // events
    delBtn.addEventListener('click', () => {
      tempExercises.splice(idx,1);
      renderExerciseCards();
    });

    editBtn.addEventListener('click', () => {
      exName.value = ex.name;
      exDesc.value = ex.desc || '';
      exReps.value = ex.reps;
      exMin.value = ex.min;
      exSec.value = ex.sec;
      exerciseForm.classList.add('active');
      saveExerciseBtn.dataset.editIndex = idx;
    });

    // Drag handlers - improved: reorder based on mouse position
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', idx);
    });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); });

    exerciseList.appendChild(card);
  });

  // container dragover to calculate insert position
  exerciseList.querySelectorAll('.exercise-card').forEach(c => {
    c.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = document.querySelector('.exercise-card.dragging');
      if (!dragging || dragging === c) return;
      const rect = c.getBoundingClientRect();
      const offset = e.clientY - rect.top;
      const insertBefore = offset < rect.height/2;
      const draggingIdx = +dragging.dataset.index;
      const targetIdx = +c.dataset.index;
      // remove dragging item
      const item = tempExercises.splice(draggingIdx,1)[0];
      const newIndex = insertBefore ? targetIdx : targetIdx+1;
      tempExercises.splice(newIndex > draggingIdx ? newIndex-1 : newIndex,0,item);
      renderExerciseCards();
    });
  });

  updateSaveTrainingBtn();
}

/* Save or edit exercise */
saveExerciseBtn.addEventListener('click', () => {
  const name = exName.value.trim();
  const desc = exDesc.value.trim();
  const reps = parseInt(exReps.value,10);
  const min = parseInt(exMin.value || 0,10);
  const sec = parseInt(exSec.value || 0,10);

  if (!name || !reps) { alert('Название и количество повторений обязательны.'); return; }

  const editIndex = saveExerciseBtn.dataset.editIndex;
  if (editIndex !== undefined && editIndex !== '') {
    tempExercises[+editIndex] = { name, desc, reps, min, sec };
    delete saveExerciseBtn.dataset.editIndex;
  } else {
    tempExercises.push({ name, desc, reps, min, sec });
  }

  exName.value=''; exDesc.value=''; exReps.value=''; exMin.value=''; exSec.value='';
  exerciseForm.classList.remove('active');
  renderExerciseCards();
});

/* enable save training only when >=3 exercises */
function updateSaveTrainingBtn(){
  if (tempExercises.length >= 3) {
    saveTrainingBtn.classList.remove('disabled');
    saveTrainingBtn.disabled = false;
  } else {
    saveTrainingBtn.classList.add('disabled');
    saveTrainingBtn.disabled = true;
  }
}

/* Save training to workouts (create or replace if editing) */
saveTrainingBtn.addEventListener('click', () => {
  if (tempExercises.length < 3) return;
  if (!currentTempTitle) currentTempTitle = inputTrainingName.value.trim();
  if (!currentTempTitle) { alert('Название тренировки отсутствует.'); return; }

  if (editingWorkoutId) {
    // replace existing
    const idx = workouts.findIndex(w => w.id === editingWorkoutId);
    if (idx !== -1) {
      workouts[idx].title = currentTempTitle;
      workouts[idx].exercises = JSON.parse(JSON.stringify(tempExercises));
      workouts[idx].createdAt = Date.now();
    } else {
      // fallback to push
      workouts.unshift({ id:'w_'+Date.now(), title: currentTempTitle, exercises: JSON.parse(JSON.stringify(tempExercises)), createdAt: Date.now() });
    }
    editingWorkoutId = null;
  } else {
    const newWorkout = { id: 'w_' + Date.now(), title: currentTempTitle, exercises: JSON.parse(JSON.stringify(tempExercises)), createdAt: Date.now() };
    workouts.unshift(newWorkout);
  }

  saveToStorage();
  renderWorkouts();
  closeCreate();
});

/* ====== Render main workouts grid ====== */
function renderWorkouts() {
  workoutContainer.innerHTML = '';
  if (!workouts.length) {
    workoutContainer.innerHTML = '<p class="empty-text">Список тренировок пуст.</p>';
    return;
  }

  workouts.forEach(w => {
    const card = document.createElement('div');
    card.className = 'workout-card';
    card.dataset.id = w.id;
    card.innerHTML = `<div class="workout-title">${w.title}</div><div class="workout-info">${w.exercises.length} упражнений</div>`;
    card.addEventListener('click', () => openView(w.id));
    workoutContainer.appendChild(card);
  });
}

/* ====== View modal (просмотр тренировки) ====== */
let activeViewId = null;
function openView(workoutId) {
  const w = workouts.find(x => x.id === workoutId);
  if (!w) return;
  activeViewId = workoutId;
  overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto';
  viewModal.classList.add('show');

  viewTitle.textContent = w.title;
  viewBody.innerHTML = '';

  w.exercises.forEach((ex, idx) => {
    const exDiv = document.createElement('div'); exDiv.className='view-ex';
    exDiv.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700">${idx+1}. ${ex.name}</div>
        <div style="color:rgba(255,255,255,0.7)">${ex.reps} повт • ${ex.min}м ${ex.sec}с</div>
      </div>
      ${ex.desc ? `<div style="margin-top:6px;color:rgba(255,255,255,0.8)">${ex.desc}</div>` : ''}`;
    viewBody.appendChild(exDiv);
  });

  // actions
  editWorkoutBtn.onclick = () => {
    closeView();
    openCreate(workoutId); // open create in edit mode
  };

  startWorkoutBtn.onclick = () => {
    location.href = `gowk.html?workout=${encodeURIComponent(w.id)}`;
  };

  deleteWorkoutBtn.onclick = () => {
    if (!confirm('Удалить тренировку?')) return;
    const idx = workouts.findIndex(x=>x.id===workoutId);
    if (idx!==-1) {
      workouts.splice(idx,1);
      saveToStorage();
      renderWorkouts();
      closeView();
    }
  };

  closeViewBtn.onclick = closeView;
}
function closeView() {
  viewModal.classList.remove('show');
  overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none';
  activeViewId = null;
}

/* ====== Init ====== */
loadFromStorage();
renderWorkouts();
renderExerciseCards();
updateSaveTrainingBtn();
