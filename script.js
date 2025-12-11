/* ====== Общие элементы ====== */
const topBar = document.getElementById('topBar');
const overlay = document.getElementById('overlay');
const API_BASE = "http://localhost:5000";
let lastScroll = 0;

/* ====== Telegram WebApp integration ====== */
let tgUser = { id: null, first_name: "Пользователь", username: "", photo_url: "https://via.placeholder.com/80" };
window.Telegram?.WebApp?.ready();
if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    // ⭐ ИСПРАВЛЕНИЕ 1: Убеждаемся, что ID - это число
    tgUser = {
        ...window.Telegram.WebApp.initDataUnsafe.user,
        id: Number(window.Telegram.WebApp.initDataUnsafe.user.id) || 0 
    };
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
const finishCreateWorkoutBtn = document.getElementById('finishCreateWorkoutBtn');
const addExerciseBtn = document.getElementById('addExerciseBtn');
const exercisesList = document.getElementById('exercisesList');
const inputExName = document.getElementById('inputExName');
const inputExDesc = document.getElementById('inputExDesc');
const inputExReps = document.getElementById('inputExReps');
const inputExSets = document.getElementById('inputExSets');
const inputExMin = document.getElementById('inputExMin');
const inputExSec = document.getElementById('inputExSec');
const addExForm = document.getElementById('addExForm');
const cancelAddExBtn = document.getElementById('cancelAddExBtn');

const viewModal = document.getElementById('viewModal');
const viewHeader = document.getElementById('viewHeader');
const viewTitleDisplay = document.getElementById('viewTitleDisplay');
const viewTitleInput = document.getElementById('viewTitleInput');
const viewTitleSaveBtn = document.getElementById('viewTitleSaveBtn');
const viewTitleCancelBtn = document.getElementById('viewTitleCancelBtn');
const viewTitleEditBtn = document.getElementById('viewTitleEditBtn');
const viewDeleteBtn = document.getElementById('viewDeleteBtn');
const viewCloseBtn = document.getElementById('viewCloseBtn');
const viewExercisesList = document.getElementById('viewExercisesList');
const viewAddNewExerciseBtn = document.getElementById('viewAddNewExerciseBtn');

const viewExerciseForm = document.getElementById('viewExerciseForm');
const viewExName = document.getElementById('viewExName');
const viewExDesc = document.getElementById('viewExDesc');
const viewExReps = document.getElementById('viewExReps');
const viewExMin = document.getElementById('viewExMin');
const viewExSec = document.getElementById('viewExSec');
const saveNewViewExerciseBtn = document.getElementById('saveNewViewExerciseBtn');
const cancelNewViewExerciseBtn = document.getElementById('cancelNewViewExerciseBtn');

const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeProfileBtn = document.getElementById('closeProfileBtn');
const profileBody = document.getElementById('profileBody');
const notifyTimeInput = document.getElementById('notifyTimeInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');

let workouts = [];
let newWorkout = { title: '', exercises: [] };
let activeViewId = null;
let isAddingNewExerciseInView = false;


/* ====== API calls ====== */
async function fetchWorkouts() {
    if (!tgUser.id) return;
    try {
        const response = await fetch(`${API_BASE}/api/get_workouts?user_id=${tgUser.id}`);
        if (response.ok) {
            workouts = await response.json();
            renderWorkouts();
        } else {
            console.error("Failed to fetch workouts:", response.statusText);
        }
    } catch (e) {
        console.error("Error fetching workouts:", e);
    }
}

