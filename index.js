#!/usr/bin/env node
const core = require('@actions/core');
const glob = require('@actions/glob');
const pofile = require('pofile');
const { promisify } = require('util');

const pofileLoad = promisify(pofile.load.bind(pofile));

const EXIT_CODE_FAILURE = 1;
const HEADING_LEVEL_2 = 2;

class PoLinter {
    constructor() {
        this.isGitHubActions = !!process.env.GITHUB_ACTIONS;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    async reportSuccess() {
        if (this.isGitHubActions) {
            await core.summary
                .addHeading('✅ No Duplicate `msgid`s Found')
                .addRaw(
                    'All `.po` files were checked and no duplicate `msgid`s were found.',
                )
                .write();
            core.info('No duplicate msgids found.');
        } else {
            console.log('✅ No duplicate msgids found.');
        }
    }

    async reportFailure(allDuplicates) {
        if (this.isGitHubActions) {
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
                            `<li><pre><code>${this.escapeHtml(msgid)}</code></pre></li>`,
                    )
                    .join('');
                summary.addDetails(
                    `\`${file}\` (${duplicates.size} duplicates)`,
                    `<ul>${listItems}</ul>`,
                );
            }

            await summary.write();
            core.setFailed('Duplicate msgids found in one or more .po files.');
        } else {
            console.error(
                `❌ Found duplicate msgid's in ${allDuplicates.size} file(s)`,
            );
            for (const [file, duplicates] of allDuplicates.entries()) {
                console.error(`\n- ${file} (${duplicates.size} duplicates)`);
                for (const msgid of duplicates) {
                    console.error(`  - "${msgid}"`);
                }
            }
            process.exit(EXIT_CODE_FAILURE);
        }
    }

    async reportFatalError(error) {
        if (this.isGitHubActions) {
            core.setFailed(error.message);
            await core.summary
                .addHeading('❗ Error')
                .addRaw(
                    'An unexpected error occurred while checking for duplicate `msgid`s.',
                )
                .addCodeBlock(error.stack || error.message, 'javascript')
                .write();
        } else {
            console.error('❗ Error');
            console.error(error);
            process.exit(EXIT_CODE_FAILURE);
        }
    }

    async reportNoFilesFound() {
        if (this.isGitHubActions) {
            core.info('No .po files found.');
            await core.summary.addHeading('No `.po` files found').write();
        } else {
            console.log('No .po files found.');
        }
    }

    async findDuplicatesInFile(file) {
        console.log(`Checking file: ${file}`);
        const po = await pofileLoad(file);
        const msgids = new Set();
        const duplicates = new Set();

        for (const item of po.items) {
            if (0 < item.msgid.length) {
                if (msgids.has(item.msgid)) {
                    duplicates.add(item.msgid);
                } else {
                    msgids.add(item.msgid);
                }
            }
        }

        return duplicates;
    }

    reportDuplicates(file, duplicates) {
        for (const msgid of duplicates) {
            const message = `Duplicate msgid found in ${file}: "${msgid}"`;
            if (this.isGitHubActions) {
                core.error(message);
            }
        }
    }

    async main() {
        try {
            const globber = await glob.create('**/*.po');
            const files = await globber.glob();

            if (0 === files.length) {
                await this.reportNoFilesFound();
                return;
            }

            const allDuplicates = new Map();
            const filePromises = files.map(async (file) => {
                const duplicates = await this.findDuplicatesInFile(file);
                if (0 < duplicates.size) {
                    allDuplicates.set(file, duplicates);
                    this.reportDuplicates(file, duplicates);
                }
            });

            await Promise.all(filePromises);

            if (0 < allDuplicates.size) {
                await this.reportFailure(allDuplicates);
            } else {
                await this.reportSuccess();
            }
        } catch (error) {
            await this.reportFatalError(error);
        }
    }
}

if (require.main === module) {
    new PoLinter().main();
}

module.exports = PoLinter;
