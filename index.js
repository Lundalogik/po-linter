#!/usr/bin/env node
const core = require('@actions/core');
const glob = require('@actions/glob');
const pofile = require('pofile');
const { promisify } = require('util');

const pofileLoad = promisify(pofile.load.bind(pofile));

class PoLinter {
    constructor() {
        this.isGitHubActions = !!process.env.GITHUB_ACTIONS;
    }

    escapeHtml(unsafe) {
        return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    async reportSuccess() {
        if (this.isGitHubActions) {
            await core.summary
            .addHeading('✅ No Duplicate `msgid`s Found')
            .addRaw('All `.po` files were checked and no duplicate `msgid`s were found.')
            .write();
            core.info('No duplicate msgids found.');
        } else {
            console.log('✅ No duplicate msgids found.');
        }
    }

    async reportFailure(allDuplicates) {
        if (this.isGitHubActions) {
            const summary = core.summary
            .addHeading(`❌ Found duplicate msgid's in ${allDuplicates.size} file(s)`, 2)
            .addRaw(
                `The following files contain duplicate \`msgid\` entries. This can cause issues with translations. Please resolve them.`
            )
            .addSeparator();

            for (const [file, duplicates] of allDuplicates.entries()) {
                const listItems = [...duplicates]
                .map(d => `<li><pre><code>${this.escapeHtml(d)}</code></pre></li>`)
                .join('');
                summary.addDetails(
                    `\`${file}\` (${duplicates.size} duplicates)`,
                    `<ul>${listItems}</ul>`
                );
            }

            await summary.write();
            core.setFailed('Duplicate msgids found in one or more .po files.');
        } else {
            console.error(`❌ Found duplicate msgid's in ${allDuplicates.size} file(s)`);
            for (const [file, duplicates] of allDuplicates.entries()) {
                console.error(`\n- ${file} (${duplicates.size} duplicates)`);
                for (const msgid of duplicates) {
                    console.error(`  - "${msgid}"`);
                }
            }
            process.exit(1);
        }
    }

    async reportFatalError(error) {
        if (this.isGitHubActions) {
            core.setFailed(error.message);
            await core.summary
            .addHeading('❗ Error')
            .addRaw('An unexpected error occurred while checking for duplicate `msgid`s.')
            .addCodeBlock(error.stack || error.message, 'javascript')
            .write();
        } else {
            console.error('❗ Error');
            console.error(error);
            process.exit(1);
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

    async main() {
        try {
            const globber = await glob.create('**/*.po');
            const files = await globber.glob();

            if (files.length === 0) {
                await this.reportNoFilesFound();
                return;
            }

            const allDuplicates = new Map();

            for (const file of files) {
                console.log(`Checking file: ${file}`);
                const po = await pofileLoad(file);
                const msgids = new Set();
                const duplicates = new Set();

                for (const item of po.items) {
                    if (item.msgid.length > 0) {
                        if (msgids.has(item.msgid)) {
                            duplicates.add(item.msgid);
                        } else {
                            msgids.add(item.msgid);
                        }
                    }
                }

                if (duplicates.size > 0) {
                    allDuplicates.set(file, duplicates);
                    for (const msgid of duplicates) {
                        const message = `Duplicate msgid found in ${file}: "${msgid}"`;
                        if (this.isGitHubActions) {
                            core.error(message);
                        }
                    }
                }
            }

            if (allDuplicates.size > 0) {
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