async function saveWorkoutChanges(workout) {
    if (!workout || !tgUser.id) return false;
    
    // ⭐ ИСПРАВЛЕНИЕ 2: Формируем payload с учетом структуры DTO (desc, id)
    const payload = {
        id: workout.id || 0,
        user_id: workout.user_id || tgUser.id,
        title: workout.title || workout.name,
        exercises: workout.exercises.map(e => ({
            id: e.id || 0, 
            name: e.name,
            // Используем 'desc' (если есть) или старое 'description' (если есть)
            desc: e.desc || e.description || null, 
            reps: e.reps,
            sets: e.sets || 1,
            min: e.min || 0,
            sec: e.sec || 0
        }))
    };

    try {
        const response = await fetch(`${API_BASE}/api/save_workout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const savedWorkout = await response.json();
            
            // Обновляем workouts: если ID 0, добавляем, иначе обновляем
            const index = workouts.findIndex(w => w.id === savedWorkout.id);
            if (index !== -1) {
                workouts[index] = savedWorkout;
            } else {
                workouts.push(savedWorkout);
            }
            renderWorkouts();
            return savedWorkout;
        } else {
            console.error("Failed to save workout. Status:", response.status);
            // Показываем детальную ошибку валидации, если доступно
            try {
                const errorData = await response.json();
                console.error("Validation Errors:", errorData);
                alert("Ошибка сохранения: " + JSON.stringify(errorData.errors || errorData));
            } catch {
                alert("Ошибка сохранения: " + response.statusText);
            }
            return false;
        }
    } catch (e) {
        console.error("Error saving workout:", e);
        alert("Ошибка сети при сохранении тренировки.");
        return false;
    }
}

async function deleteWorkout(id) {
    if (!id || !tgUser.id) return false;
    try {
        const response = await fetch(`${API_BASE}/api/delete_workout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, user_id: tgUser.id })
        });
        if (response.ok) {
            workouts = workouts.filter(w => w.id !== id);
            renderWorkouts();
            return true;
        } else {
            console.error("Failed to delete workout:", response.statusText);
            alert("Ошибка при удалении тренировки.");
            return false;
        }
    } catch (e) {
        console.error("Error deleting workout:", e);
        return false;
    }
}


/* ====== Rendering ====== */
function renderWorkouts() {
    if (!workoutContainer) return;
    workoutContainer.innerHTML = '';

    if (workouts.length === 0) {
        workoutContainer.innerHTML = '<p class="empty-text">Список тренировок пуст.</p>';
        return;
    }

    workouts.forEach(workout => {
        const item = document.createElement('div');
        item.className = 'workout-item';
        item.setAttribute('data-id', workout.id);
        item.innerHTML = `
            <h3>${workout.title}</h3>
            <p>Упражнений: ${workout.exercises?.length || 0}</p>
            <div class="actions">
                <button class="icon-btn" onclick="openViewModal(${workout.id})">👁️</button>
                <button class="icon-btn delete-btn" onclick="deleteWorkout(${workout.id})">🗑️</button>
            </div>
        `;
        workoutContainer.appendChild(item);
    });
}

function renderViewExercises() {
    if (!viewExercisesList) return;
    
    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;

    viewExercisesList.innerHTML = '';
    
    if (!w.exercises || w.exercises.length === 0) {
        viewExercisesList.innerHTML = '<p class="empty-text">Добавьте упражнения.</p>';
        return;
    }

    w.exercises.forEach((ex, index) => {
        // Проверяем, находится ли упражнение в режиме редактирования
        const isEditing = viewModal.classList.contains('edit-mode') && ex.isEditing;

        // Определяем, какое поле описания использовать ('desc' приоритетнее, но поддерживаем 'description')
        const descriptionText = ex.desc || ex.description || 'Нет описания';
        const timeText = (ex.min > 0 || ex.sec > 0) ? `${ex.min}м ${ex.sec}с` : 'Нет времени';
        const repsText = ex.reps > 0 ? `${ex.reps} повторений` : '';

        const item = document.createElement('div');
        item.className = `view-ex ${isEditing ? 'is-editing' : ''}`;
        item.setAttribute('data-index', index);
        item.innerHTML = `
            <div class="view-display">
                <h4>${ex.name}</h4>
                <p class="details">${repsText} ${ex.sets > 1 ? `x ${ex.sets} подх.` : ''} | ${timeText}</p>
                <p class="desc">${descriptionText}</p>
                <div class="actions">
                    <button class="icon-btn edit-btn" onclick="startEditViewExercise(${index})">✏️</button>
                    <button class="icon-btn delete-btn" onclick="deleteViewExercise(${index})">🗑️</button>
                </div>
            </div>

            <div class="view-edit-form">
                <input type="text" placeholder="Название *" value="${ex.name || ''}" id="editExName-${index}">
                <input type="text" placeholder="Описание (необязательно)" value="${descriptionText === 'Нет описания' ? '' : descriptionText}" id="editExDesc-${index}">
                <input type="number" placeholder="Повторения *" min="1" value="${ex.reps || ''}" id="editExReps-${index}">
                <input type="number" placeholder="Подходы (Sets) *" min="1" value="${ex.sets || 1}" id="editExSets-${index}">
                <div class="time-row">
                    <input type="number" placeholder="Мин" min="0" value="${ex.min || 0}" id="editExMin-${index}">
                    <input type="number" placeholder="Сек" min="0" max="59" value="${ex.sec || 0}" id="editExSec-${index}">
                </div>
                <div class="row end" style="margin-top: 15px;">
                    <button class="btn primary" onclick="saveOneViewExercise(${index})">Сохранить</button>
                    <button class="btn ghost" onclick="cancelEditViewExercise(${index})">Отмена</button>
                </div>
            </div>
        `;
        viewExercisesList.appendChild(item);
    });
}


