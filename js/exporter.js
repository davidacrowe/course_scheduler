/**
 * Exporter - Export schedule to Excel file with semester tabs
 */

import { formatTime } from './fileHandler.js';

// Column headers for export
const HEADERS = ['Class', 'Description', 'Faculty', 'Days', 'Start Time', 'End Time', 'FTE'];

/**
 * Export semesters to Excel file
 * @param {Object} semesters - Object with semester names as keys and semester data as values
 */
export function exportToExcel(semesters) {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Add a sheet for each semester
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
            { wch: 6 }    // FTE
        ];

        // Capitalize semester name for sheet name
        const sheetName = capitalizeFirst(semesterName);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // Generate filename with date
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const filename = `schedule_${dateStr}.xlsx`;

    // Trigger download
    XLSX.writeFile(workbook, filename);
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
            course.fte
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
