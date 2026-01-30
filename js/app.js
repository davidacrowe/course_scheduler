/**
 * Course Scheduler - Main Application Entry Point
 * Handles state management, initialization, and coordination between modules
 */

import { parseFile, detectSemesters } from './fileHandler.js';
import { createCourse, checkAllOverlaps, calculateFacultyFTE } from './scheduler.js';
import { initGrid, renderSchedule, setCourseFontSize } from './grid.js';
import { initControls, updateFacultyList, updateCourseInfo, showNote, updateFTEDisplay } from './controls.js';
import { initDragDrop } from './dragDrop.js';
import { exportToExcel } from './exporter.js';

// Application State
export const state = {
    semesters: {},           // { fall: { courses: [], faculty: [] }, spring: { ... } }
    activeSemester: null,
    facultyColors: {},       // { 'lastName': { bg: '#abc', text: '#fff', index: 0 } }
    facultyVisible: {},      // { 'lastName': true }
    settings: {
        checkTBAOverlap: true,
        courseFilter: '',
        filterActive: false,
        courseFontSize: 13
    },
    selectedCourse: null,
    fileLoaded: false,
    formatInfo: null         // Original file format info for saving back in same format
};

// Default color palette (muted/pastel colors)
const DEFAULT_COLORS = [
    { bg: '#587d9e', text: '#ffffff' },
    { bg: '#ff7571', text: '#ffffff' },
    { bg: '#eeecb9', text: '#000000' },
    { bg: '#5eb4e0', text: '#000000' },
    { bg: '#629c8d', text: '#ffffff' },
    { bg: '#9098e0', text: '#ffffff' },
    { bg: '#e0c18b', text: '#000000' },
    { bg: '#8ac09e', text: '#ffffff' },
    { bg: '#8a9eb7', text: '#ffffff' },
    { bg: '#9fe0e4', text: '#000000' },
    { bg: '#e0a4c9', text: '#000000' },
    { bg: '#87dea5', text: '#000000' },
    { bg: '#e0b694', text: '#ffffff' },
    { bg: '#81e079', text: '#ffffff' },
    { bg: '#a8dbe3', text: '#ffffff' },
    // Additional muted/pastel colors
    { bg: '#c4a4d4', text: '#000000' },  // Soft purple
    { bg: '#d4a4a4', text: '#000000' },  // Dusty rose
    { bg: '#a4c4d4', text: '#000000' },  // Soft steel blue
    { bg: '#d4d4a4', text: '#000000' },  // Soft olive
    { bg: '#b4d4c4', text: '#000000' },  // Sage green
    { bg: '#d4b4a4', text: '#000000' },  // Warm taupe
    { bg: '#a4b4d4', text: '#000000' },  // Periwinkle
    { bg: '#c4d4a4', text: '#000000' },  // Soft lime
    { bg: '#d4a4b4', text: '#000000' },  // Mauve
    { bg: '#a4d4d4', text: '#000000' },  // Soft teal
    { bg: '#c9b8d4', text: '#000000' },  // Lavender gray
    { bg: '#d4c9b8', text: '#000000' },  // Warm beige
    { bg: '#b8d4c9', text: '#000000' },  // Mint
    { bg: '#d4b8c9', text: '#000000' },  // Blush
    { bg: '#b8c9d4', text: '#000000' }   // Powder blue
];

// DOM Elements
let uploadBtn, fileInput, uploadPrompt, uploadDropzone;
let semesterTabs, scheduleGrid;
let saveBtn, editCourseBtn, addCourseBtn;

/**
 * Initialize the application
 */
export function init() {
    // Cache DOM elements
    uploadBtn = document.getElementById('upload-btn');
    fileInput = document.getElementById('file-input');
    uploadPrompt = document.getElementById('upload-prompt');
    uploadDropzone = document.getElementById('upload-dropzone');
    semesterTabs = document.getElementById('semester-tabs');
    scheduleGrid = document.getElementById('schedule-grid');
    saveBtn = document.getElementById('save-btn');
    editCourseBtn = document.getElementById('edit-course-btn');
    addCourseBtn = document.getElementById('add-course-btn');

    // Initialize modules
    initGrid();
    initControls();
    initDragDrop();

    // Load saved colors from localStorage
    loadSavedColors();

    // Set up event listeners
    setupEventListeners();

    console.log('Course Scheduler initialized');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // File upload button
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop on dropzone
    uploadDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('drag-over');
    });

    uploadDropzone.addEventListener('dragleave', () => {
        uploadDropzone.classList.remove('drag-over');
    });

    uploadDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Save button
    saveBtn.addEventListener('click', () => {
        exportToExcel(state.semesters, state.formatInfo);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to deselect course
        if (e.key === 'Escape') {
            selectCourse(null);
        }
    });
}

