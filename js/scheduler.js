/**
 * Scheduler - Course class, overlap detection, and FTE calculation
 */

import { parseTime, parseDays } from './fileHandler.js';

// Course ID counter
let courseIdCounter = 0;

/**
 * Create a course object from row data
 */
export function createCourse(rowData) {
    const startTime = parseTime(rowData.startTime);
    const endTime = parseTime(rowData.endTime);
    const days = parseDays(rowData.days);

    if (!startTime || !endTime || !days) {
        console.warn('Invalid course data:', rowData);
        return null;
    }

    const faculty = extractLastName(rowData.faculty);
    const fte = parseFloat(rowData.fte) || 1.0;

    const course = {
        id: `course_${++courseIdCounter}`,
        courseNum: rowData.courseNum,
        courseName: rowData.courseName,
        faculty: faculty,
        facultyFull: rowData.faculty,
        days: days,
        startTime: startTime,
        endTime: endTime,
        length: (endTime - startTime) / (1000 * 60), // Duration in minutes
        fte: fte,
        visible: true,
        hasOverlap: false,
        overlappingCourses: []
    };

    return course;
}

/**
 * Extract last name from faculty string
 * "Last, First" -> "Last"
 * "First Last" -> "Last"
 */
function extractLastName(faculty) {
    if (!faculty) return 'TBA';

    faculty = faculty.trim();

    // Check for "Last, First" format
    if (faculty.includes(',')) {
        return faculty.split(',')[0].trim();
    }

    // Check for "First Last" format
    if (faculty.includes(' ')) {
        const parts = faculty.split(' ');
        return parts[parts.length - 1].trim();
    }

    // Return as-is
    return faculty;
}

/**
 * Check all courses for overlaps
 */
export function checkAllOverlaps(courses, checkTBA = true) {
    // Reset overlap flags
    for (const course of courses) {
        course.hasOverlap = false;
        course.overlappingCourses = [];
    }

    // Check each pair of courses
    for (let i = 0; i < courses.length; i++) {
        for (let j = i + 1; j < courses.length; j++) {
            const course1 = courses[i];
            const course2 = courses[j];

            // Skip if different faculty
            if (course1.faculty !== course2.faculty) continue;

            // Skip TBA faculty if not checking
            if (!checkTBA && (course1.faculty.toUpperCase() === 'TBA' || course1.faculty.toUpperCase() === 'TBD')) {
                continue;
            }

            // Check if courses overlap
            if (coursesOverlap(course1, course2)) {
                course1.hasOverlap = true;
                course2.hasOverlap = true;
                course1.overlappingCourses.push(course2.id);
                course2.overlappingCourses.push(course1.id);
            }
        }
    }
}

/**
 * Check if two courses overlap
 */
function coursesOverlap(course1, course2) {
    // Check if they share any days
    const commonDays = getCommonDays(course1.days, course2.days);
    if (commonDays.length === 0) return false;

    // Check if times overlap
    return timesOverlap(course1.startTime, course1.endTime, course2.startTime, course2.endTime);
}

/**
 * Get common days between two day strings
 */
function getCommonDays(days1, days2) {
    const result = [];
    for (const day of days1) {
        if (days2.includes(day)) {
            result.push(day);
        }
    }
    return result;
}

/**
 * Check if two time ranges overlap
 */
function timesOverlap(start1, end1, start2, end2) {
    // Convert to comparable values (minutes since midnight)
    const s1 = start1.getHours() * 60 + start1.getMinutes();
    const e1 = end1.getHours() * 60 + end1.getMinutes();
    const s2 = start2.getHours() * 60 + start2.getMinutes();
    const e2 = end2.getHours() * 60 + end2.getMinutes();

    // Check for overlap
    return (s1 < e2 && e1 > s2);
}

/**
 * Calculate FTE per faculty
 */
export function calculateFacultyFTE(courses) {
    const fteByFaculty = {};

    for (const course of courses) {
        if (!fteByFaculty[course.faculty]) {
            fteByFaculty[course.faculty] = 0;
        }
        fteByFaculty[course.faculty] += course.fte;
    }

    // Round to 2 decimal places
    for (const faculty of Object.keys(fteByFaculty)) {
        fteByFaculty[faculty] = Math.round(fteByFaculty[faculty] * 100) / 100;
    }

    return fteByFaculty;
}

/**
 * Get time blocks for the schedule
 * Returns MWF and TR time blocks matching the original Python version
 */
