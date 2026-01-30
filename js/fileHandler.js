/**
 * File Handler - CSV and Excel file parsing with flexible column detection
 */

// Column name aliases for flexible matching
const COLUMN_ALIASES = {
    courseNum: ['class', 'course', 'course number', 'number', 'course num', 'course #', 'course code', 'code', 'section'],
    courseName: ['description', 'name', 'course name', 'title', 'course title', 'course description'],
    faculty: ['faculty', 'instructor1', 'professor', 'teacher', 'taught by', 'lecturer', 'staff'],
    days: ['days', 'day', 'meeting days', 'meets', 'schedule', 'meeting pattern', 'pattern'],
    startTime: ['start', 'start time', 'begin', 'from', 'begins', 'start_time', 'begin time'],
    endTime: ['end', 'end time', 'until', 'ends', 'end_time', 'finish', 'finish time'],
    fte: ['fte', 'load', 'teaching load', 'workload', 'fte1'],
    term: ['term', 'semester', 'session', 'academic term', 'term code'],
    room: ['room', 'classroom', 'location', 'building', 'room number', 'room #']
};

// Term code patterns for single-sheet format (e.g., "2024SEM1" = Fall, "2024SEM2" = Spring)
const TERM_CODE_PATTERNS = {
    fall: [/sem1$/i, /fall/i, /autumn/i, /^fa\d*/i],
    spring: [/sem2$/i, /spring/i, /^sp\d*/i],
    winter: [/sem3$/i, /winter/i, /^wi\d*/i],
    summer: [/sem4$/i, /summer/i, /^su\d*/i]
};

// Semester detection patterns
const SEMESTER_PATTERNS = {
    fall: [/fall/i, /autumn/i, /^fa\d*/i, /^f\d{2}/i],
    spring: [/spring/i, /^sp\d*/i, /^s\d{2}/i],
    winter: [/winter/i, /^wi\d*/i, /^w\d{2}/i],
    summer: [/summer/i, /^su\d*/i, /^sum/i]
};

/**
 * Parse a file (CSV or Excel)
 * @param {File} file - The file to parse
 * @returns {Object} - Object with sheet names as keys and row arrays as values
 */
export async function parseFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'csv') {
        const text = await file.text();
        const rows = parseCSV(text);
        return { 'Sheet1': rows };
    } else if (extension === 'xlsx' || extension === 'xls') {
        return await parseExcel(file);
    } else {
        throw new Error(`Unsupported file format: ${extension}`);
    }
}

/**
 * Parse CSV text into rows
 */
function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
        if (line.trim() === '') continue;

        const row = [];
        let cell = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    // Escaped quote
                    cell += '"';
                    i++;
                } else if (char === '"') {
                    // End of quoted field
                    inQuotes = false;
                } else {
                    cell += char;
                }
            } else {
                if (char === '"') {
                    // Start of quoted field
                    inQuotes = true;
                } else if (char === ',') {
                    // End of cell
                    row.push(cell.trim());
                    cell = '';
                } else {
                    cell += char;
                }
            }
        }

        // Push last cell
        row.push(cell.trim());
        rows.push(row);
    }

    return rows;
}

/**
 * Parse Excel file using SheetJS
 */