/* ====== Handlers for Create Modal ====== */
openCreateModal?.addEventListener('click', () => {
    createModal?.classList.add('open');
    overlay?.classList.add('visible');
    newWorkout = { title: '', exercises: [] };
    inputTrainingName.value = '';
    renderCreateExercises();
    stepTitle.classList.add('active');
    stepExercises.classList.remove('active');
});

closeCreateModal?.addEventListener('click', () => {
    createModal?.classList.remove('open');
    overlay?.classList.remove('visible');
});

toExercisesBtn?.addEventListener('click', () => {
    const title = inputTrainingName.value.trim();
    if (!title) {
        alert('Пожалуйста, введите название тренировки.');
        return;
    }
    newWorkout.title = title;
    stepTitle.classList.remove('active');
    stepExercises.classList.add('active');
});

backToTitleBtn?.addEventListener('click', () => {
    stepTitle.classList.add('active');
    stepExercises.classList.remove('active');
});

addExerciseBtn?.addEventListener('click', () => {
    addExForm.style.display = 'block';
    addExerciseBtn.style.display = 'none';
    inputExName.value = '';
    inputExDesc.value = '';
    inputExReps.value = '';
    inputExSets.value = '1';
    inputExMin.value = '0';
    inputExSec.value = '0';
});

cancelAddExBtn?.addEventListener('click', () => {
    addExForm.style.display = 'none';
    addExerciseBtn.style.display = 'block';
});

finishCreateWorkoutBtn?.addEventListener('click', async () => {
    if (newWorkout.exercises.length === 0) {
        alert('Пожалуйста, добавьте хотя бы одно упражнение.');
        return;
    }
    // ID = 0 означает, что это новая тренировка
    const saved = await saveWorkoutChanges({ ...newWorkout, id: 0, user_id: tgUser.id });

    if (saved) {
        createModal?.classList.remove('open');
        overlay?.classList.remove('visible');
    }
});


/* ====== Exercise Creation in Modal ====== */
const saveNewExerciseBtn = document.getElementById('saveNewExerciseBtn');
saveNewExerciseBtn?.addEventListener('click', () => {
    const name = inputExName.value.trim();
    const reps = parseInt(inputExReps.value);
    const sets = parseInt(inputExSets.value);
    const min = parseInt(inputExMin.value) || 0;
    const sec = parseInt(inputExSec.value) || 0;
    const desc = inputExDesc.value.trim() || null;

    if (!name || isNaN(reps) || reps < 1) {
        alert('Пожалуйста, введите название и корректное количество повторений (Reps).');
        return;
    }

    const newExercise = {
        name: name,
        desc: desc, // ИСПРАВЛЕНО: Используем 'desc'
        reps: reps,
        sets: sets,
        min: min,
        sec: sec,
        id: Date.now() // Уникальный ID для фронтенда до сохранения в БД
    };

    newWorkout.exercises.push(newExercise);
    renderCreateExercises();

    // Сброс формы и скрытие
    addExForm.style.display = 'none';
    addExerciseBtn.style.display = 'block';
});

function renderCreateExercises() {
    if (!exercisesList) return;
    exercisesList.innerHTML = '';
    newWorkout.exercises.forEach((ex, index) => {
        const item = document.createElement('div');
        item.className = 'exercise-item';
        item.innerHTML = `
            <span>${ex.name} (${ex.reps}x${ex.sets})</span>
            <button class="icon-btn delete-btn" onclick="deleteNewExercise(${index})">🗑️</button>
        `;
        exercisesList.appendChild(item);
    });
}