export function getTimeBlocks() {
    // Base time: 7:50 AM
    const baseTime = new Date(2020, 0, 1, 7, 50);

    // Generate time blocks every 10 minutes
    const allBlocks = [];
    for (let i = 0; i < 64; i++) { // ~10 hours of 10-minute blocks
        const time = new Date(baseTime.getTime() + i * 10 * 60 * 1000);
        allBlocks.push(time);
    }

    // MWF time slot starting indices and lengths (matching Python)
    const mwfSlots = [
        { index: 4, length: 7, time: '08:30' },   // 8:30 AM
        { index: 11, length: 8, time: '09:40' },  // 9:40 AM
        { index: 18, length: 7, time: '10:50' },  // 10:50 AM
        { index: 32, length: 7, time: '12:20' },  // 12:20 PM
        { index: 39, length: 7, time: '01:10' },  // 1:10 PM
        { index: 46, length: 7, time: '02:00' },  // 2:00 PM
        { index: 61, length: 4, time: '03:40' }   // 3:40 PM
    ];

    // TR time slot starting indices and lengths
    const trSlots = [
        { index: 4, length: 10, time: '08:30' },  // 8:30 AM
        { index: 14, length: 10, time: '10:10' }, // 10:10 AM
        { index: 27, length: 10, time: '12:20' }, // 12:20 PM (adjusted)
        { index: 37, length: 10, time: '01:10' }, // 1:10 PM (adjusted)
        { index: 47, length: 10, time: '02:00' }, // 2:00 PM (adjusted)
        { index: 61, length: 4, time: '03:40' }   // 3:40 PM
    ];

    // Convert to actual time objects
    const mwfBlocks = mwfSlots.map(slot => ({
        startTime: allBlocks[slot.index],
        endTime: new Date(allBlocks[slot.index].getTime() + slot.length * 10 * 60 * 1000),
        label: slot.time
    }));

    const trBlocks = trSlots.map(slot => ({
        startTime: allBlocks[slot.index],
        endTime: new Date(allBlocks[slot.index].getTime() + slot.length * 10 * 60 * 1000),
        label: slot.time
    }));

    return { mwf: mwfBlocks, tr: trBlocks };
}

/**
 * Find which time frame a course belongs to
 */
export function findCourseTimeFrame(course, timeBlocks) {
    const courseStart = course.startTime.getHours() * 60 + course.startTime.getMinutes();

    // Determine if MWF or TR
    const isMWF = course.days.includes('m') || course.days.includes('w') || course.days.includes('f');
    const isTR = course.days.includes('t') || course.days.includes('r');

    let blocks;
    if (isMWF && !isTR) {
        blocks = timeBlocks.mwf;
    } else if (isTR && !isMWF) {
        blocks = timeBlocks.tr;
    } else {
        // Mixed days - try MWF first, then TR
        blocks = [...timeBlocks.mwf, ...timeBlocks.tr];
    }

    // Find matching block
    for (let i = 0; i < blocks.length; i++) {
        const blockStart = blocks[i].startTime.getHours() * 60 + blocks[i].startTime.getMinutes();
        const blockEnd = blocks[i].endTime.getHours() * 60 + blocks[i].endTime.getMinutes();

        if (courseStart >= blockStart && courseStart < blockEnd) {
            return {
                blockIndex: i,
                label: blocks[i].label,
                isMWF: isMWF && !isTR,
                isTR: isTR && !isMWF
            };
        }
    }

    // Course doesn't fit standard slots
    return null;
}

/**
 * Update course time after drag/drop
 */
export function updateCourseTime(course, newStartTimeStr) {
    // Parse the new start time
    const [hours, minutes] = newStartTimeStr.split(':').map(Number);
    const newStart = new Date(2020, 0, 1, hours, minutes);

    // Calculate new end time based on duration
    const newEnd = new Date(newStart.getTime() + course.length * 60 * 1000);

    course.startTime = newStart;
    course.endTime = newEnd;

    return course;
}

/**
 * Check if a course can be moved to a time slot
 * Returns true if the move is valid (within MWF or TR constraints)
 */
export function canMoveCourse(course, targetTimeSlot, targetDay) {
    const courseDays = course.days;

    // Single-day courses can move anywhere
    if (courseDays.length === 1) {
        return true;
    }

    // Check MWF/TR constraints
    const isMWF = courseDays === 'mwf';
    const isTR = courseDays === 'tr';

    if (isMWF) {
        return 'mwf'.includes(targetDay);
    }

    if (isTR) {
        return 'tr'.includes(targetDay);
    }

    // Non-standard day combinations - don't allow drag moves
    return false;
}

/**
 * Generate a list of available start times
 */
export function getAvailableStartTimes() {
    const times = [];
    // Generate times from 7:00 AM to 9:00 PM in 10-minute increments
    for (let h = 7; h <= 21; h++) {
        for (let m = 0; m < 60; m += 10) {
            const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const timeStr = `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
            const time24 = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            times.push({ display: timeStr, value: time24 });
        }
    }
    return times;
}

/**
 * Generate a list of available course lengths
 */
export function getAvailableLengths() {
    const lengths = [];
    // From 50 minutes to 4 hours in 10-minute increments
    for (let m = 50; m <= 240; m += 10) {
        const hours = Math.floor(m / 60);
        const mins = m % 60;
        const display = hours > 0
            ? `${hours}:${mins.toString().padStart(2, '0')}`
            : `0:${mins.toString().padStart(2, '0')}`;
        lengths.push({ display, value: m });
    }
    return lengths;
}
