/**
 * Utility functions for input validation to prevent SQL Injection and malformed requests.
 */

/**
 * Validates that a symbol is a clean alphanumeric string.
 * Prevents potential injection even through bind variables by restricting characters.
 */
export function validateSymbol(symbol: any): string {
    if (typeof symbol !== 'string') {
        throw new Error('Symbol must be a string');
    }

    const cleaned = symbol.trim().toUpperCase();

    // Symbols should be alphanumeric, possibly with dots (like BRK.A)
    // and typically between 1 and 10 characters.
    if (!/^[A-Z0-9.]+$/.test(cleaned) || cleaned.length === 0 || cleaned.length > 10) {
        throw new Error('Invalid symbol format');
    }

    return cleaned;
}

/**
 * Validates that a date string is in YYYY-MM-DD or ISO format.
 */
export function validateDate(date: any): string {
    if (typeof date !== 'string') {
        throw new Error('Date must be a string');
    }

    // Simple check for YYYY-MM-DD or ISO format
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(date)) {
        throw new Error('Invalid date format');
    }

    return date;
}

/**
 * Validates that a limit is a positive integer within bounds.
 */
export function validateLimit(limit: any, max: number = 1000): number {
    const parsed = typeof limit === 'number' ? limit : parseInt(limit);

    if (isNaN(parsed) || parsed < 1 || parsed > max) {
        throw new Error(`Limit must be a number between 1 and ${max}`);
    }

    return parsed;
}

/**
 * Validates that a balance is a positive number.
 */
export function validateBalance(balance: any): number {
    const parsed = typeof balance === 'number' ? balance : parseFloat(balance);

    if (isNaN(parsed) || parsed < 0) {
        throw new Error('Initial balance must be a non-negative number');
    }

    return parsed;
}
