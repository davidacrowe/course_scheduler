/**
 * Exporter - Export schedule to Excel file with semester tabs
 */

import { formatTime } from './fileHandler.js';

// Column headers for export (used for separate-sheets format)
const HEADERS = ['Class', 'Description', 'Faculty', 'Days', 'Start Time', 'End Time', 'FTE', 'Room'];

// Map semester names back to term codes
const SEMESTER_TO_TERM = {
    fall: 'SEM1',
    spring: 'SEM2',
    winter: 'SEM3',
    summer: 'SEM4'
};

/**
 * Export semesters to Excel file
 * @param {Object} semesters - Object with semester names as keys and semester data as values
 * @param {Object} formatInfo - Original file format info (optional)
 */
export function exportToExcel(semesters, formatInfo = null) {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Check if we should use single-sheet-term format
    if (formatInfo && formatInfo.type === 'single-sheet-term') {
        // Export in registrar format (single sheet with TERM column)
        const sheetData = createSingleSheetData(semesters, formatInfo);
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Use original sheet name
        XLSX.utils.book_append_sheet(workbook, worksheet, formatInfo.sheetName);
    } else {
        // Export in separate-sheets format (original behavior)
        for (const [semesterName, semesterData] of Object.entries(semesters)) {
            const sheetData = createSheetData(semesterData.courses);
            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

            // Set column widths
            worksheet['!cols'] = [
                { wch: 12 },  // Class
                { wch: 35 },  // Description
                { wch: 25 },  // Faculty
                { wch: 8 },   // Days
                { wch: 12 },  // Start Time
                { wch: 12 },  // End Time
                { wch: 6 },   // FTE
                { wch: 15 }   // Room
            ];

            // Capitalize semester name for sheet name
            const sheetName = capitalizeFirst(semesterName);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }
    }

    // Generate filename with date
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const filename = `schedule_${dateStr}.xlsx`;

    // Trigger download
    XLSX.writeFile(workbook, filename);
}

/**
 * Create single sheet data from all semesters (registrar format with TERM column)
 * Preserves original columns and row structure
 */
function createSingleSheetData(semesters, formatInfo) {
    const { headers, columnMapping, termCodes } = formatInfo;
    const data = [[...headers]]; // Start with original headers

    // Fallback year calculation if no original term codes
    const currentYear = new Date().getFullYear();
    const fallYear = new Date().getMonth() >= 8 ? currentYear : currentYear - 1;

    // Collect all courses from all semesters, sorted by original row index if available
    const allCourses = [];

    for (const [semesterName, semesterData] of Object.entries(semesters)) {
        // Use original term code if available, otherwise generate one
        const termCode = (termCodes && termCodes[semesterName]) ||
            `${fallYear}${SEMESTER_TO_TERM[semesterName] || semesterName.toUpperCase()}`;

        for (const course of semesterData.courses) {
            allCourses.push({
                course,
                semesterName,
                termCode,
                originalRowIndex: course._originalRowIndex || Infinity
            });
        }
    }

    // Sort by original row index to maintain original order as much as possible
    allCourses.sort((a, b) => a.originalRowIndex - b.originalRowIndex);

    // Build rows
    for (const { course, termCode } of allCourses) {
        let row;

        if (course._originalRow) {
            // Use original row as base, then update the fields we track
            row = [...course._originalRow];

            // Update the columns we manage
            if (columnMapping.courseNum !== undefined) {
                row[columnMapping.courseNum] = course.courseNum;
            }
            if (columnMapping.courseName !== undefined) {
                row[columnMapping.courseName] = course.courseName;
            }
            if (columnMapping.faculty !== undefined) {
                row[columnMapping.faculty] = course.facultyFull || course.faculty;
            }
            if (columnMapping.days !== undefined) {
                row[columnMapping.days] = course.days.toUpperCase();
            }
            if (columnMapping.startTime !== undefined) {
                row[columnMapping.startTime] = formatTime(course.startTime);
            }
            if (columnMapping.endTime !== undefined) {
                row[columnMapping.endTime] = formatTime(course.endTime);
            }
            if (columnMapping.fte !== undefined) {
                row[columnMapping.fte] = course.fte;
            }
            if (columnMapping.room !== undefined) {
                row[columnMapping.room] = course.room || '';
            }
            if (columnMapping.term !== undefined) {
                row[columnMapping.term] = termCode;
            }
        } else {
            // No original row - create new row with just our tracked columns
            // Make row as wide as headers
            row = new Array(headers.length).fill('');

            if (columnMapping.courseNum !== undefined) {
                row[columnMapping.courseNum] = course.courseNum;
            }
            if (columnMapping.courseName !== undefined) {
                row[columnMapping.courseName] = course.courseName;
            }
            if (columnMapping.faculty !== undefined) {
                row[columnMapping.faculty] = course.facultyFull || course.faculty;
            }
            if (columnMapping.days !== undefined) {
                row[columnMapping.days] = course.days.toUpperCase();
            }
            if (columnMapping.startTime !== undefined) {
                row[columnMapping.startTime] = formatTime(course.startTime);
            }
            if (columnMapping.endTime !== undefined) {
                row[columnMapping.endTime] = formatTime(course.endTime);
            }
            if (columnMapping.fte !== undefined) {
                row[columnMapping.fte] = course.fte;
            }
            if (columnMapping.room !== undefined) {
                row[columnMapping.room] = course.room || '';
            }
            if (columnMapping.term !== undefined) {
                row[columnMapping.term] = termCode;
            }
        }

        data.push(row);
    }

    return data;
}

/**
 * Create sheet data array from courses
 */
function createSheetData(courses) {
    const data = [HEADERS];

    // Sort courses by time, then by course number
    const sortedCourses = [...courses].sort((a, b) => {
        // First sort by start time
        const timeA = a.startTime.getHours() * 60 + a.startTime.getMinutes();
        const timeB = b.startTime.getHours() * 60 + b.startTime.getMinutes();
        if (timeA !== timeB) return timeA - timeB;

        // Then by course number
        return a.courseNum.localeCompare(b.courseNum);
    });

    for (const course of sortedCourses) {
        const row = [
            course.courseNum,
            course.courseName,
            course.facultyFull || course.faculty,
            course.days.toUpperCase(),
            formatTime(course.startTime),
            formatTime(course.endTime),
            course.fte,
            course.room || ''
        ];
        data.push(row);
    }

    return data;
}

/**
 * Export to CSV format (single semester)
 */
export function exportToCSV(courses, filename = 'schedule.csv') {
    const data = createSheetData(courses);

    // Convert to CSV string
    const csvContent = data.map(row =>
        row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma or quote
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(',')
    ).join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    // Clean up
    URL.revokeObjectURL(link.href);
}

/**
 * Utility: Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
