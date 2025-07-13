#!/usr/bin/env node
const glob = require('@actions/glob');
const pofile = require('pofile');
const { promisify } = require('util');
const { GitHubActionsReporter, ConsoleReporter } = require('./reporters');

const pofileLoad = promisify(pofile.load.bind(pofile));

class PoLinter {
    constructor() {
        this.reporter = process.env.GITHUB_ACTIONS
            ? new GitHubActionsReporter()
            : new ConsoleReporter();
    }

    async reportSuccess() {
        await this.reporter.reportSuccess();
    }

    async reportFailure(allDuplicates) {
        await this.reporter.reportFailure(allDuplicates);
    }

    async reportFatalError(error) {
        await this.reporter.reportFatalError(error);
    }

    async reportNoFilesFound() {
        await this.reporter.reportNoFilesFound();
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
            this.reporter.reportDuplicate(file, msgid);
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
