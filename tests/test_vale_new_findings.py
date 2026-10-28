#!/usr/bin/env python3
"""Tests for baseline-aware Vale diagnostics."""

import unittest

from vale_new_findings import new_findings


def alert(*, check="Vale.Terms", severity="error", message="Use the preferred term.", match="term", line=1):
    return {
        "Check": check,
        "Severity": severity,
        "Message": message,
        "Match": match,
        "Line": line,
    }


class NewFindingsTests(unittest.TestCase):
    def test_existing_finding_is_ignored_when_its_line_moves(self):
        baseline = [alert(line=10)]
        current = [alert(line=42)]

        self.assertEqual(new_findings(current, baseline), [])

    def test_additional_duplicate_finding_is_reported(self):
        baseline = [alert()]
        current = [alert(line=3), alert(line=8)]

        self.assertEqual(new_findings(current, baseline), [alert(line=8)])

    def test_new_rule_or_message_is_reported(self):
        baseline = [alert()]
        current = [alert(), alert(check="write-good.E-Prime", message="Avoid 'is'.", match="is")]

        self.assertEqual(
            new_findings(current, baseline),
            [alert(check="write-good.E-Prime", message="Avoid 'is'.", match="is")],
        )


if __name__ == "__main__":
    unittest.main()
