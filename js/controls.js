/**
 * Controls - Faculty panel, filters, options, and edit modal
 */

import {
    state,
    toggleFacultyVisibility,
    setAllFacultyVisibility,
    updateSettings,
    updateFacultyColor,
    saveFacultyColors,
    updateCourse,
    addCourse,
    selectCourse,
    renderCurrentSemester,
    getCurrentFacultyList
} from './app.js';
import { formatTime, formatTime24, parseTime, parseDays } from './fileHandler.js';
import { getAvailableStartTimes, getAvailableLengths } from './scheduler.js';

// DOM elements
let facultyListEl;
let showAllCheckbox;
let tbaOverlapCheckbox;
let filterCheckbox, filterInput;
let decFontBtn, incFontBtn;
let courseNameEl, detailFaculty, detailDays, detailStart, detailLength, detailFte, detailRoom;
let editCourseBtn, addCourseBtn;
let noteTextEl;

// Modal elements
let editModal, modalTitle, modalClose, modalSave, modalCancel, editNote;
let editCourseNum, editCourseName, editFaculty, editNewFaculty, editDays, editStart, editLength, editFte, editRoom;
let editCurrentNum, editCurrentName, editCurrentFaculty, editCurrentDays, editCurrentStart, editCurrentLength, editCurrentFte, editCurrentRoom;

// FTE labels storage
const fteLabelElements = {};

// Current editing course
let editingCourse = null;
let isAddingNew = false;

/**
 * Initialize controls
 */
export function initControls() {
    // Cache DOM elements
    facultyListEl = document.getElementById('faculty-list');
    showAllCheckbox = document.getElementById('show-all-checkbox');
    tbaOverlapCheckbox = document.getElementById('tba-overlap-checkbox');
    filterCheckbox = document.getElementById('filter-checkbox');
    filterInput = document.getElementById('filter-input');
    decFontBtn = document.getElementById('dec-font-btn');
    incFontBtn = document.getElementById('inc-font-btn');

    courseNameEl = document.getElementById('course-name');
    detailFaculty = document.getElementById('detail-faculty');
    detailDays = document.getElementById('detail-days');
    detailStart = document.getElementById('detail-start');
    detailLength = document.getElementById('detail-length');
    detailFte = document.getElementById('detail-fte');
    detailRoom = document.getElementById('detail-room');

    editCourseBtn = document.getElementById('edit-course-btn');
    addCourseBtn = document.getElementById('add-course-btn');
    noteTextEl = document.getElementById('note-text');

    // Modal elements
    editModal = document.getElementById('edit-modal');
    modalTitle = document.getElementById('modal-title');
    modalClose = document.getElementById('modal-close');
    modalSave = document.getElementById('modal-save');
    modalCancel = document.getElementById('modal-cancel');
    editNote = document.getElementById('edit-note');

    editCourseNum = document.getElementById('edit-course-num');
    editCourseName = document.getElementById('edit-course-name');
    editFaculty = document.getElementById('edit-faculty');
    editNewFaculty = document.getElementById('edit-new-faculty');
    editDays = document.getElementById('edit-days');
    editStart = document.getElementById('edit-start');
    editLength = document.getElementById('edit-length');
    editFte = document.getElementById('edit-fte');
    editRoom = document.getElementById('edit-room');

    editCurrentNum = document.getElementById('edit-current-num');
    editCurrentName = document.getElementById('edit-current-name');
    editCurrentFaculty = document.getElementById('edit-current-faculty');
    editCurrentDays = document.getElementById('edit-current-days');
    editCurrentStart = document.getElementById('edit-current-start');
    editCurrentLength = document.getElementById('edit-current-length');
    editCurrentFte = document.getElementById('edit-current-fte');
    editCurrentRoom = document.getElementById('edit-current-room');

    // Populate time and length dropdowns
    populateTimeDropdown();
    populateLengthDropdown();

    // Set up event listeners
    setupControlListeners();
}

