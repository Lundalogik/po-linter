// Coerces its input, since anything thrown can end up here, not only strings.
function escapeHtml(unsafe) {
    return String(unsafe)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

module.exports = {
    // The job summary is rendered as one contiguous block of HTML, so Markdown
    // is not processed within it.
    ATTRIBUTION:
        '<sub>Reported by <a href="https://github.com/Lundalogik/po-linter">po-linter</a></sub>',
    EXIT_CODE_FAILURE: 1,
    HEADING_LEVEL_2: 2,
    NO_FILES_MESSAGE: 'No .po files found, nothing to check.',
    escapeHtml,
};