async function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                const result = {};
                for (const sheetName of workbook.SheetNames) {
                    const sheet = workbook.Sheets[sheetName];
                    // Use raw: false to get formatted strings, defval for empty cells
                    const rows = XLSX.utils.sheet_to_json(sheet, {
                        header: 1,
                        raw: false,
                        defval: ''
                    });
                    // Filter out completely empty rows
                    const filteredRows = rows.filter(row =>
                        row.some(cell => cell !== '' && cell !== null && cell !== undefined)
                    );
                    result[sheetName] = filteredRows;
                    console.log(`Sheet "${sheetName}": ${filteredRows.length} rows`);
                }

                resolve(result);
            } catch (error) {
                reject(new Error(`Failed to parse Excel file: ${error.message}`));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Detect semesters from parsed data
 * @param {Object} sheets - Object with sheet names as keys and row arrays as values
 * @param {string} fileName - Original file name
 * @returns {Object} - { semesters: {...}, formatInfo: {...} }
 *   - semesters: Object with semester names as keys and normalized row data as values
 *   - formatInfo: Metadata about the original format for saving
 */
export function detectSemesters(sheets, fileName) {
    const semesters = {};
    const sheetNames = Object.keys(sheets);
    let formatInfo = { type: 'separate-sheets' };

    // Try to detect semesters from sheet names
    let detectedSemesters = 0;
    for (const sheetName of sheetNames) {
        const semester = detectSemesterFromName(sheetName);
        if (semester) {
            const rows = sheets[sheetName];
            const normalizedRows = normalizeRows(rows);
            if (normalizedRows.length > 0) {
                semesters[semester] = normalizedRows;
                detectedSemesters++;
            }
        }
    }

    // If no semesters detected from sheet names, check for single-sheet format with TERM column
    if (detectedSemesters === 0) {
        // Look for a sheet that might contain all courses with a TERM column
        // Common names: "COURSE SCHEDULE", "Schedule", "Courses", "Sheet1", etc.
        for (const sheetName of sheetNames) {
            const rows = sheets[sheetName];
            const result = normalizeRows(rows, true); // Include term data and original rows

            if (result.rows.length > 0 && result.rows[0]._term !== undefined) {
                // This sheet has a TERM column - split by term

                const semestersByTerm = splitByTerm(result.rows);

                // Store format info for saving back in original format
                // Include original term codes for each semester
                const termCodes = {};
                for (const [semester, data] of Object.entries(semestersByTerm)) {
                    termCodes[semester] = data.originalTermCode;
                }

                formatInfo = {
                    type: 'single-sheet-term',
                    sheetName: sheetName,
                    headers: result.headers,
                    headerRowIndex: result.headerRowIndex,
                    columnMapping: result.columnMapping,
                    termCodes: termCodes
                };

                for (const [semester, data] of Object.entries(semestersByTerm)) {
                    semesters[semester] = data.rows;
                    detectedSemesters++;
                }

                // Stop after finding the first valid sheet with TERM column
                break;
            }
        }
    }

    // If still no semesters detected, try file name or use default
    if (detectedSemesters === 0) {
        // Check if file name contains semester info
        const fileNameSemester = detectSemesterFromName(fileName);

        // Use all sheets with data
        for (const sheetName of sheetNames) {
            const rows = sheets[sheetName];
            const normalizedRows = normalizeRows(rows);
            if (normalizedRows.length > 0) {
                // Use detected semester from filename, sheet name, or generic name
                const semesterName = fileNameSemester ||
                    (sheetNames.length === 1 ? 'schedule' : sheetName.toLowerCase().replace(/\s+/g, '_'));
                semesters[semesterName] = normalizedRows;
            }
        }
    }

    return { semesters, formatInfo };
}

/**
 * Split normalized rows by their term values
 * @param {Array} rows - Normalized rows with _term field
 * @returns {Object} - Object with semester names as keys and { rows, originalTermCode } as values
 */
function splitByTerm(rows) {
    const semesterMap = {};

    for (const row of rows) {
        const termValue = row._term || '';
        const semester = detectSemesterFromTermCode(termValue);

        if (!semesterMap[semester]) {
            semesterMap[semester] = {
                rows: [],
                originalTermCode: termValue // Store original term code for saving
            };
        }
        semesterMap[semester].rows.push(row);
    }

    return semesterMap;
}

/**
 * Detect semester from a term code (e.g., "2024SEM1" -> "fall")
 */
function detectSemesterFromTermCode(termCode) {
    if (!termCode) return 'unknown';

    const code = String(termCode).trim();

    for (const [semester, patterns] of Object.entries(TERM_CODE_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(code)) {
                return semester;
            }
        }
    }

    // If no pattern matches, use the term code as-is (cleaned up)
    return code.toLowerCase().replace(/\s+/g, '_') || 'unknown';
}