window.deleteNewExercise = function(index) {
    newWorkout.exercises.splice(index, 1);
    renderCreateExercises();
}


/* ====== Handlers for View Modal ====== */
window.openViewModal = function(id) {
    const workout = workouts.find(w => w.id === id);
    if (!workout) {
        alert('Тренировка не найдена.');
        return;
    }

    activeViewId = id;
    
    // Сброс режима редактирования заголовка и списка
    exitEditMode(); 
    viewModal.classList.remove('edit-mode');
    
    viewTitleDisplay.textContent = workout.title;
    viewTitleInput.value = workout.title;
    viewTitleDisplay.style.display = 'block';
    viewTitleInput.style.display = 'none';
    viewTitleSaveBtn.style.display = 'none';
    viewTitleCancelBtn.style.display = 'none';
    viewTitleEditBtn.style.display = 'inline-block';
    viewDeleteBtn.style.display = 'inline-block';
    viewAddNewExerciseBtn.style.display = 'block';

    renderViewExercises();

    viewModal.classList.add('open');
    overlay?.classList.add('visible');
    
    // Скрываем форму добавления, если она была открыта
    if (viewExerciseForm) viewExerciseForm.style.display = 'none';
    isAddingNewExerciseInView = false;
}

viewCloseBtn?.addEventListener('click', () => {
    viewModal?.classList.remove('open');
    overlay?.classList.remove('visible');
    exitEditMode();
});

viewDeleteBtn?.addEventListener('click', async () => {
    if (confirm("Вы уверены, что хотите удалить эту тренировку?")) {
        const deleted = await deleteWorkout(activeViewId);
        if (deleted) {
            viewModal?.classList.remove('open');
            overlay?.classList.remove('visible');
            activeViewId = null;
        }
    }
});

viewAddNewExerciseBtn?.addEventListener('click', () => {
    if (viewExerciseForm) {
        isAddingNewExerciseInView = true;
        viewExerciseForm.style.display = 'block';
        viewExName.value = '';
        viewExDesc.value = '';
        viewExReps.value = '';
        viewExMin.value = '0';
        viewExSec.value = '0';
        viewAddNewExerciseBtn.style.display = 'none';
        
        // Переключаем в режим редактирования, чтобы отобразить форму
        viewModal.classList.add('edit-mode'); 
    }
});

cancelNewViewExerciseBtn?.addEventListener('click', () => {
    if (viewExerciseForm) {
        isAddingNewExerciseInView = false;
        viewExerciseForm.style.display = 'none';
        viewAddNewExerciseBtn.style.display = 'block';
        
        // Выходим из режима редактирования, если не осталось других элементов в режиме
        exitEditMode(); 
    }
});

// ⭐ ИСПРАВЛЕНИЕ 3: Исправляем сохранение нового упражнения, используя 'desc'
saveNewViewExerciseBtn?.addEventListener('click', async () => {
    const name = viewExName.value.trim();
    const reps = parseInt(viewExReps.value);
    const min = parseInt(viewExMin.value) || 0;
    const sec = parseInt(viewExSec.value) || 0;
    // Используем 'desc'
    const desc = viewExDesc?.value.trim() || null; 

    if (!name || isNaN(reps) || reps < 1) {
        alert('Пожалуйста, введите название и корректное количество повторений (Reps).');
        return;
    }

    const newExercise = {
        name: name,
        desc: desc, // ⭐ ИСПРАВЛЕНИЕ: Используем 'desc'
        reps: reps,
        sets: 1, 
        min: min,
        sec: sec,
        id: Date.now() 
    };
    
    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) { alert('Ошибка: Тренировка не найдена.'); return; }
    
    if (!w.exercises) w.exercises = [];
    w.exercises.push(newExercise);
    
    const saved = await saveWorkoutChanges(w);
    
    if (saved) {
        // Сброс состояния после сохранения
        isAddingNewExerciseInView = false;
        if (viewExerciseForm) viewExerciseForm.style.display = 'none';
        viewAddNewExerciseBtn.style.display = 'block';

        // Обновляем отображение списка
        renderViewExercises(); 
        
        // Выходим из режима редактирования, если нет других элементов
        exitEditMode();
    }
});


