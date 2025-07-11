const core = require('@actions/core');
const glob = require('@actions/glob');
const pofile = require('pofile');
const { promisify } = require('util');

const pofileLoad = promisify(pofile.load.bind(pofile));

async function main() {
  try {
    const globber = await glob.create('**/*.po');
    const files = await globber.glob();

    if (files.length === 0) {
      core.info('No .po files found.');
      await core.summary.addHeading('No `.po` files found').write();
      return;
    }

    const allDuplicates = new Map();

    for (const file of files) {
      core.info(`Checking file: ${file}`);
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
          core.error(`Duplicate msgid found in ${file}: "${msgid}"`);
        }
      }
    }

    if (allDuplicates.size > 0) {
      const summary = core.summary
        .addHeading(`❌ Found duplicate msgid's in ${allDuplicates.size} file(s)`, 2)
        .addRaw(
          `The following files contain duplicate \`msgid\` entries. This can cause issues with translations. Please resolve them.`
        )
        .addSeparator();

      for (const [file, duplicates] of allDuplicates.entries()) {
        const listItems = [...duplicates]
          .map(d => `<li><pre><code>${d}</code></pre></li>`)
          .join('');
        summary.addDetails(
          `\`${file}\` (${duplicates.size} duplicates)`,
          `<ul>${listItems}</ul>`
        );
      }

      await summary.write();
      core.setFailed('Duplicate msgids found in one or more .po files.');
    } else {
      await core.summary
        .addHeading('✅ No Duplicate `msgid`s Found')
        .addRaw('All `.po` files were checked and no duplicate `msgid`s were found.')
        .write();
      core.info('No duplicate msgids found.');
    }
  } catch (error) {
    core.setFailed(error.message);
    await core.summary
      .addHeading('❗ Error')
      .addRaw('An unexpected error occurred while checking for duplicate `msgid`s.')
      .addCodeBlock(error.stack || error.message, 'javascript')
      .write();
  }
}

main();
