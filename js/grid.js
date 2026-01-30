/**
 * Grid - Schedule grid rendering and time frame management
 */

import { selectCourse } from './app.js';
import { formatTime } from './fileHandler.js';

// Time frames for each day
const timeFrames = {
    m: [], // Monday
    t: [], // Tuesday
    w: [], // Wednesday
    r: [], // Thursday
    f: []  // Friday
};

// Current font size
let courseFontSize = 13;

// Time slots configuration based on WeeklyPlanner.pdf
// MWF and TR have different time block structures
// Labels use 24-hour format for correct parsing during drag/drop
// height is percentage of total column height (adjusted for usage patterns)
const TIME_SLOTS = {
    mwf: [
        { label: '08:30', startMinutes: 510, endMinutes: 580, height: 14.0 },  // 8:30-9:30
        { label: '09:40', startMinutes: 580, endMinutes: 650, height: 15.0 },  // 9:40-10:40 (popular)
        { label: '10:50', startMinutes: 650, endMinutes: 740, height: 16.0 },  // 10:50-11:50 (popular)
        { label: '12:20', startMinutes: 740, endMinutes: 790, height: 9.5 },   // 12:20-1:00 Community
        { label: '13:10', startMinutes: 790, endMinutes: 860, height: 16.0 },  // 1:10-2:10 (popular)
        { label: '14:20', startMinutes: 860, endMinutes: 930, height: 14.0 },  // 2:20-3:20
        { label: '15:30', startMinutes: 930, endMinutes: 1080, height: 10.0 }, // 3:30-4:30 (less common)
        { label: '18:00', startMinutes: 1080, endMinutes: 1320, height: 5.5 }  // 6:00-9:00 Evening
    ],
    tr: [
        { label: '08:30', startMinutes: 510, endMinutes: 610, height: 18.0 },  // 8:30-10:00
        { label: '10:10', startMinutes: 610, endMinutes: 740, height: 20.0 },  // 10:10-11:40 (popular)
        { label: '12:20', startMinutes: 740, endMinutes: 840, height: 20.0 },  // 12:20-1:50 (popular)
        { label: '14:00', startMinutes: 840, endMinutes: 940, height: 20.0 },  // 2:00-3:30 (popular)
        { label: '15:40', startMinutes: 940, endMinutes: 1080, height: 15.0 }, // 3:40-5:10 (less common)
        { label: '18:00', startMinutes: 1080, endMinutes: 1320, height: 7.0 }  // 6:00-9:00 Evening
    ]
};

// Day to column mapping
const DAY_COLUMNS = {
    m: 'col-mon',
    t: 'col-tue',
    w: 'col-wed',
    r: 'col-thu',
    f: 'col-fri'
};

// Homeless courses container
let homelessContainer;

/**
 * Initialize the grid
 */
export function initGrid() {
    createTimeFrames();
    homelessContainer = document.getElementById('homeless-list');
}

/**
 * Create time frame elements for each day
 */
function createTimeFrames() {
    const dayConfigs = {
        m: TIME_SLOTS.mwf,
        t: TIME_SLOTS.tr,
        w: TIME_SLOTS.mwf,
        r: TIME_SLOTS.tr,
        f: TIME_SLOTS.mwf
    };

    for (const [day, slots] of Object.entries(dayConfigs)) {
        const column = document.getElementById(DAY_COLUMNS[day]);
        column.innerHTML = '';
        timeFrames[day] = [];

        for (const slot of slots) {
            const frame = document.createElement('div');
            frame.className = 'time-frame';
            frame.dataset.day = day;
            frame.dataset.time = slot.label;  // Keep 24-hour format for parsing
            frame.dataset.startMinutes = slot.startMinutes;
            frame.dataset.endMinutes = slot.endMinutes;
            frame.style.height = `${slot.height}%`;  // Fixed percentage height

            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = formatTimeLabel(slot.label);  // Display in 12-hour format
            frame.appendChild(label);

            // Container for course blocks (allows scrolling if overflow)
            const coursesContainer = document.createElement('div');
            coursesContainer.className = 'courses-container';
            frame.appendChild(coursesContainer);

            column.appendChild(frame);
            timeFrames[day].push({
                element: frame,
                coursesContainer: coursesContainer,  // Store reference for adding courses
                label: slot.label,
                startMinutes: slot.startMinutes,
                endMinutes: slot.endMinutes
            });
        }
    }
}

