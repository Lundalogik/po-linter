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
            .addHeading('✅ No Duplicate `msgid`s Found', HEADING_LEVEL_2)
            .addRaw(
                'All `.po` files were checked and no duplicate `msgid`s were found.',
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
                `The following files contain duplicate \`msgid\` entries. This can cause issues with translations. Please resolve them.`,
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
                `\`${file}\` (${duplicates.size} duplicates)`,
                `<ul>${listItems}</ul>`,
            );
        }

        await addAttribution(summary).write();
        core.setFailed('Duplicate msgids found in one or more .po files.');
    }

    async reportFatalError(error) {
        core.setFailed(error.message);
        const summary = core.summary
            .addHeading('❗ Error', HEADING_LEVEL_2)
            .addRaw(
                'An unexpected error occurred while checking for duplicate `msgid`s.',
            )
            .addCodeBlock(error.stack || error.message, 'javascript');
        await addAttribution(summary).write();
    }

    reportDuplicate(file, msgid) {
        const message = `Duplicate msgid found in ${file}: "${msgid}"`;
        core.error(message);
    }
}

module.exports = GitHubActionsReporter;
