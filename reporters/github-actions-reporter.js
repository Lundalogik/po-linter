const core = require('@actions/core');
const {
    ATTRIBUTION,
    HEADING_LEVEL_2,
    NO_FILES_MESSAGE,
    escapeHtml,
} = require('../constants');

function addAttribution(summary) {
    return summary.addSeparator().addRaw(ATTRIBUTION);
}

class GitHubActionsReporter {
    async reportSuccess() {
        const summary = core.summary
            .addHeading(
                '✅ No Duplicate <code>msgid</code>s Found',
                HEADING_LEVEL_2,
            )
            .addRaw(
                'All <code>.po</code> files were checked and no duplicate <code>msgid</code>s were found.',
            );
        await addAttribution(summary).write();
        core.info('No duplicate msgids found.');
    }

    reportNoFilesFound() {
        // Deliberately not written to the job summary: having nothing to check
        // is a non-event, and a summary makes it look like something went
        // wrong.
        core.info(NO_FILES_MESSAGE);
    }

    async reportFailure(allDuplicates) {
        const summary = core.summary
            .addHeading(
                `❌ Found duplicate msgid's in ${allDuplicates.size} file(s)`,
                HEADING_LEVEL_2,
            )
            .addRaw(
                'The following files contain duplicate <code>msgid</code> entries. This can cause issues with translations. Please resolve them.',
            )
            .addSeparator();

        for (const [file, duplicates] of allDuplicates.entries()) {
            const listItems = [...duplicates]
                .map(
                    (msgid) =>
                        `<li><pre><code>${escapeHtml(msgid)}</code></pre></li>`,
                )
                .join('');
            summary.addDetails(
                `<code>${escapeHtml(file)}</code> (${duplicates.size} duplicates)`,
                `<ul>${listItems}</ul>`,
            );
        }

        await addAttribution(summary).write();
        core.setFailed('Duplicate msgids found in one or more .po files.');
    }

    async reportFatalError(error) {
        // Anything can be thrown, not just an `Error`, so fall back to the
        // thrown value itself rather than reporting nothing.
        const message = error?.message || String(error);
        const details = error?.stack || message;

        core.setFailed(message);
        const summary = core.summary
            .addHeading('❗ Error', HEADING_LEVEL_2)
            .addRaw(
                'An unexpected error occurred while checking for duplicate <code>msgid</code>s.',
            )
            .addCodeBlock(escapeHtml(details), 'javascript');
        await addAttribution(summary).write();
    }

    reportDuplicate(file, msgid) {
        const message = `Duplicate msgid found in ${file}: "${msgid}"`;
        core.error(message);
    }
}

module.exports = GitHubActionsReporter;
