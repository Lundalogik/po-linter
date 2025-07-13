const { EXIT_CODE_FAILURE } = require('../constants');
class ConsoleReporter {
    reportSuccess() {
        console.log('✅ No duplicate msgids found.');
    }

    reportNoFilesFound() {
        console.log('No .po files found.');
    }

    reportFailure(allDuplicates) {
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

    reportFatalError(error) {
        console.error('❗ Error');
        console.error(error);
        process.exit(EXIT_CODE_FAILURE);
    }

    reportDuplicate() {
        // We report all duplicates at the end, so we don't need to do anything here.
    }
}

module.exports = ConsoleReporter;