/**
 * Render the schedule with courses
 */
export function renderSchedule(courses, facultyColors, facultyVisible, settings) {
    // Clear existing course blocks
    document.querySelectorAll('.course-block').forEach(el => el.remove());

    // Clear homeless courses
    const homelessSection = document.getElementById('homeless-courses');
    homelessContainer.innerHTML = '';
    let hasHomeless = false;

    // Place each course
    for (const course of courses) {
        // Check visibility
        const isVisible = facultyVisible[course.faculty] !== false;
        const matchesFilter = !settings.filterActive ||
            course.courseNum.toLowerCase().includes(settings.courseFilter.toLowerCase());

        if (!isVisible || !matchesFilter) {
            continue;
        }

        // Find appropriate time frames for each day
        const days = course.days.split('');
        let placedInFrame = false;

        for (const day of days) {
            const frame = findTimeFrame(day, course.startTime);

            if (frame) {
                const block = createCourseBlock(course, facultyColors[course.faculty], day);
                frame.coursesContainer.appendChild(block);
                placedInFrame = true;
            }
        }

        // If course doesn't fit any frame, add to homeless
        if (!placedInFrame) {
            hasHomeless = true;
            const block = createCourseBlock(course, facultyColors[course.faculty], course.days[0]);
            block.classList.add('homeless');
            homelessContainer.appendChild(block);
        }
    }

    // Show/hide homeless section
    homelessSection.hidden = !hasHomeless;
}

/**
 * Find the appropriate time frame for a day and time
 */
function findTimeFrame(day, startTime) {
    const frames = timeFrames[day];
    if (!frames || frames.length === 0) return null;

    const courseMinutes = startTime.getHours() * 60 + startTime.getMinutes();

    // Find frame that contains this time
    for (const frame of frames) {
        if (courseMinutes >= frame.startMinutes && courseMinutes < frame.endMinutes) {
            return frame;
        }
    }

    // If no exact match, find the closest frame
    // This handles edge cases where a course starts just before a slot
    let closestFrame = null;
    let closestDistance = Infinity;

    for (const frame of frames) {
        const distance = Math.abs(courseMinutes - frame.startMinutes);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestFrame = frame;
        }
    }

    // Only use closest if within 30 minutes
    if (closestDistance <= 30) {
        return closestFrame;
    }

    return null;
}

/**
 * Create a course block element
 */
function createCourseBlock(course, colorInfo, day) {
    const block = document.createElement('div');
    block.className = 'course-block';
    block.dataset.courseId = course.id;
    block.dataset.day = day;
    block.draggable = true;

    // Apply color
    if (colorInfo) {
        block.style.backgroundColor = colorInfo.bg;
        block.style.color = colorInfo.text;
    }

    // Apply overlap styling (room overlap takes precedence with darker color)
    if (course.hasRoomOverlap) {
        block.classList.add('room-overlap');
    } else if (course.hasOverlap) {
        block.classList.add('overlap');
    }

    // Single line: Course number, faculty, and time
    const timeStr = `${formatTime(course.startTime)}-${formatTime(course.endTime)}`;
    block.textContent = `${course.courseNum}: ${course.faculty}  ${timeStr}`;

    // Set font size
    block.style.fontSize = `${courseFontSize}px`;

    // Click handler
    block.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCourse(course);
    });

    return block;
}

/**
 * Set course font size
 */
export function setCourseFontSize(size) {
    courseFontSize = size;
    document.documentElement.style.setProperty('--course-font-size', `${size}px`);

    // Update existing blocks
    document.querySelectorAll('.course-block').forEach(block => {
        block.style.fontSize = `${size}px`;
    });
}

/**
 * Get time frames for drag/drop targeting
 */
export function getTimeFrames() {
    return timeFrames;
}

/**
 * Get time slot label from minutes
 */
export function getTimeSlotLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Parse time label to minutes
 */
export function parseTimeLabel(label) {
    const [hours, mins] = label.split(':').map(Number);
    return hours * 60 + mins;
}

/**
 * Format 24-hour time label to 12-hour display format
 */
function formatTimeLabel(label) {
    const [hours, mins] = label.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${hour12}:${mins.toString().padStart(2, '0')} ${period}`;
}
