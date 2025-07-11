# po-linter

Checks for duplicate `msgid`s in `.po` files to prevent translation issues.

This tool scans your repository for `.po` files and checks for duplicate `msgid` entries within each file. Duplicate `msgid`s can lead to incorrect or missing translations, so this action helps you catch these issues early. It can be run as a GitHub Action or as a command-line tool.

## Usage

### As a GitHub Action

To use this action, add the following step to your workflow file (e.g., `.github/workflows/main.yml`):

```yaml
name: Lint PO Files
on: pull_request

jobs:
  lint-po:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run po-linter
        uses: Lundalogik/po-linter@v1
```

The action provides a summary of its findings in the GitHub Actions job summary.

#### When duplicates are found

If duplicate `msgid`s are found, the action will fail and provide a summary detailing which files contain duplicates and what the duplicate `msgid`s are.

![Screenshot of a failing run with duplicate msgids](readme-assets/found-duplicate-msgids.png)

#### When no duplicates are found

If no duplicate `msgid`s are found, the action will succeed and provide a confirmation summary.

![Screenshot of a passing run with no duplicate msgids found](readme-assets/no-duplicate-msgids-found.png)

### As a CLI tool

You can also use this tool from your terminal using `npx`. This is useful for local checks.

```bash
npx @limetech/po-linter
```

The tool will scan for `.po` files in the current directory and all subdirectories, and print any duplicates it finds.

#### When duplicates are found

```bash
$ npx @limetech/po-linter
Checking file: src/translations/sv.po
Duplicate msgid found in src/translations/sv.po: "An unexpected error occurred"
❌ Found duplicate msgid's in 1 file(s)

- src/translations/sv.po (1 duplicates)
  - "An unexpected error occurred"
```

#### When no duplicates are found

```bash
$ npx @limetech/po-linter
Checking file: src/translations/en.po
Checking file: src/translations/sv.po
✅ No duplicate msgids found.
```

## Inputs

This action does not require any inputs.

## Outputs

This action does not produce any outputs when run as a GitHub Action. When run as a CLI tool, it will exit with a non-zero status code if duplicates are found.

## License

This project is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for details.