/**
 * Handle file selection from input
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

/**
 * Handle file loading
 */
async function handleFile(file) {
    try {
        showNote('Loading file...');

        const data = await parseFile(file);
        const { semesters, formatInfo } = detectSemesters(data, file.name);

        // Store format info for saving back in original format
        state.formatInfo = formatInfo;

        // Process each semester
        state.semesters = {};
        const allFaculty = new Set();

        for (const [semesterName, rows] of Object.entries(semesters)) {
            const courses = [];

            for (const row of rows) {
                const course = createCourse(row);
                if (course) {
                    courses.push(course);
                    allFaculty.add(course.faculty);
                }
            }

            state.semesters[semesterName] = {
                courses,
                faculty: []
            };
        }

        // Build faculty list from all semesters
        const facultyList = Array.from(allFaculty).sort();

        // Assign colors to faculty
        assignFacultyColors(facultyList);

        // Set faculty list for each semester
        for (const semesterName of Object.keys(state.semesters)) {
            state.semesters[semesterName].faculty = facultyList;
        }

        // Initialize visibility (all visible by default)
        for (const faculty of facultyList) {
            if (!(faculty in state.facultyVisible)) {
                state.facultyVisible[faculty] = true;
            }
        }

        // Activate first semester
        const semesterNames = Object.keys(state.semesters);
        if (semesterNames.length > 0) {
            state.activeSemester = semesterNames[0];
        }

        // Update UI
        state.fileLoaded = true;
        uploadPrompt.classList.add('hidden');
        renderSemesterTabs();
        updateFacultyList(facultyList);
        renderCurrentSemester();

        // Enable buttons
        saveBtn.disabled = false;
        editCourseBtn.disabled = false;
        addCourseBtn.disabled = false;

        // Update document title
        document.title = `Course Scheduler - ${file.name}`;

        // Note: Don't call showNote('') here - updateOverlapWarnings() in
        // renderCurrentSemester() already handles showing warnings or clearing the note

    } catch (error) {
        console.error('Error loading file:', error);
        showNote(`Error loading file: ${error.message}`);
    }
}

/**
 * Calculate contrasting text color (black or white) for a background
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
 * Assign colors to faculty members
 */
function assignFacultyColors(facultyList) {
    const savedColors = loadSavedColors();

    // Find the next available color index by checking existing assignments
    let nextColorIndex = 0;
    for (const colorInfo of Object.values(state.facultyColors)) {
        if (colorInfo.index !== undefined && colorInfo.index >= nextColorIndex) {
            nextColorIndex = colorInfo.index + 1;
        }
    }

    for (const faculty of facultyList) {
        if (savedColors[faculty]) {
            // Use saved color
            state.facultyColors[faculty] = savedColors[faculty];
        } else if (!state.facultyColors[faculty]) {
            // Assign new color, calculating text color automatically
            const color = DEFAULT_COLORS[nextColorIndex % DEFAULT_COLORS.length];
            state.facultyColors[faculty] = {
                bg: color.bg,
                text: getContrastColor(color.bg),
                index: nextColorIndex % DEFAULT_COLORS.length
            };
            nextColorIndex++;
        }
    }

    // Save to localStorage
    saveFacultyColors();
}

/**
 * Load saved colors from localStorage
 */
function loadSavedColors() {
    try {
        const saved = localStorage.getItem('schedulerFacultyColors');
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        return {};
    }
}

/**
 * Save faculty colors to localStorage
 */
export function saveFacultyColors() {
    try {
        localStorage.setItem('schedulerFacultyColors', JSON.stringify(state.facultyColors));
    } catch (e) {
        console.warn('Could not save colors to localStorage');
    }
}

/**
 * Update a faculty member's color
 */
export function updateFacultyColor(faculty, bg, text) {
    state.facultyColors[faculty] = { bg, text, index: state.facultyColors[faculty]?.index || 0 };
    saveFacultyColors();
    renderCurrentSemester();
    updateFacultyList(getCurrentFacultyList());
}

/**
 * Render semester tabs
 */
function renderSemesterTabs() {
    semesterTabs.innerHTML = '';

    for (const semesterName of Object.keys(state.semesters)) {
        const tab = document.createElement('button');
        tab.className = 'semester-tab';
        tab.textContent = capitalizeFirst(semesterName);
        tab.dataset.semester = semesterName;

        if (semesterName === state.activeSemester) {
            tab.classList.add('active');
        }

        tab.addEventListener('click', () => switchSemester(semesterName));
        semesterTabs.appendChild(tab);
    }
}

/**
 * Switch to a different semester
 */
export function switchSemester(semesterName) {
    if (state.semesters[semesterName]) {
        state.activeSemester = semesterName;
        state.selectedCourse = null;

        // Update tab styling
        document.querySelectorAll('.semester-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.semester === semesterName);
        });

        renderCurrentSemester();
        updateCourseInfo(null);
    }
}

