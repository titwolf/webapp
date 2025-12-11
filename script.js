document.addEventListener('DOMContentLoaded', () => {
    // =======================================================================
    // КОНСТАНТЫ И ОСНОВНЫЕ ПЕРЕМЕННЫЕ
    // =======================================================================
    const WebApp = window.Telegram.WebApp;
    WebApp.ready();

    // Элементы DOM для основного функционала
    const workoutContainer = document.getElementById('workoutContainer');
    const emptyText = document.querySelector('.empty-text');
    const overlay = document.getElementById('overlay');

    // Элементы DOM для модалки создания/редактирования
    const createModal = document.getElementById('createModal');
    const openCreateModalBtn = document.getElementById('openCreateModal');
    const closeCreateModalBtn = document.getElementById('closeCreateModal');
    const stepTitle = document.getElementById('stepTitle');
    const stepExercises = document.getElementById('stepExercises');
    const inputTrainingName = document.getElementById('inputTrainingName');
    const trainingTitleDisplay = document.getElementById('trainingTitleDisplay');
    const toExercisesBtn = document.getElementById('toExercisesBtn');
    const backToTitleBtn = document.getElementById('backToTitleBtn');
    const saveTrainingBtn = document.getElementById('saveTrainingBtn');

    // Элементы DOM для формы упражнения
    const toggleExerciseFormBtn = document.getElementById('toggleExerciseFormBtn');
    const exerciseForm = document.getElementById('exerciseForm');
    const exNameInput = document.getElementById('exName');
    const exDescInput = document.getElementById('exDesc');
    const exRepsInput = document.getElementById('exReps');
    const exMinInput = document.getElementById('exMin');
    const exSecInput = document.getElementById('exSec');
    const saveExerciseBtn = document.getElementById('saveExerciseBtn');
    const cancelExerciseBtn = document.getElementById('cancelExerciseBtn');
    const exerciseList = document.getElementById('exerciseList');

    // Элементы DOM для модалки просмотра
    const viewModal = document.getElementById('viewModal');
    const closeViewBtn = document.getElementById('closeViewBtn');
    const viewBody = document.getElementById('viewBody');
    const viewTitleDisplay = document.getElementById('viewTitleDisplay');
    const viewTitleDisplayContainer = document.getElementById('viewTitleDisplayContainer');
    const viewTitleEditForm = document.getElementById('viewTitleEditForm');
    const viewTitleInput = document.getElementById('viewTitleInput');
    const viewTitleEditBtn = document.getElementById('viewTitleEditBtn');
    const viewTitleSaveBtn = document.getElementById('viewTitleSaveBtn');
    const viewTitleCancelBtn = document.getElementById('viewTitleCancelBtn');

    const editWorkoutBtn = document.getElementById('editWorkoutBtn');
    const deleteWorkoutBtn = document.getElementById('deleteWorkoutBtn');
    const startWorkoutBtn = document.getElementById('startWorkoutBtn');

    const mainViewActions = document.getElementById('mainViewActions');
    const editModeActions = document.getElementById('editModeActions');
    const exitEditModeBtn = document.getElementById('exitEditModeBtn');
    const saveViewChangesBtn = document.getElementById('saveViewChangesBtn');
    const cancelViewEditBtn = document.getElementById('cancelViewEditBtn');
    const addExerciseToViewBtn = document.getElementById('addExerciseToViewBtn');

    // Элементы DOM для модалки профиля
    const profileModal = document.getElementById('profileModal');
    const profileBtn = document.getElementById('profileBtn');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const createdCount = document.getElementById('createdCount');
    const completedCount = document.getElementById('completedCount');
    const notifyTime = document.getElementById('notifyTime');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    // Состояние
    let workouts = JSON.parse(localStorage.getItem('fitplan_workouts')) || [];
    let currentTraining = { name: '', exercises: [] };
    let editingWorkoutId = null; // ID тренировки, которую мы редактируем в viewModal
    let isEditingExercise = false; // Флаг для формы создания/редактирования упражнения в createModal

    // =======================================================================
    // СЛУЖЕБНЫЕ ФУНКЦИИ
    // =======================================================================

    /**
     * Отображает или скрывает оверлей и модальные окна.
     * @param {HTMLElement} modal - Модальное окно для показа/скрытия.
     * @param {boolean} show - true для показа, false для скрытия.
     */
    const toggleModal = (modal, show) => {
        if (show) {
            overlay.classList.add('show');
            modal.classList.add('show');
            WebApp.expand();
            WebApp.HapticFeedback.impactOccurred('light');
        } else {
            // Если скрываем, проверяем, есть ли другие открытые модалки
            const otherModals = [createModal, viewModal, profileModal].filter(m => m !== modal && m.classList.contains('show'));
            
            modal.classList.remove('show');
            
            if (otherModals.length === 0) {
                overlay.classList.remove('show');
                WebApp.HapticFeedback.impactOccurred('light');
                // WebApp.collapse(); // Можно раскомментировать, если нужно сворачивать при закрытии последней модалки
            }
        }
    };

    /**
     * Переключает шаги в модалке создания тренировки.
     * @param {HTMLElement} currentStep - Текущий шаг.
     * @param {HTMLElement} nextStep - Следующий шаг.
     */
    const switchStep = (currentStep, nextStep) => {
        currentStep.classList.remove('active');
        currentStep.setAttribute('aria-hidden', 'true');
        nextStep.classList.add('active');
        nextStep.setAttribute('aria-hidden', 'false');
    };

    /**
     * Создает HTML-разметку для карточки упражнения в модалке создания.
     * @param {object} exercise - Объект упражнения.
     * @param {number} index - Индекс упражнения.
     * @returns {string} HTML-разметка.
     */
    const createExerciseCard = (exercise, index, isDraggable = true) => {
        const time = (exercise.min || 0) > 0 || (exercise.sec || 0) > 0 
            ? ` | ${exercise.min ? exercise.min + 'мин' : ''} ${exercise.sec ? exercise.sec + 'сек' : ''}`.trim()
            : '';
        
        return `
            <div class="exercise-card" data-index="${index}" draggable="${isDraggable}">
                <div class="ex-card-head">
                    <div class="ex-title">${index + 1}. ${exercise.name}</div>
                    <div class="ex-actions">
                        <button class="icon-small" onclick="editExercise(${index})">✎</button>
                        <button class="icon-small" onclick="deleteExercise(${index})">🗑</button>
                    </div>
                </div>
                <div class="ex-meta">Повторения: ${exercise.reps} ${time}</div>
                ${exercise.desc ? `<div class="ex-desc" style="font-size:12px; opacity:0.8;">${exercise.desc}</div>` : ''}
            </div>
        `;
    };

    /**
     * Рендерит список упражнений в модалке создания.
     */
    const renderExerciseList = () => {
        exerciseList.innerHTML = currentTraining.exercises.map((ex, index) => createExerciseCard(ex, index)).join('');
        saveTrainingBtn.disabled = currentTraining.exercises.length === 0;
        saveTrainingBtn.classList.toggle('disabled', currentTraining.exercises.length === 0);
        
        // Переинициализация Drag and Drop
        if (currentTraining.exercises.length > 0) {
             initDragAndDrop();
        }
    };
    
    // =======================================================================
    // Drag and Drop (D&D) для списка упражнений
    // =======================================================================
    
    let draggedItem = null;

    const initDragAndDrop = () => {
        const cards = exerciseList.querySelectorAll('.exercise-card');
        
        cards.forEach(card => {
            card.removeEventListener('dragstart', handleDragStart);
            card.removeEventListener('dragover', handleDragOver);
            card.removeEventListener('dragenter', handleDragEnter);
            card.removeEventListener('dragleave', handleDragLeave);
            card.removeEventListener('drop', handleDrop);
            card.removeEventListener('dragend', handleDragEnd);
            
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragover', handleDragOver);
            card.addEventListener('dragenter', handleDragEnter);
            card.addEventListener('dragleave', handleDragLeave);
            card.addEventListener('drop', handleDrop);
            card.addEventListener('dragend', handleDragEnd);
        });
    };

    function handleDragStart(e) {
        draggedItem = this;
        // Используем setTimeout, чтобы избежать срабатывания стиля 'dragging' немедленно,
        // что может сбить с толку.
        setTimeout(() => this.classList.add('dragging'), 0); 
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.index); // Сохраняем исходный индекс
    }

    function handleDragOver(e) {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        // Добавляем класс, чтобы визуально показать место, куда будет вставлен элемент
        if (this !== draggedItem) {
            this.classList.add('over');
        }
    }

    function handleDragLeave() {
        this.classList.remove('over');
    }

    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('over');

        if (this !== draggedItem) {
            const fromIndex = parseInt(draggedItem.dataset.index);
            const toIndex = parseInt(this.dataset.index);
            
            // Перемещаем элемент в массиве
            const [movedExercise] = currentTraining.exercises.splice(fromIndex, 1);
            currentTraining.exercises.splice(toIndex, 0, movedExercise);
            
            renderExerciseList();
        }
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        exerciseList.querySelectorAll('.exercise-card').forEach(card => card.classList.remove('over'));
        draggedItem = null;
    }


    // =======================================================================
    // Функции работы с тренировками (CRUD)
    // =======================================================================

    /**
     * Рендерит карточки тренировок на главной странице.
     */
    const renderWorkouts = () => {
        workoutContainer.innerHTML = '';
        if (workouts.length === 0) {
            emptyText.style.display = 'block';
        } else {
            emptyText.style.display = 'none';
            workouts.forEach(workout => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                card.dataset.id = workout.id;
                
                const totalExercises = workout.exercises.length;
                
                card.innerHTML = `
                    <div class="workout-title">${workout.name}</div>
                    <div class="workout-info">Упражнений: ${totalExercises}</div>
                `;
                
                card.addEventListener('click', () => openViewModal(workout.id));
                workoutContainer.appendChild(card);
            });
        }
        localStorage.setItem('fitplan_workouts', JSON.stringify(workouts));
        updateProfileStats();
    };

    /**
     * Создает или обновляет упражнение в списке.
     * @param {number|null} index - Индекс упражнения для редактирования или null для создания нового.
     */
    const saveOrUpdateExercise = (index = null) => {
        const name = exNameInput.value.trim();
        const desc = exDescInput.value.trim();
        const reps = parseInt(exRepsInput.value);
        const min = parseInt(exMinInput.value) || 0;
        const sec = parseInt(exSecInput.value) || 0;

        if (!name || isNaN(reps) || reps <= 0) {
            WebApp.HapticFeedback.notificationOccurred('error');
            alert('Пожалуйста, введите название упражнения и корректное количество повторений.');
            return;
        }

        const newExercise = { name, desc, reps, min, sec };

        if (index !== null && index >= 0 && index < currentTraining.exercises.length) {
            // Редактирование
            currentTraining.exercises[index] = newExercise;
        } else {
            // Создание
            currentTraining.exercises.push(newExercise);
        }

        renderExerciseList();
        clearExerciseForm();
        toggleExerciseForm(false);
        isEditingExercise = false;
        WebApp.HapticFeedback.notificationOccurred('success');
    };

    /**
     * Очищает поля формы упражнения.
     */
    const clearExerciseForm = () => {
        exNameInput.value = '';
        exDescInput.value = '';
        exRepsInput.value = '';
        exMinInput.value = '';
        exSecInput.value = '';
        saveExerciseBtn.innerText = 'Сохранить упражнение';
    };

    /**
     * Открывает форму для редактирования существующего упражнения.
     * @param {number} index - Индекс упражнения в массиве.
     */
    window.editExercise = (index) => {
        const exercise = currentTraining.exercises[index];
        if (!exercise) return;

        exNameInput.value = exercise.name;
        exDescInput.value = exercise.desc;
        exRepsInput.value = exercise.reps;
        exMinInput.value = exercise.min;
        exSecInput.value = exercise.sec;
        
        saveExerciseBtn.innerText = 'Обновить упражнение';
        saveExerciseBtn.removeEventListener('click', createExerciseHandler);
        saveExerciseBtn.addEventListener('click', () => saveOrUpdateExercise(index), { once: true });
        
        toggleExerciseForm(true);
        isEditingExercise = true;
    };

    /**
     * Удаляет упражнение.
     * @param {number} index - Индекс упражнения в массиве.
     */
    window.deleteExercise = (index) => {
        if (confirm('Вы уверены, что хотите удалить это упражнение?')) {
            currentTraining.exercises.splice(index, 1);
            renderExerciseList();
            WebApp.HapticFeedback.notificationOccurred('warning');
        }
    };

    /**
     * Сохраняет новую тренировку.
     */
    const saveTraining = () => {
        if (!currentTraining.name || currentTraining.exercises.length === 0) {
            WebApp.HapticFeedback.notificationOccurred('error');
            alert('Название и хотя бы одно упражнение обязательны.');
            return;
        }

        const newWorkout = {
            id: Date.now(), // Простой ID на основе timestamp
            name: currentTraining.name,
            exercises: currentTraining.exercises,
            created: new Date().toISOString()
        };

        workouts.push(newWorkout);
        renderWorkouts();
        closeCreateModalHandler();
        WebApp.HapticFeedback.notificationOccurred('success');
    };

    /**
     * Возвращает тренировку по ID.
     * @param {number} id - ID тренировки.
     * @returns {object|null} Объект тренировки.
     */
    const getWorkoutById = (id) => {
        return workouts.find(w => w.id === id);
    };

    // =======================================================================
    // Функции для модалки ПРОСМОТРА/РЕДАКТИРОВАНИЯ
    // =======================================================================
    
    /**
     * Создает HTML-разметку для отображения упражнения в режиме просмотра.
     */
    const createViewDisplayExerciseHTML = (exercise, index) => {
        const timeStr = (exercise.min || 0) > 0 || (exercise.sec || 0) > 0 
            ? `<span style="font-weight:600;">${exercise.min ? exercise.min + ' мин' : ''} ${exercise.sec ? exercise.sec + ' сек' : ''}</span>`.trim()
            : '';

        return `
            <div class="view-display">
                <div style="font-weight:700; font-size:16px;">${index + 1}. ${exercise.name}</div>
                <div style="color:rgba(255,255,255,0.7); margin-top:2px; font-size:13px;">
                    Повторения: <span style="font-weight:600;">${exercise.reps}</span> ${timeStr}
                </div>
                ${exercise.desc ? `<div style="font-size:14px; margin-top:2px; opacity:0.9;">${exercise.desc}</div>` : ''}
            </div>
        `;
    };

    /**
     * Создает HTML-разметку для отображения упражнения в режиме редактирования списка.
     */
    const createViewEditListItemHTML = (exercise, index) => {
        return `
            <div class="view-edit-list-item">
                <div style="font-weight:600;">${index + 1}. ${exercise.name} (${exercise.reps} повт.)</div>
                <div class="ex-actions">
                    <button class="icon-small" onclick="editViewExercise(${index})">✎</button>
                    <button class="icon-small" onclick="deleteViewExercise(${index})">🗑</button>
                </div>
            </div>
        `;
    };

    /**
     * Создает HTML-разметку для формы редактирования упражнения.
     */
    const createViewEditFormHTML = (exercise, index) => {
        return `
            <div class="view-edit-form">
                <input id="viewExName_${index}" type="text" placeholder="Название упражнения *" value="${exercise.name || ''}">
                <input id="viewExDesc_${index}" type="text" placeholder="Описание (необязательно)" value="${exercise.desc || ''}">
                <input id="viewExReps_${index}" type="number" placeholder="Повторения *" min="1" value="${exercise.reps || ''}">
                <div class="time-row">
                    <input id="viewExMin_${index}" type="number" placeholder="Мин" min="0" value="${exercise.min || 0}">
                    <input id="viewExSec_${index}" type="number" placeholder="Сек" min="0" max="59" value="${exercise.sec || 0}">
                </div>
                <div class="row end">
                    <button class="btn primary" onclick="saveViewExercise(${index})">Сохранить</button>
                    <button class="btn ghost" onclick="cancelViewExerciseEdit(${index})">Отмена</button>
                </div>
            </div>
        `;
    };

    /**
     * Рендерит список упражнений в модалке просмотра/редактирования.
     * @param {object} workout - Объект тренировки.
     */
    const renderViewBody = (workout) => {
        viewBody.innerHTML = '';
        workout.exercises.forEach((exercise, index) => {
            const exerciseEl = document.createElement('div');
            exerciseEl.className = 'view-ex';
            exerciseEl.dataset.index = index;

            exerciseEl.innerHTML = 
                createViewDisplayExerciseHTML(exercise, index) + 
                createViewEditListItemHTML(exercise, index) + 
                createViewEditFormHTML(exercise, index);

            viewBody.appendChild(exerciseEl);
        });

        // Добавляем форму для нового упражнения в режиме редактирования
        if (viewModal.classList.contains('edit-mode')) {
             const newExerciseForm = document.createElement('div');
             newExerciseForm.className = 'view-ex is-editing-new';
             newExerciseForm.style.display = 'none'; // По умолчанию скрыта
             newExerciseForm.innerHTML = createViewEditFormHTML(
                { name: '', desc: '', reps: '', min: 0, sec: 0 }, 
                'new'
            ).replace(/saveViewExercise\('new'\)/g, 'saveNewViewExercise()'); // Заменяем функцию сохранения для нового

             viewBody.appendChild(newExerciseForm);
        }
    };
    
    /**
     * Переключает модалку просмотра в режим редактирования.
     * @param {boolean} isEditMode - true для режима редактирования.
     */
    const toggleViewEditMode = (isEditMode) => {
        if (isEditMode) {
            viewModal.classList.add('edit-mode');
            mainViewActions.style.display = 'none';
            editModeActions.style.display = 'flex';
            viewTitleEditBtn.style.display = 'flex'; 
        } else {
            viewModal.classList.remove('edit-mode');
            mainViewActions.style.display = 'flex';
            editModeActions.style.display = 'none';
            viewTitleEditBtn.style.display = 'none';
            toggleTitleEdit(false); // Скрыть форму редактирования названия
        }
        
        const workout = getWorkoutById(editingWorkoutId);
        if (workout) {
             renderViewBody(workout);
        }
    };

    /**
     * Открывает модалку просмотра.
     * @param {number} id - ID тренировки.
     */
    const openViewModal = (id) => {
        const workout = getWorkoutById(id);
        if (!workout) return;
        
        editingWorkoutId = id;
        viewTitleDisplay.textContent = workout.name;
        
        toggleViewEditMode(false); // Всегда открываем в режиме просмотра
        renderViewBody(workout);
        toggleModal(viewModal, true);
    };

    /**
     * Переключает отображение формы редактирования названия тренировки.
     * @param {boolean} isEditMode - true для отображения формы.
     */
    const toggleTitleEdit = (isEditMode) => {
        if (isEditMode) {
            viewTitleDisplayContainer.style.display = 'none';
            viewTitleEditForm.style.display = 'flex';
            viewTitleInput.value = viewTitleDisplay.textContent;
            viewTitleInput.focus();
        } else {
            viewTitleDisplayContainer.style.display = 'flex';
            viewTitleEditForm.style.display = 'none';
        }
    };
    
    /**
     * Сохраняет отредактированное название тренировки.
     */
    const saveTitleEdit = () => {
        const newTitle = viewTitleInput.value.trim();
        if (!newTitle) {
            WebApp.HapticFeedback.notificationOccurred('error');
            alert('Название тренировки не может быть пустым.');
            return;
        }

        const workout = getWorkoutById(editingWorkoutId);
        if (workout) {
            workout.name = newTitle;
            viewTitleDisplay.textContent = newTitle;
            toggleTitleEdit(false);
            WebApp.HapticFeedback.notificationOccurred('success');
            renderWorkouts(); // Обновляем список на главной
        }
    };

    /**
     * Переключает элемент упражнения в режим редактирования формы.
     * @param {number} index - Индекс упражнения.
     */
    window.editViewExercise = (index) => {
        viewBody.querySelectorAll('.view-ex').forEach(el => el.classList.remove('is-editing'));
        const exerciseEl = viewBody.querySelector(`.view-ex[data-index="${index}"]`);
        if (exerciseEl) {
            exerciseEl.classList.add('is-editing');
        }
        // Скрываем форму для нового упражнения, если она была открыта
        const newForm = viewBody.querySelector('.view-ex.is-editing-new');
        if (newForm) newForm.style.display = 'none';
        
        WebApp.HapticFeedback.impactOccurred('medium');
    };

    /**
     * Отменяет редактирование упражнения и возвращает к списку.
     * @param {number} index - Индекс упражнения.
     */
    window.cancelViewExerciseEdit = (index) => {
        const exerciseEl = viewBody.querySelector(`.view-ex[data-index="${index}"]`);
        if (exerciseEl) {
            exerciseEl.classList.remove('is-editing');
        }
        
        // Скрываем форму для нового упражнения, если это отмена добавления
        const newForm = viewBody.querySelector('.view-ex.is-editing-new');
        if (index === 'new' && newForm) newForm.style.display = 'none';

        WebApp.HapticFeedback.impactOccurred('light');
    };

    /**
     * Сохраняет изменения в упражнении.
     * @param {number} index - Индекс упражнения.
     */
    window.saveViewExercise = (index) => {
        const workout = getWorkoutById(editingWorkoutId);
        if (!workout) return;

        const exercise = workout.exercises[index];
        
        // Получаем значения из полей ввода в текущей форме
        const name = document.getElementById(`viewExName_${index}`).value.trim();
        const desc = document.getElementById(`viewExDesc_${index}`).value.trim();
        const reps = parseInt(document.getElementById(`viewExReps_${index}`).value);
        const min = parseInt(document.getElementById(`viewExMin_${index}`).value) || 0;
        const sec = parseInt(document.getElementById(`viewExSec_${index}`).value) || 0;

        if (!name || isNaN(reps) || reps <= 0) {
            WebApp.HapticFeedback.notificationOccurred('error');
            alert('Название и повторения обязательны.');
            return;
        }

        // Обновляем данные
        exercise.name = name;
        exercise.desc = desc;
        exercise.reps = reps;
        exercise.min = min;
        exercise.sec = sec;
        
        // Переключаем обратно в режим списка
        const exerciseEl = viewBody.querySelector(`.view-ex[data-index="${index}"]`);
        if (exerciseEl) {
            exerciseEl.classList.remove('is-editing');
            // Перерендерим только этот элемент, чтобы обновить текст в списке
            exerciseEl.querySelector('.view-edit-list-item').innerHTML = createViewEditListItemHTML(exercise, index).match(/<div class="view-edit-list-item">([\s\S]*)<\/div>/)[1];
            exerciseEl.querySelector('.view-display').innerHTML = createViewDisplayExerciseHTML(exercise, index).match(/<div class="view-display">([\s\S]*)<\/div>/)[1];
        }
        
        // Обновляем localStorage
        localStorage.setItem('fitplan_workouts', JSON.stringify(workouts));
        WebApp.HapticFeedback.notificationOccurred('success');
    };

    /**
     * Сохраняет новое упражнение в режиме редактирования.
     */
    const saveNewViewExercise = () => {
        const workout = getWorkoutById(editingWorkoutId);
        if (!workout) return;

        // "new" индекс используется для формы добавления
        const name = document.getElementById(`viewExName_new`).value.trim();
        const desc = document.getElementById(`viewExDesc_new`).value.trim();
        const reps = parseInt(document.getElementById(`viewExReps_new`).value);
        const min = parseInt(document.getElementById(`viewExMin_new`).value) || 0;
        const sec = parseInt(document.getElementById(`viewExSec_new`).value) || 0;

        if (!name || isNaN(reps) || reps <= 0) {
            WebApp.HapticFeedback.notificationOccurred('error');
            alert('Название и повторения обязательны.');
            return;
        }

        const newExercise = { name, desc, reps, min, sec };
        workout.exercises.push(newExercise);
        
        // Обновляем и переключаем
        localStorage.setItem('fitplan_workouts', JSON.stringify(workouts));
        renderViewBody(workout); // Полный ре-рендер для обновления индексов и добавления нового элемента
        
        // Скрываем форму добавления
        const newForm = viewBody.querySelector('.view-ex.is-editing-new');
        if (newForm) newForm.style.display = 'none';

        WebApp.HapticFeedback.notificationOccurred('success');
        renderWorkouts(); // Обновляем счетчик упражнений на главной
    };

    /**
     * Удаляет упражнение из модалки просмотра.
     * @param {number} index - Индекс упражнения.
     */
    window.deleteViewExercise = (index) => {
        if (!confirm('Вы уверены, что хотите удалить это упражнение?')) return;
        
        const workout = getWorkoutById(editingWorkoutId);
        if (workout) {
            workout.exercises.splice(index, 1);
            localStorage.setItem('fitplan_workouts', JSON.stringify(workouts));
            renderViewBody(workout); // Полный ре-рендер для обновления индексов
            renderWorkouts(); // Обновляем счетчик на главной
            WebApp.HapticFeedback.notificationOccurred('warning');
        }
    };
    
    /**
     * Удаляет тренировку.
     */
    const deleteWorkout = () => {
        if (!confirm(`Вы уверены, что хотите удалить тренировку "${viewTitleDisplay.textContent}"?`)) return;

        workouts = workouts.filter(w => w.id !== editingWorkoutId);
        renderWorkouts();
        toggleModal(viewModal, false);
        WebApp.HapticFeedback.notificationOccurred('warning');
    };

    // =======================================================================
    // Функции для модалки ПРОФИЛЯ
    // =======================================================================

    /**
     * Обновляет статистику профиля.
     */
    const updateProfileStats = () => {
        createdCount.textContent = workouts.length;
        // completedCount пока не используется, оставим 0
        
        const userData = WebApp.initDataUnsafe.user;
        if (userData) {
            profileName.textContent = userData.first_name + (userData.last_name ? ` ${userData.last_name}` : '');
            profileAvatar.src = WebApp.initDataUnsafe.user.photo_url || 'https://via.placeholder.com/120';
            document.getElementById('userAvatar').src = profileAvatar.src;
        } else {
            profileName.textContent = 'Пользователь Telegram';
        }
        
        // Загрузка настроек уведомлений
        const settings = JSON.parse(localStorage.getItem('fitplan_settings')) || {};
        notifyTime.value = settings.notifyTime || '';
    };

    /**
     * Сохраняет настройки профиля.
     */
    const saveProfileSettings = () => {
        const settings = {
            notifyTime: notifyTime.value
        };
        localStorage.setItem('fitplan_settings', JSON.stringify(settings));
        WebApp.HapticFeedback.notificationOccurred('success');
        alert('Настройки сохранены!');
    };

    // =======================================================================
    // ОБРАБОТЧИКИ СОБЫТИЙ
    // =======================================================================

    // ----- Модалка создания/редактирования -----
    openCreateModalBtn.addEventListener('click', () => {
        currentTraining = { name: '', exercises: [] };
        clearExerciseForm();
        renderExerciseList();
        inputTrainingName.value = '';
        switchStep(stepExercises, stepTitle); // Сбрасываем на первый шаг
        toggleModal(createModal, true);
    });

    closeCreateModalBtn.addEventListener('click', () => {
        if (isEditingExercise) {
            if (confirm('Вы уверены, что хотите отменить редактирование упражнения?')) {
                isEditingExercise = false;
                toggleExerciseForm(false);
            }
        } else if (currentTraining.exercises.length > 0 && stepExercises.classList.contains('active')) {
             if (confirm('Вы уверены, что хотите отменить создание тренировки? Все несохраненные данные будут потеряны.')) {
                 toggleModal(createModal, false);
             }
        } else {
             toggleModal(createModal, false);
        }
    });
    
    // Обработчик для создания/обновления упражнения (переназначение при редактировании)
    const createExerciseHandler = () => saveOrUpdateExercise(null);
    saveExerciseBtn.addEventListener('click', createExerciseHandler);
    
    // Инициализация формы упражнения
    const toggleExerciseForm = (show) => {
        if (show) {
            exerciseForm.classList.add('active');
            exerciseForm.setAttribute('aria-hidden', 'false');
            toggleExerciseFormBtn.style.display = 'none';
        } else {
            exerciseForm.classList.remove('active');
            exerciseForm.setAttribute('aria-hidden', 'true');
            toggleExerciseFormBtn.style.display = 'block';
            clearExerciseForm(); // Очищаем форму при скрытии
            // Переподключаем слушатель на создание, если он был изменен на редактирование
            saveExerciseBtn.removeEventListener('click', createExerciseHandler); 
            saveExerciseBtn.addEventListener('click', createExerciseHandler);
            isEditingExercise = false;
        }
    };
    
    toggleExerciseFormBtn.addEventListener('click', () => toggleExerciseForm(true));
    cancelExerciseBtn.addEventListener('click', () => {
        if (isEditingExercise) {
            if (confirm('Отменить изменения в упражнении?')) {
                isEditingExercise = false;
                toggleExerciseForm(false);
            }
        } else {
             toggleExerciseForm(false);
        }
    });

    toExercisesBtn.addEventListener('click', () => {
        const name = inputTrainingName.value.trim();
        if (name) {
            currentTraining.name = name;
            trainingTitleDisplay.textContent = name;
            switchStep(stepTitle, stepExercises);
        } else {
            WebApp.HapticFeedback.notificationOccurred('error');
            alert('Пожалуйста, введите название тренировки.');
        }
    });

    backToTitleBtn.addEventListener('click', () => switchStep(stepExercises, stepTitle));
    saveTrainingBtn.addEventListener('click', saveTraining);

    // ----- Модалка просмотра/редактирования -----
    closeViewBtn.addEventListener('click', () => toggleModal(viewModal, false));
    deleteWorkoutBtn.addEventListener('click', deleteWorkout);
    
    editWorkoutBtn.addEventListener('click', () => {
        toggleViewEditMode(true);
        WebApp.HapticFeedback.impactOccurred('medium');
    });
    
    exitEditModeBtn.addEventListener('click', () => {
        toggleViewEditMode(false);
        WebApp.HapticFeedback.impactOccurred('light');
    });
    
    // Кнопки редактирования названия
    viewTitleEditBtn.addEventListener('click', () => toggleTitleEdit(true));
    viewTitleSaveBtn.addEventListener('click', saveTitleEdit);
    viewTitleCancelBtn.addEventListener('click', () => toggleTitleEdit(false));

    // Кнопки сохранения/отмены изменений в режиме редактирования (общая логика)
    saveViewChangesBtn.addEventListener('click', () => {
        // Здесь можно было бы реализовать логику сохранения для всех изменений сразу, 
        // но так как каждое упражнение сохраняется отдельно (saveViewExercise),
        // эта кнопка будет служить только для выхода из режима редактирования
        // и сохранения всех предыдущих изменений в упражнениях (что уже произошло).
        toggleViewEditMode(false);
        renderWorkouts(); // Обновляем счетчик упражнений на главной (если меняли)
        WebApp.HapticFeedback.notificationOccurred('success');
    });

    cancelViewEditBtn.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите отменить все несохраненные изменения?')) {
             // Просто перерендерим, чтобы сбросить любые изменения в UI
             const workout = getWorkoutById(editingWorkoutId);
             if (workout) renderViewBody(workout);
             toggleViewEditMode(false);
             WebApp.HapticFeedback.notificationOccurred('warning');
        }
    });
    
    addExerciseToViewBtn.addEventListener('click', () => {
        viewBody.querySelectorAll('.view-ex').forEach(el => el.classList.remove('is-editing')); // Сброс форм редактирования
        const newForm = viewBody.querySelector('.view-ex.is-editing-new');
        if (newForm) {
            newForm.style.display = 'block';
            newForm.classList.add('is-editing');
            
            // Очистка полей формы для нового упражнения
            document.getElementById('viewExName_new').value = '';
            document.getElementById('viewExDesc_new').value = '';
            document.getElementById('viewExReps_new').value = '';
            document.getElementById('viewExMin_new').value = '';
            document.getElementById('viewExSec_new').value = '';
        }
        WebApp.HapticFeedback.impactOccurred('medium');
    });
    
    // ----- Модалка профиля -----
    profileBtn.addEventListener('click', () => {
        updateProfileStats();
        toggleModal(profileModal, true);
    });

    closeProfileBtn.addEventListener('click', () => toggleModal(profileModal, false));
    saveProfileBtn.addEventListener('click', saveProfileSettings);

    // =======================================================================
    // ИНИЦИАЛИЗАЦИЯ
    // =======================================================================
    
    renderWorkouts();
    updateProfileStats();
});