const core = require('@actions/core');
const { HEADING_LEVEL_2, escapeHtml } = require('../constants');
class GitHubActionsReporter {
    async reportSuccess() {
        await core.summary
            .addHeading('✅ No Duplicate `msgid`s Found')
            .addRaw(
                'All `.po` files were checked and no duplicate `msgid`s were found.',
            )
            .write();
        core.info('No duplicate msgids found.');
    }

    async reportNoFilesFound() {
        core.info('No .po files found.');
        await core.summary.addHeading('No `.po` files found').write();
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

        await summary.write();
        core.setFailed('Duplicate msgids found in one or more .po files.');
    }

    async reportFatalError(error) {
        core.setFailed(error.message);
        await core.summary
            .addHeading('❗ Error')
            .addRaw(
                'An unexpected error occurred while checking for duplicate `msgid`s.',
            )
            .addCodeBlock(error.stack || error.message, 'javascript')
            .write();
    }

    reportDuplicate(file, msgid) {
        const message = `Duplicate msgid found in ${file}: "${msgid}"`;
        core.error(message);
    }
}

module.exports = GitHubActionsReporter;