/**
 * Populate the start time dropdown
 */
function populateTimeDropdown() {
    const times = getAvailableStartTimes();
    editStart.innerHTML = '<option value="">Select time...</option>';
    for (const time of times) {
        const option = document.createElement('option');
        option.value = time.value;
        option.textContent = time.display;
        editStart.appendChild(option);
    }
}

/**
 * Populate the length dropdown
 */
function populateLengthDropdown() {
    const lengths = getAvailableLengths();
    editLength.innerHTML = '<option value="">Select length...</option>';
    for (const len of lengths) {
        const option = document.createElement('option');
        option.value = len.value;
        option.textContent = len.display;
        editLength.appendChild(option);
    }
}

/**
 * Set up event listeners for controls
 */
function setupControlListeners() {
    // Show/hide all
    showAllCheckbox.addEventListener('change', () => {
        setAllFacultyVisibility(showAllCheckbox.checked);
        updateAllFacultyCheckboxes(showAllCheckbox.checked);
    });

    // TBA overlap checking
    tbaOverlapCheckbox.addEventListener('change', () => {
        updateSettings('checkTBAOverlap', tbaOverlapCheckbox.checked);
    });

    // Course filter
    filterCheckbox.addEventListener('change', () => {
        updateSettings('filterActive', filterCheckbox.checked);
        updateSettings('courseFilter', filterInput.value);
    });

    filterInput.addEventListener('input', () => {
        if (filterCheckbox.checked) {
            updateSettings('courseFilter', filterInput.value);
        }
    });

    filterInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            filterCheckbox.checked = true;
            updateSettings('filterActive', true);
            updateSettings('courseFilter', filterInput.value);
        }
    });

    // Font size buttons
    decFontBtn.addEventListener('click', () => {
        const newSize = Math.max(8, state.settings.courseFontSize - 1);
        updateSettings('courseFontSize', newSize);
    });

    incFontBtn.addEventListener('click', () => {
        const newSize = Math.min(16, state.settings.courseFontSize + 1);
        updateSettings('courseFontSize', newSize);
    });

    // Edit/Add course buttons
    editCourseBtn.addEventListener('click', () => openEditModal(false));
    addCourseBtn.addEventListener('click', () => openEditModal(true));

    // Modal buttons
    modalClose.addEventListener('click', closeEditModal);
    modalCancel.addEventListener('click', closeEditModal);
    modalSave.addEventListener('click', saveEditModal);

    // Close modal on overlay click
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !editModal.hidden) {
            closeEditModal();
        }
    });

    // Faculty dropdown - show text input when "Add new" is selected
    editFaculty.addEventListener('change', () => {
        if (editFaculty.value === '__new__') {
            editFaculty.hidden = true;
            editNewFaculty.hidden = false;
            editNewFaculty.value = '';
            editNewFaculty.focus();
        }
    });

    // New faculty input - on blur or Enter, process the new name
    editNewFaculty.addEventListener('blur', handleNewFacultyInput);
    editNewFaculty.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNewFacultyInput();
        } else if (e.key === 'Escape') {
            // Cancel - go back to dropdown
            editNewFaculty.hidden = true;
            editFaculty.hidden = false;
            editFaculty.value = '';
        }
    });

    // Days validation
    editDays.addEventListener('input', validateDays);
}

/**
 * Update faculty list display
 */
export function updateFacultyList(facultyList) {
    facultyListEl.innerHTML = '';

    for (const faculty of facultyList) {
        const row = createFacultyRow(faculty);
        facultyListEl.appendChild(row);
    }
}

/**
 * Create a faculty row element
 */
