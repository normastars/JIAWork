---
name: gardy-inventory
description: Reconcile GARDY inventory ledger and physical count exports with a repeatable local calculation.
version: 1.0.0
official: true
---

# GARDY Inventory Reconciliation

Use this skill when the user asks to compare an inventory ledger or CAC ERP export with a physical count or another inventory snapshot. Communicate and deliver results in Simplified Chinese. The source files are snapshots; never claim live ERP access.

## Required inputs

Confirm the two source files, their snapshot times, the sheets, matching columns in order (such as part number, batch, warehouse), quantity columns, units, and whether exact duplicate rows count as source records. If time points or units differ, explain the mismatch and ask for a usable comparison rule before calculating.

Inspect headers first. Do not infer a business key from a sample row. Preserve identifiers and leading zeroes. If either file has multiple sheets, ask which sheet to use.

## Run the bundled calculation

Use the existing script under the installed skill root. Do not rewrite the reconciliation in an ad hoc Python or shell script. For example:

```bash
python3 "$SKILLS_ROOT/gardy-inventory/scripts/reconcile.py" \
  --ledger "库存账面.xlsx" \
  --count "盘点结果.xlsx" \
  --keys "零件号,批次,仓库" \
  --ledger-quantity "库存数量" \
  --count-quantity "盘点数量" \
  --output "库存差异清单.csv"
```

The script accepts XLSX, XLSM, and UTF-8 CSV files. Use `--ledger-sheet` and `--count-sheet` when needed. If the two files use different key column names, provide `--ledger-keys` and `--count-keys` in corresponding order. Run `--help` for complete options. If Excel parsing reports that `openpyxl` is unavailable, install it in the active Python environment if permitted by the environment, then rerun the same command. If the script itself is unavailable, report that the bundled skill is missing; do not make up results.

The tool outputs a JSON summary, a difference CSV, and a duplicate-row CSV. Preserve the original files. Report the source and scope, each side's original row count and total, the total difference, matched and unmatched groups, exact duplicate groups, warnings, and paths to the generated files. Verify the CSV totals against the JSON summary before delivery.

An unmatched key means **no corresponding record**. It is not a confirmed zero inventory balance. The difference CSV leaves the absent side blank and labels its zero placeholder as a calculation convention. Treat discrepancies as items for human review; do not advise direct stock adjustments, assign responsibility, or call the result approved.