/* ====== Exercise Edit/Delete Handlers in View Modal ====== */

window.startEditViewExercise = function(index) {
    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w || !w.exercises[index]) return;

    // Сбрасываем все другие редактирования
    w.exercises.forEach(ex => ex.isEditing = false);
    
    w.exercises[index].isEditing = true;
    viewModal.classList.add('edit-mode');
    viewAddNewExerciseBtn.style.display = 'none';
    renderViewExercises();
}

window.cancelEditViewExercise = function(index) {
    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w || !w.exercises[index]) return;

    w.exercises[index].isEditing = false;
    renderViewExercises();
    
    // Проверка, остались ли другие элементы в режиме редактирования/добавления
    if (!w.exercises.some(ex => ex.isEditing) && !isAddingNewExerciseInView) {
        exitEditMode();
    }
}

window.saveOneViewExercise = async function(index) {
    const nameInput = document.getElementById(`editExName-${index}`);
    const descInput = document.getElementById(`editExDesc-${index}`);
    const repsInput = document.getElementById(`editExReps-${index}`);
    const setsInput = document.getElementById(`editExSets-${index}`);
    const minInput = document.getElementById(`editExMin-${index}`);
    const secInput = document.getElementById(`editExSec-${index}`);

    const name = nameInput.value.trim();
    const reps = parseInt(repsInput.value);
    const sets = parseInt(setsInput.value);
    const min = parseInt(minInput.value) || 0;
    const sec = parseInt(secInput.value) || 0;
    const desc = descInput.value.trim() || null;

    if (!name || isNaN(reps) || reps < 1) {
        alert('Пожалуйста, введите название и корректное количество повторений (Reps).');
        return;
    }

    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w || !w.exercises[index]) return;

    // Обновляем данные на фронтенде
    w.exercises[index].name = name;
    w.exercises[index].desc = desc; // Обновляем 'desc'
    w.exercises[index].reps = reps;
    w.exercises[index].sets = sets;
    w.exercises[index].min = min;
    w.exercises[index].sec = sec;
    w.exercises[index].isEditing = false;
    
    const saved = await saveWorkoutChanges(w);

    if (saved) {
        renderViewExercises();
        
        // Проверка, остались ли другие элементы в режиме редактирования/добавления
        if (!w.exercises.some(ex => ex.isEditing) && !isAddingNewExerciseInView) {
            exitEditMode();
        }
    }
}

window.deleteViewExercise = async function(index) {
    if (!confirm("Удалить это упражнение?")) return;

    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w || !w.exercises[index]) return;

    w.exercises.splice(index, 1);
    
    const saved = await saveWorkoutChanges(w);

    if (saved) {
        renderViewExercises();
        
        // Проверка, остались ли другие элементы в режиме редактирования/добавления
        if (!w.exercises.some(ex => ex.isEditing) && !isAddingNewExerciseInView) {
            exitEditMode();
        }
    }
}

// Убедимся, что modal выходит из режима редактирования
window.exitEditMode = function() {
    viewModal.classList.remove('edit-mode');
    viewAddNewExerciseBtn.style.display = 'block';
    
    // Сбрасываем флаги isEditing для всех упражнений
    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (w) w.exercises.forEach(ex => ex.isEditing = false);
    
    isAddingNewExerciseInView = false;
    if (viewExerciseForm) viewExerciseForm.style.display = 'none';
}


/* ====== Title Edit Handlers ====== */
window.startTitleEdit = function() {
    viewTitleDisplay.style.display = 'none';
    viewTitleInput.style.display = 'block';
    viewTitleSaveBtn.style.display = 'inline-block';
    viewTitleCancelBtn.style.display = 'inline-block';
    viewTitleEditBtn.style.display = 'none';
    viewDeleteBtn.style.display = 'none';
}

viewTitleSaveBtn?.addEventListener('click', async () => {
    const newTitle = viewTitleInput.value.trim();
    if (!newTitle) {
        alert('Название не может быть пустым.');
        return;
    }

    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    if (!w) return;

    w.title = newTitle;
    const saved = await saveWorkoutChanges(w);

    if (saved) {
        viewTitleDisplay.textContent = newTitle;
        cancelTitleEdit();
    }
});

