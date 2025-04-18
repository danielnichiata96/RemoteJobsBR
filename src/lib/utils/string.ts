export const normalizeStringForSearch = (str: string | null | undefined): string => {
    if (!str) {
        return ''; // Return empty string for null/undefined/empty input
    }
    return str
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove common punctuation
        .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
        .trim();
};

export const normalizeCompanyName = (name: string | null | undefined): string => {
    let normalized = normalizeStringForSearch(name);
    // Remove common legal suffixes - add more as needed for your data
    // Using regex word boundaries \b to avoid removing parts of longer words
    normalized = normalized.replace(/\s\b(inc|llc|ltd|corp|corporation|sa|ltda)\b/g, '').trim();
    return normalized;
}; 