/**
 * Detect semester from a name (sheet name or file name)
 */
function detectSemesterFromName(name) {
    const lowerName = name.toLowerCase();

    for (const [semester, patterns] of Object.entries(SEMESTER_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(lowerName)) {
                return semester;
            }
        }
    }

    return null;
}

/**
 * Normalize rows to consistent object format
 * @param {Array} rows - Raw rows from the spreadsheet
 * @param {boolean} includeTerm - Whether to include the term field and original row data (for single-sheet format)
 * @returns {Array|Object} - Array of normalized rows, or object with rows and metadata if includeTerm is true
 */
function normalizeRows(rows, includeTerm = false) {
    if (rows.length < 2) {
        console.warn('Not enough rows:', rows.length);
        return includeTerm ? { rows: [], headers: [], headerRowIndex: 0, columnMapping: null } : [];
    }

    console.log('First row (potential header):', rows[0]);

    // Find header row (first row with recognizable column names)
    let headerRowIndex = 0;
    let columnMapping = null;

    for (let i = 0; i < Math.min(5, rows.length); i++) {
        const mapping = detectColumnMapping(rows[i]);
        console.log(`Row ${i} mapping:`, mapping, 'from:', rows[i]);
        if (mapping && Object.keys(mapping).length >= 3) {
            headerRowIndex = i;
            columnMapping = mapping;
            break;
        }
    }

    if (!columnMapping) {
        console.warn('Could not detect column headers. Rows:', rows.slice(0, 3));
        return includeTerm ? { rows: [], headers: [], headerRowIndex: 0, columnMapping: null } : [];
    }

    console.log('Using column mapping:', columnMapping);

    // Store headers if needed for reconstructing original format
    const headers = rows[headerRowIndex];

    // Parse data rows
    const normalizedRows = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || isEmptyRow(row)) continue;

        const normalized = {
            courseNum: getCell(row, columnMapping.courseNum) || '',
            courseName: getCell(row, columnMapping.courseName) || '',
            faculty: getCell(row, columnMapping.faculty) || 'TBA',
            days: getCell(row, columnMapping.days) || '',
            startTime: getCell(row, columnMapping.startTime) || '',
            endTime: getCell(row, columnMapping.endTime) || '',
            fte: getCell(row, columnMapping.fte) || '1',
            room: getCell(row, columnMapping.room) || ''
        };

        // Include term field and original row data if requested (for single-sheet format)
        if (includeTerm) {
            if (columnMapping.term !== undefined) {
                normalized._term = getCell(row, columnMapping.term) || '';
            }
            // Store original row data for reconstruction when saving
            normalized._originalRow = [...row];
            normalized._originalRowIndex = i;
        }

        // Skip rows without course number or days
        if (normalized.courseNum && normalized.days) {
            normalizedRows.push(normalized);
        }
    }

    if (includeTerm) {
        return {
            rows: normalizedRows,
            headers: headers,
            headerRowIndex: headerRowIndex,
            columnMapping: columnMapping
        };
    }

    return normalizedRows;
}

/**
 * Detect column mapping from header row
 */
function detectColumnMapping(headerRow) {
    if (!headerRow || headerRow.length === 0) return null;

    const mapping = {};

    for (let i = 0; i < headerRow.length; i++) {
        const header = String(headerRow[i] || '').toLowerCase().trim();
        if (!header) continue;

        for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
            if (mapping[field] !== undefined) continue; // Already mapped

            for (const alias of aliases) {
                if (header === alias || header.includes(alias)) {
                    mapping[field] = i;
                    break;
                }
            }
        }
    }

    return mapping;
}

/**
 * Get cell value safely
 */
function getCell(row, index) {
    if (index === undefined || index === null) return null;
    const value = row[index];
    if (value === undefined || value === null) return null;
    return String(value).trim();
}