viewTitleCancelBtn?.addEventListener('click', cancelTitleEdit);

function cancelTitleEdit() {
    let w = workouts.find(x => Number(x.id) === Number(activeViewId));
    viewTitleInput.value = w ? w.title : '';

    viewTitleDisplay.style.display = 'block';
    viewTitleInput.style.display = 'none';
    viewTitleSaveBtn.style.display = 'none';
    viewTitleCancelBtn.style.display = 'none';
    viewTitleEditBtn.style.display = 'inline-block';
    viewDeleteBtn.style.display = 'inline-block';
}


/* ====== Profile Handlers ====== */
profileBtn?.addEventListener('click', async () => {
    if (!tgUser.id) {
        alert("Идентификатор пользователя не найден.");
        return;
    }

    try {
        // Загрузка профиля
        const response = await fetch(`${API_BASE}/api/get_profile?user_id=${tgUser.id}`);
        if (!response.ok) throw new Error("Failed to fetch profile");
        const profileData = await response.json();
        
        // Обновление UI
        const profileBody = document.getElementById('profileBody');
        if (profileBody) {
            profileBody.innerHTML = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${profileData.avatar_url || 'https://via.placeholder.com/80'}" alt="Аватар" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
                    <p><strong>${profileData.username || 'Пользователь'}</strong></p>
                </div>
                <p>Всего тренировок: <strong>${profileData.total_workouts}</strong></p>
                <p>Выполнено: <strong>${profileData.completed_workouts}</strong></p>
                
                <div style="margin-top: 20px;">
                    <label for="notifyTimeInput">Время напоминания (HH:mm):</label>
                    <input type="time" id="notifyTimeInput" value="${profileData.notify_time || ''}" style="width: 100%; padding: 10px; margin-top: 5px;">
                </div>
                <button class="btn primary" id="saveProfileBtn" style="margin-top: 15px;">Сохранить настройки</button>
            `;
            
            // Заново привязываем обработчик сохранения после рендеринга
            const saveProfileBtn = document.getElementById('saveProfileBtn');
            saveProfileBtn?.addEventListener('click', saveProfileSettings);
        }

        profileModal?.classList.add('open');
        overlay?.classList.add('visible');

    } catch (e) {
        console.error("Error fetching profile:", e);
        alert("Не удалось загрузить данные профиля.");
    }
});

closeProfileBtn?.addEventListener('click', () => {
    profileModal?.classList.remove('open');
    overlay?.classList.remove('visible');
});

async function saveProfileSettings() {
    const notifyTimeInput = document.getElementById('notifyTimeInput');
    const notifyTime = notifyTimeInput?.value || null;

    if (!tgUser.id) return;

    const payload = {
        id: tgUser.id,
        notify_time: notifyTime
        // другие поля, которые можно редактировать (сейчас только notify_time)
    };

    try {
        const response = await fetch(`${API_BASE}/api/save_profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Настройки профиля сохранены.");
        } else {
            alert("Ошибка сохранения настроек.");
        }
    } catch (e) {
        console.error("Error saving profile:", e);
        alert("Ошибка сети при сохранении профиля.");
    }
}


/* ====== Initialization ====== */
document.addEventListener('DOMContentLoaded', () => {
    fetchWorkouts();

    // Загрузка аватарки и имени сразу
    if (tgUser.id) {
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName'); // Если есть такой элемент
        
        if (userAvatar) userAvatar.src = tgUser.photo_url || "https://via.placeholder.com/80";
        if (userName) userName.textContent = tgUser.first_name;
        
        // Регистрация пользователя при старте
        fetch(`${API_BASE}/api/register_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tgUser)
        }).catch(e => console.error("Error registering user:", e));
    }
});


/* ====== Global helpers ====== */
window.editExercise = editExercise;
window.deleteExercise = deleteExercise;
window.startEditViewExercise = startEditViewExercise; 
window.cancelEditViewExercise = cancelEditViewExercise; 
window.deleteViewExercise = deleteViewExercise; 
window.saveOneViewExercise = saveOneViewExercise; 
window.exitEditMode = exitEditMode; 
window.startTitleEdit = startTitleEdit; 
window.openViewModal = openViewModal;
/* ====== Init ====== */
window.addEventListener('DOMContentLoaded', loadWorkouts);