/**
 * Render the current semester's schedule
 */
export function renderCurrentSemester() {
    if (!state.activeSemester || !state.semesters[state.activeSemester]) {
        return;
    }

    const semester = state.semesters[state.activeSemester];

    // Check overlaps
    checkAllOverlaps(semester.courses, state.settings.checkTBAOverlap);

    // Render schedule
    renderSchedule(semester.courses, state.facultyColors, state.facultyVisible, state.settings);

    // Update FTE display
    const fteData = calculateFacultyFTE(semester.courses);
    updateFTEDisplay(fteData);

    // Show persistent overlap warnings
    updateOverlapWarnings(semester.courses);
}

/**
 * Update overlap warnings in the Note section
 */
function updateOverlapWarnings(courses) {
    const facultyOverlaps = courses.filter(c => c.hasOverlap);
    const roomOverlaps = courses.filter(c => c.hasRoomOverlap);

    const warnings = [];

    if (roomOverlaps.length > 0) {
        const rooms = [...new Set(roomOverlaps.map(c => c.room))];
        warnings.push(`Room conflicts: ${rooms.join(', ')}`);
    }

    if (facultyOverlaps.length > 0) {
        const faculty = [...new Set(facultyOverlaps.map(c => c.faculty))];
        warnings.push(`Faculty conflicts: ${faculty.join(', ')}`);
    }

    if (warnings.length > 0) {
        showNote(warnings.join(' | '));
    } else {
        showNote('');
    }
}

/**
 * Get current semester's faculty list
 */
export function getCurrentFacultyList() {
    if (state.activeSemester && state.semesters[state.activeSemester]) {
        return state.semesters[state.activeSemester].faculty;
    }
    return [];
}

/**
 * Get current semester's courses
 */
export function getCurrentCourses() {
    if (state.activeSemester && state.semesters[state.activeSemester]) {
        return state.semesters[state.activeSemester].courses;
    }
    return [];
}

/**
 * Select a course
 */
export function selectCourse(course) {
    // Deselect previous
    if (state.selectedCourse) {
        const prevElements = document.querySelectorAll(`[data-course-id="${state.selectedCourse.id}"]`);
        prevElements.forEach(el => el.classList.remove('selected'));
    }

    state.selectedCourse = course;

    // Select new
    if (course) {
        const elements = document.querySelectorAll(`[data-course-id="${course.id}"]`);
        elements.forEach(el => el.classList.add('selected'));
    }

    updateCourseInfo(course);
}

/**
 * Update a course's data
 */
export function updateCourse(course, updates) {
    Object.assign(course, updates);

    // Recalculate if time/days changed
    if (updates.startTime || updates.endTime || updates.days) {
        course.length = (course.endTime - course.startTime) / (1000 * 60);
    }

    // If faculty changed, ensure new faculty is in the list with color
    if (updates.faculty && state.activeSemester) {
        if (!state.semesters[state.activeSemester].faculty.includes(updates.faculty)) {
            state.semesters[state.activeSemester].faculty.push(updates.faculty);
            state.semesters[state.activeSemester].faculty.sort();
            assignFacultyColors([updates.faculty]);
            state.facultyVisible[updates.faculty] = true;
            updateFacultyList(state.semesters[state.activeSemester].faculty);
        }
    }

    renderCurrentSemester();
    selectCourse(course);
}

/**
 * Add a new course to the current semester
 */
export function addCourse(courseData) {
    const course = createCourse(courseData);
    if (course && state.activeSemester) {
        state.semesters[state.activeSemester].courses.push(course);

        // Add faculty if new
        if (!state.semesters[state.activeSemester].faculty.includes(course.faculty)) {
            state.semesters[state.activeSemester].faculty.push(course.faculty);
            state.semesters[state.activeSemester].faculty.sort();
            assignFacultyColors([course.faculty]);
            state.facultyVisible[course.faculty] = true;
            updateFacultyList(state.semesters[state.activeSemester].faculty);
        }

        renderCurrentSemester();
        selectCourse(course);
    }
}

/**
 * Toggle faculty visibility
 */
export function toggleFacultyVisibility(faculty, visible) {
    state.facultyVisible[faculty] = visible;
    renderCurrentSemester();
}

/**
 * Set all faculty visibility
 */
export function setAllFacultyVisibility(visible) {
    for (const faculty of Object.keys(state.facultyVisible)) {
        state.facultyVisible[faculty] = visible;
    }
    renderCurrentSemester();
}

/**
 * Update settings
 */
export function updateSettings(key, value) {
    state.settings[key] = value;

    if (key === 'courseFontSize') {
        setCourseFontSize(value);
    }

    renderCurrentSemester();
}

/**
 * Utility: Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