function createFacultyRow(faculty) {
    const row = document.createElement('div');
    row.className = 'faculty-row';

    // Color label
    const colorEl = document.createElement('div');
    colorEl.className = 'faculty-color';
    colorEl.textContent = faculty;

    const colorInfo = state.facultyColors[faculty];
    if (colorInfo) {
        colorEl.style.backgroundColor = colorInfo.bg;
        colorEl.style.color = colorInfo.text;
    }

    // Double-click to change color
    colorEl.addEventListener('dblclick', () => openColorPicker(faculty, colorEl));

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'faculty-checkbox';
    checkbox.checked = state.facultyVisible[faculty] !== false;
    checkbox.addEventListener('change', () => {
        toggleFacultyVisibility(faculty, checkbox.checked);
    });

    // FTE label
    const fteEl = document.createElement('span');
    fteEl.className = 'faculty-fte';
    fteEl.textContent = '-';
    fteLabelElements[faculty] = fteEl;

    row.appendChild(colorEl);
    row.appendChild(checkbox);
    row.appendChild(fteEl);

    return row;
}

/**
 * Update all faculty checkboxes
 */
function updateAllFacultyCheckboxes(checked) {
    const checkboxes = facultyListEl.querySelectorAll('.faculty-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
}

/**
 * Open color picker for faculty
 */
function openColorPicker(faculty, element) {
    // Create a hidden color input
    const input = document.createElement('input');
    input.type = 'color';
    input.value = state.facultyColors[faculty]?.bg || '#666666';

    input.addEventListener('change', () => {
        const newColor = input.value;
        // Calculate text color based on background brightness
        const textColor = getContrastColor(newColor);

        updateFacultyColor(faculty, newColor, textColor);
        element.style.backgroundColor = newColor;
        element.style.color = textColor;
    });

    input.click();
}

/**
 * Calculate contrasting text color (black or white)
 * Uses the YIQ luminance formula for perceived brightness
 */
function getContrastColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // YIQ luminance formula - well-established for perceived brightness
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Update FTE display for all faculty
 */
export function updateFTEDisplay(fteData) {
    for (const [faculty, fte] of Object.entries(fteData)) {
        if (fteLabelElements[faculty]) {
            fteLabelElements[faculty].textContent = fte.toFixed(2);
        }
    }

    // Clear any faculty not in data
    for (const faculty of Object.keys(fteLabelElements)) {
        if (!(faculty in fteData)) {
            fteLabelElements[faculty].textContent = '-';
        }
    }
}

/**
 * Update course info panel
 */
export function updateCourseInfo(course) {
    if (!course) {
        courseNameEl.textContent = 'No course selected';
        detailFaculty.textContent = '-';
        detailDays.textContent = '-';
        detailStart.textContent = '-';
        detailLength.textContent = '-';
        detailFte.textContent = '-';
        detailRoom.textContent = '-';
        editCourseBtn.disabled = true;
        // Don't clear note here - overlap warnings are shown persistently
        return;
    }

    courseNameEl.textContent = `${course.courseNum}\n${course.courseName}`;
    detailFaculty.textContent = course.faculty;
    detailDays.textContent = course.days.toUpperCase();
    detailStart.textContent = formatTime(course.startTime);
    detailLength.textContent = formatDuration(course.length);
    detailFte.textContent = course.fte;
    detailRoom.textContent = course.room || '-';

    editCourseBtn.disabled = false;
    // Note: Overlap warnings are now shown persistently by renderCurrentSemester
}

/**
 * Format duration in minutes to HH:MM
 */
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Show a note/warning message
 */
export function showNote(text) {
    noteTextEl.textContent = text;
}

/**
 * Open the edit/add course modal
 */
function openEditModal(isNew) {
    isAddingNew = isNew;

    if (isNew) {
        modalTitle.textContent = 'Add Course';
        editingCourse = null;

        // Clear current values
        editCurrentNum.textContent = '';
        editCurrentName.textContent = '';
        editCurrentFaculty.textContent = '';
        editCurrentDays.textContent = '';
        editCurrentStart.textContent = '';
        editCurrentLength.textContent = '';
        editCurrentFte.textContent = '';
        editCurrentRoom.textContent = '';

        // Clear inputs
        editCourseNum.value = '';
        editCourseName.value = '';
        editFaculty.value = '';
        editDays.value = '';
        editStart.value = '';
        editLength.value = '';
        editFte.value = '1';
        editRoom.value = '';

    } else {
        if (!state.selectedCourse) {
            showNote('Select a course to edit it.');
            return;
        }

        modalTitle.textContent = 'Edit Course';
        editingCourse = state.selectedCourse;

        // Show current values
        editCurrentNum.textContent = editingCourse.courseNum;
        editCurrentName.textContent = editingCourse.courseName;
        editCurrentFaculty.textContent = editingCourse.faculty;
        editCurrentDays.textContent = editingCourse.days.toUpperCase();
        editCurrentStart.textContent = formatTime(editingCourse.startTime);
        editCurrentLength.textContent = formatDuration(editingCourse.length);
        editCurrentFte.textContent = editingCourse.fte;
        editCurrentRoom.textContent = editingCourse.room || '-';

        // Pre-fill inputs with current values
        editCourseNum.value = editingCourse.courseNum;
        editCourseName.value = editingCourse.courseName;
        editDays.value = editingCourse.days.toUpperCase();
        editStart.value = formatTime24(editingCourse.startTime);
        editLength.value = editingCourse.length;
        editFte.value = editingCourse.fte;
        editRoom.value = editingCourse.room || '';
    }

    // Populate faculty dropdown
    populateFacultyDropdown();

    // If editing, select current faculty
    if (!isNew && editingCourse) {
        editFaculty.value = editingCourse.faculty;
    }

    // Reset new faculty input state
    editNewFaculty.hidden = true;
    editNewFaculty.value = '';
    editFaculty.hidden = false;

    editNote.textContent = '';
    editModal.hidden = false;
}

/**
 * Handle new faculty name input
 */
function handleNewFacultyInput() {
    const newName = editNewFaculty.value.trim();

    if (!newName) {
        // Empty - go back to dropdown
        editNewFaculty.hidden = true;
        editFaculty.hidden = false;
        editFaculty.value = '';
        return;
    }

    // Extract last name for display (same logic as createCourse)
    let displayName = newName;
    if (newName.includes(',')) {
        displayName = newName.split(',')[0].trim();
    } else if (newName.includes(' ')) {
        const parts = newName.split(' ');
        displayName = parts[parts.length - 1].trim();
    }

    // Add new option to dropdown
    const newOption = document.createElement('option');
    newOption.value = displayName;
    newOption.textContent = displayName;
    // Insert before the "__new__" option
    const addNewOption = editFaculty.querySelector('option[value="__new__"]');
    editFaculty.insertBefore(newOption, addNewOption);

    // Switch back to dropdown with new faculty selected
    editNewFaculty.hidden = true;
    editFaculty.hidden = false;
    editFaculty.value = displayName;
}

/**
 * Populate faculty dropdown with current faculty list
 */
function populateFacultyDropdown() {
    const facultyList = getCurrentFacultyList();

    editFaculty.innerHTML = '<option value="">Select faculty...</option>';
    for (const faculty of facultyList) {
        const option = document.createElement('option');
        option.value = faculty;
        option.textContent = faculty;
        editFaculty.appendChild(option);
    }

    // Add option to enter new faculty
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ Add new faculty...';
    editFaculty.appendChild(newOption);
}

/**
 * Close the edit modal
 */
function closeEditModal() {
    editModal.hidden = true;
    editingCourse = null;
    isAddingNew = false;
}

/**
 * Save changes from the edit modal
 */
function saveEditModal() {
    // Validate days
    const daysValue = editDays.value.trim().toLowerCase();
    if (daysValue && !validateDaysValue(daysValue)) {
        editNote.textContent = 'Days must be MTWRF with no repeats (5 or fewer days).';
        return;
    }

    // Get faculty value (new faculty is handled by the text input which updates the dropdown)
    let facultyValue = editFaculty.value;
    if (facultyValue === '__new__') {
        // User selected "Add new" but didn't enter a name
        editNote.textContent = 'Please enter a faculty name or select an existing one.';
        return;
    }

    if (isAddingNew) {
        // Validate required fields for new course
        if (!editCourseNum.value.trim()) {
            editNote.textContent = 'Course number is required.';
            return;
        }
        if (!facultyValue) {
            editNote.textContent = 'Please select a faculty member.';
            return;
        }
        if (!daysValue) {
            editNote.textContent = 'Days are required.';
            return;
        }
        if (!editStart.value) {
            editNote.textContent = 'Start time is required.';
            return;
        }
        if (!editLength.value) {
            editNote.textContent = 'Length is required.';
            return;
        }

        // Parse start time
        const startTime = parseTime(editStart.value);
        if (!startTime) {
            editNote.textContent = 'Invalid start time.';
            return;
        }

        // Calculate end time
        const lengthMinutes = parseInt(editLength.value, 10);
        const endTime = new Date(startTime.getTime() + lengthMinutes * 60 * 1000);

        // Create new course
        addCourse({
            courseNum: editCourseNum.value.trim(),
            courseName: editCourseName.value.trim(),
            faculty: facultyValue,
            days: daysValue,
            startTime: formatTime24(startTime),
            endTime: formatTime24(endTime),
            fte: editFte.value || '1',
            room: editRoom.value.trim()
        });

    } else {
        // Update existing course
        const updates = {};

        if (editCourseNum.value.trim() && editCourseNum.value.trim() !== editingCourse.courseNum) {
            updates.courseNum = editCourseNum.value.trim();
        }

        if (editCourseName.value.trim() && editCourseName.value.trim() !== editingCourse.courseName) {
            updates.courseName = editCourseName.value.trim();
        }

        if (facultyValue && facultyValue !== editingCourse.faculty) {
            updates.faculty = facultyValue;
            updates.facultyFull = facultyValue;
        }

        if (daysValue && daysValue !== editingCourse.days) {
            updates.days = daysValue;
        }

        if (editStart.value) {
            const startTime = parseTime(editStart.value);
            if (startTime) {
                updates.startTime = startTime;
            }
        }

        if (editLength.value) {
            const lengthMinutes = parseInt(editLength.value, 10);
            if (lengthMinutes && updates.startTime) {
                updates.endTime = new Date(updates.startTime.getTime() + lengthMinutes * 60 * 1000);
                updates.length = lengthMinutes;
            } else if (lengthMinutes && editingCourse.startTime) {
                updates.endTime = new Date(editingCourse.startTime.getTime() + lengthMinutes * 60 * 1000);
                updates.length = lengthMinutes;
            }
        }

        if (editFte.value && parseFloat(editFte.value) !== editingCourse.fte) {
            updates.fte = parseFloat(editFte.value);
        }

        if (editRoom.value.trim() !== (editingCourse.room || '')) {
            updates.room = editRoom.value.trim();
        }

        if (Object.keys(updates).length > 0) {
            updateCourse(editingCourse, updates);
        }
    }

    closeEditModal();
}

/**
 * Validate days input
 */
function validateDays() {
    const value = editDays.value.trim().toLowerCase();
    if (!value) {
        editNote.textContent = '';
        return;
    }

    if (!validateDaysValue(value)) {
        editNote.textContent = 'Days must be MTWRF with no repeats.';
    } else {
        editNote.textContent = '';
    }
}

/**
 * Validate days value
 */
function validateDaysValue(value) {
    const validChars = new Set('mtwrf');
    const chars = value.split('');

    // Check all characters are valid
    if (!chars.every(c => validChars.has(c))) {
        return false;
    }

    // Check no duplicates
    if (new Set(chars).size !== chars.length) {
        return false;
    }

    // Check length
    if (chars.length > 5) {
        return false;
    }

    return true;
}