/**
 * Check if row is empty
 */
function isEmptyRow(row) {
    return row.every(cell => !cell || String(cell).trim() === '');
}

/**
 * Parse time string into Date object
 * Handles: "8:30 AM", "08:30", "8:30am", "0830", "8.30 AM", "10:50 A.M.", "6:00 P.M."
 */
export function parseTime(str) {
    if (!str) return null;

    str = String(str).trim().toUpperCase();

    // Remove extra spaces
    str = str.replace(/\s+/g, ' ');

    // Normalize A.M./P.M. to AM/PM (remove periods from AM/PM markers)
    str = str.replace(/A\.M\./g, 'AM').replace(/P\.M\./g, 'PM');
    str = str.replace(/A\.M/g, 'AM').replace(/P\.M/g, 'PM');

    // Replace period with colon for time format (8.30 -> 8:30)
    str = str.replace(/(\d)\.(\d)/g, '$1:$2');

    // Handle format without colon (0830)
    if (/^\d{3,4}$/.test(str)) {
        if (str.length === 3) str = '0' + str;
        str = str.slice(0, 2) + ':' + str.slice(2);
    }

    // Try to parse
    let hours, minutes;
    let isPM = str.includes('PM') || str.includes('P');
    let isAM = str.includes('AM') || str.includes('A');

    // Remove AM/PM and any trailing periods
    str = str.replace(/\s*(AM|PM|A|P)\.?\s*$/i, '').trim();

    const match = str.match(/^(\d{1,2}):?(\d{2})$/);
    if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);

        // Adjust for 12-hour format
        if (isPM && hours !== 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        // Validate
        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            // Use a reference date (Jan 1, 2020) like the Python version
            return new Date(2020, 0, 1, hours, minutes);
        }
    }

    return null;
}

/**
 * Parse days string into normalized format
 * Handles: "MWF", "M W F", "Mon Wed Fri", "TR", "Tuesday Thursday"
 */
export function parseDays(str) {
    if (!str) return '';

    str = String(str).toLowerCase().trim();

    // Remove common separators
    str = str.replace(/[,\s]+/g, '');

    // Map full day names to letters
    const dayMap = {
        'monday': 'm', 'mon': 'm',
        'tuesday': 't', 'tue': 't', 'tues': 't',
        'wednesday': 'w', 'wed': 'w',
        'thursday': 'r', 'thu': 'r', 'thur': 'r', 'thurs': 'r', 'th': 'r',
        'friday': 'f', 'fri': 'f'
    };

    // Check for full day names first
    let result = '';
    const pattern = /(monday|mon|tuesday|tues?|wednesday|wed|thursday|thur?s?|th|friday|fri)/gi;
    const matches = str.match(pattern);

    if (matches) {
        for (const match of matches) {
            const letter = dayMap[match.toLowerCase()];
            if (letter && !result.includes(letter)) {
                result += letter;
            }
        }
    }

    // If no full names found, parse letter-based format
    if (!result) {
        // Handle common patterns
        // TR/TH = Tuesday/Thursday
        if (str === 'tr' || str === 'th') {
            return 'tr';
        }

        // Process each character
        for (const char of str) {
            if ('mtwrf'.includes(char) && !result.includes(char)) {
                result += char;
            }
        }
    }

    // Sort days in standard order (MTWRF)
    const order = 'mtwrf';
    result = result.split('').sort((a, b) => order.indexOf(a) - order.indexOf(b)).join('');

    return result;
}

/**
 * Format time for display (12-hour format)
 */
export function formatTime(date) {
    if (!date) return '';

    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    if (hours === 0) hours = 12;

    const minuteStr = minutes.toString().padStart(2, '0');
    return `${hours}:${minuteStr} ${ampm}`;
}

/**
 * Format time for display (24-hour format, no AM/PM)
 */
export function formatTime24(date) {
    if (!date) return '';

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
