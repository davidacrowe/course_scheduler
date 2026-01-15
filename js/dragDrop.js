/**
 * Drag and Drop - Handle course block dragging and dropping
 */

import { state, getCurrentCourses, renderCurrentSemester, selectCourse } from './app.js';
import { canMoveCourse, updateCourseTime } from './scheduler.js';
import { showNote } from './controls.js';
import { getTimeFrames, parseTimeLabel } from './grid.js';

// Drag state
let draggedCourse = null;
let draggedElement = null;
let currentDropTarget = null;

/**
 * Initialize drag and drop functionality
 */
export function initDragDrop() {
    const scheduleGrid = document.getElementById('schedule-grid');

    // Set up drag event listeners on the schedule grid
    scheduleGrid.addEventListener('dragstart', handleDragStart);
    scheduleGrid.addEventListener('dragend', handleDragEnd);
    scheduleGrid.addEventListener('dragover', handleDragOver);
    scheduleGrid.addEventListener('dragleave', handleDragLeave);
    scheduleGrid.addEventListener('drop', handleDrop);
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
    const courseBlock = e.target.closest('.course-block');
    if (!courseBlock) return;

    const courseId = courseBlock.dataset.courseId;
    const courses = getCurrentCourses();
    draggedCourse = courses.find(c => c.id === courseId);

    if (!draggedCourse) return;

    // Check if course can be dragged (non-standard days can't be dragged)
    const days = draggedCourse.days;
    if (days !== 'mwf' && days !== 'tr' && days.length > 1) {
        e.preventDefault();
        showNote('Course has unusual days. Change day/time manually.');
        return;
    }

    draggedElement = courseBlock;
    courseBlock.classList.add('dragging');

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', courseId);

    // Create drag image (optional - use default for now)
    // e.dataTransfer.setDragImage(courseBlock, 10, 10);

    // Select the course being dragged
    selectCourse(draggedCourse);
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }

    // Remove all drop target highlights
    document.querySelectorAll('.time-frame.drop-target').forEach(el => {
        el.classList.remove('drop-target');
    });

    draggedCourse = null;
    draggedElement = null;
    currentDropTarget = null;
}

/**
 * Handle drag over (for drop zones)
 */
function handleDragOver(e) {
    if (!draggedCourse) return;

    const timeFrame = e.target.closest('.time-frame');
    if (!timeFrame) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Highlight valid drop target
    if (timeFrame !== currentDropTarget) {
        // Remove previous highlight
        if (currentDropTarget) {
            currentDropTarget.classList.remove('drop-target');
        }

        // Check if this is a valid drop target
        const targetDay = timeFrame.dataset.day;
        if (canMoveCourse(draggedCourse, timeFrame.dataset.time, targetDay)) {
            timeFrame.classList.add('drop-target');
            currentDropTarget = timeFrame;
        }
    }
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
    const timeFrame = e.target.closest('.time-frame');
    if (timeFrame && timeFrame === currentDropTarget) {
        // Check if we're leaving to a child element
        const relatedTarget = e.relatedTarget;
        if (!timeFrame.contains(relatedTarget)) {
            timeFrame.classList.remove('drop-target');
            currentDropTarget = null;
        }
    }
}

/**
 * Handle drop
 */
function handleDrop(e) {
    e.preventDefault();

    if (!draggedCourse) return;

    const timeFrame = e.target.closest('.time-frame');
    if (!timeFrame) return;

    const targetDay = timeFrame.dataset.day;
    const targetTime = timeFrame.dataset.time;

    // Validate the move
    if (!canMoveToTarget(draggedCourse, targetDay, targetTime)) {
        return;
    }

    // Parse target time
    const targetMinutes = parseTimeLabel(targetTime);
    const hours = Math.floor(targetMinutes / 60);
    const minutes = targetMinutes % 60;
    const newTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Update course time
    updateCourseTime(draggedCourse, newTimeStr);

    // If single-day course, update the day too
    if (draggedCourse.days.length === 1) {
        draggedCourse.days = targetDay;
    }

    // Re-render
    renderCurrentSemester();
    selectCourse(draggedCourse);

    showNote('');
}

/**
 * Check if course can be moved to target
 */
function canMoveToTarget(course, targetDay, targetTime) {
    const days = course.days;

    // Single-day courses can move anywhere
    if (days.length === 1) {
        return true;
    }

    // MWF courses must stay within MWF
    if (days === 'mwf') {
        if (!'mwf'.includes(targetDay)) {
            showNote("Can't switch MWF and TR courses. Change day/time manually.");
            return false;
        }
        return true;
    }

    // TR courses must stay within TR
    if (days === 'tr') {
        if (!'tr'.includes(targetDay)) {
            showNote("Can't switch MWF and TR courses. Change day/time manually.");
            return false;
        }
        return true;
    }

    // Non-standard day combinations
    showNote('Course has unusual days. Change day/time manually.');
    return false;
}

/**
 * Make a newly created course block draggable
 * This is called by the grid when creating course blocks
 */
export function makeDraggable(element) {
    element.draggable = true;
}
