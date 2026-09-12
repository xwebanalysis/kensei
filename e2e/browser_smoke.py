#!/usr/bin/env python3
"""Real-browser smoke test for Kensei (zoneless change-detection guard).

The app is Angular 22 zoneless: every async callback that mutates component
state must call ``ChangeDetectorRef.markForCheck()`` or the view stalls on
"[ LOADING... ]" until the user interacts. This script drives the real UI in
Chromium and asserts that data renders *without any extra interaction* after
each async operation.

Stack expected while running (see e2e/README.md):
  frontend  http://localhost:4210
  backend   http://localhost:8010
  fixture   http://localhost:8102   (rich HTML + fake CDNs + SPA routes)

Usage:
  /home/x/Documents/xwebanalysis/samurai/backend/.venv/bin/python \
      e2e/browser_smoke.py

Environment overrides: KENSEI_FRONTEND_URL, KENSEI_BACKEND_URL,
KENSEI_FIXTURE_URL.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

from playwright.sync_api import Page, sync_playwright

FRONTEND = os.environ.get("KENSEI_FRONTEND_URL", "http://localhost:4210")
BACKEND = os.environ.get("KENSEI_BACKEND_URL", "http://localhost:8010")
FIXTURE = os.environ.get("KENSEI_FIXTURE_URL", "http://localhost:8102")

results: list[tuple[bool, str, str]] = []
console_errors: list[str] = []
page_errors: list[str] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    results.append((ok, label, detail))
    suffix = f" — {detail}" if detail else ""
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}{suffix}", flush=True)


def wait_health(url: str, timeout: float = 45.0) -> None:
    import time

    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=3) as response:
                payload = json.load(response)
            if payload.get("status") == "ok":
                return
        except Exception as exc:  # noqa: BLE001 - retry loop
            last_error = exc
        time.sleep(1)
    raise RuntimeError(f"backend not healthy at {url}: {last_error}")


def api_json(url: str) -> object:
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.load(response)


def run_live_scan(page: Page, target: str) -> None:
    """Run a live WS profile from the UI and wait for completion.

    After the SCAN click this function performs *no* user interaction; the
    wait is purely on the DOM, which is exactly what the zoneless regression
    would break.
    """
    page.goto(f"{FRONTEND}/profiler")
    page.wait_for_selector("#target-input")
    page.fill("#target-input", target)
    page.click("button.btn-scan")
    # scan start resets the phase rows from the previous run
    page.wait_for_function(
        "document.querySelectorAll('.phase-row.done').length < 4", timeout=15_000
    )
    page.wait_for_function(
        "document.querySelectorAll('.phase-row.done').length === 4", timeout=120_000
    )
    page.wait_for_function(
        "document.querySelector('.status-indicator .t-label')?.textContent?.includes('COMPLETE')",
        timeout=15_000,
    )


def run() -> int:
    wait_health(BACKEND)
    print(f"[+] Kensei backend healthy at {BACKEND}", flush=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.set_default_timeout(30_000)
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        try:
            # ── Profiler: live WS scan, phases/counters/techs without clicks ──
            print("[*] profiler: live scan against fixture", flush=True)
            run_live_scan(page, FIXTURE)
            phase_done = page.locator(".phase-row.done").count()
            check(phase_done == 4, "profiler: 4/4 phases reach DONE", f"{phase_done} done")
            metric_values = page.locator(".metrics-grid .metric-value").all_inner_texts()
            check(
                len(metric_values) == 4 and all(v.strip().isdigit() for v in metric_values),
                "profiler: metric cards rendered",
                "techs/routes/guards/jsdeps=" + "/".join(metric_values),
            )
            check(
                int(metric_values[0]) > 0,
                "profiler: technologies counter > 0 without interaction",
                f"technologies={metric_values[0]}",
            )
            check(
                int(metric_values[1]) > 0,
                "profiler: routes counter > 0 (bundle route discovery)",
                f"routes={metric_values[1]}",
            )
            # The report is fetched asynchronously after analysis_completed;
            # waiting on the DOM also proves the markForCheck fix for it.
            page.wait_for_function(
                "document.querySelectorAll('.panel.full-width .finding-row').length > 0",
                timeout=30_000,
            )
            report_rows = page.locator(".panel.full-width .finding-row").count()
            report_text = page.locator(".panel.full-width").inner_text().lower()
            check(report_rows > 0, "profiler: report findings rendered", f"{report_rows} rows")
            check(
                "react" in report_text and "angular" in report_text,
                "profiler: detected frontend technologies visible",
                "react+angular in report",
            )

            profiles = api_json(f"{BACKEND}/api/profiles")
            assert isinstance(profiles, list) and profiles, "backend returned no profiles"
            rich_profile_id = int(profiles[0]["id"])
            print(f"    backend profiles={len(profiles)} rich id={rich_profile_id}", flush=True)

            # ── Second scan (plain fixture) so compare finds real changes ────
            print("[*] profiler: second scan (plain) for compare", flush=True)
            run_live_scan(page, f"{FIXTURE}/plain.html")

            # ── History: rows visible on entry, no clicks ────────────────────
            print("[*] history: list renders on entry", flush=True)
            page.goto(f"{FRONTEND}/history")
            page.wait_for_selector(".profile-row")
            rows = page.locator(".profile-row").count()
            first_row = re.sub(r"\s+", " ", page.locator(".profile-row").first.inner_text())
            check(rows >= 2, "history: profile rows rendered without clicks", f"{rows} rows")
            check(
                FIXTURE.replace("http://", "") in first_row or "localhost:8102" in first_row,
                "history: first row shows the scanned target",
                first_row[:90],
            )

            # ── Compare: select 2 and run ────────────────────────────────────
            print("[*] history: compare two profiles", flush=True)
            checkboxes = page.locator(".profile-row .compare-cb")
            checkboxes.nth(0).check()
            checkboxes.nth(1).check()
            page.get_by_role(
                "button", name=re.compile("COMPARE SELECTED|COMPARAR SELECCION")
            ).click()
            page.wait_for_selector(".compare-panel")
            page.wait_for_function(
                "document.querySelectorAll('.compare-panel .finding-row').length > 0",
                timeout=30_000,
            )
            compare_rows = page.locator(".compare-panel .finding-row").count()
            check(compare_rows > 0, "history: compare results rendered", f"{compare_rows} rows")

            # ── Trends: chart + legend without further interaction ───────────
            print("[*] history: trends", flush=True)
            page.fill("#trend-domain", "localhost")
            page.get_by_role(
                "button", name=re.compile("LOAD TRENDS|CARGAR TENDENCIAS")
            ).click()
            page.wait_for_selector(".trends-panel", timeout=30_000)
            page.wait_for_function(
                "document.querySelector('.trend-chart path.trend-line')"
                "?.getAttribute('d')?.length > 0",
                timeout=30_000,
            )
            legend = page.locator(".trend-legend span").count()
            check(legend >= 2, "history: trends chart + legend rendered", f"{legend} points")

            # ── Inventory: deep link with ?id renders full report ────────────
            print("[*] inventory: deep link", flush=True)
            page.goto(f"{FRONTEND}/inventory?id={rich_profile_id}")
            page.wait_for_selector(".report-header")
            page.wait_for_function(
                "document.querySelectorAll('.finding-row').length > 0", timeout=30_000
            )
            inv_rows = page.locator(".finding-row").count()
            inv_header = re.sub(r"\s+", " ", page.locator(".report-header").inner_text())
            check(inv_rows > 0, "inventory: profile details rendered", f"{inv_rows} rows")
            check(
                "localhost:8102" in inv_header,
                "inventory: report header shows target",
                inv_header[:90],
            )

            # ── JS analysis: select profile, dependencies render ─────────────
            print("[*] js-analysis: dependencies", flush=True)
            page.goto(f"{FRONTEND}/js-analysis")
            page.select_option("#js-profile-select", str(rich_profile_id))
            page.wait_for_selector(".report-header")
            page.wait_for_function(
                "document.querySelectorAll('app-findings-list .finding-row').length > 0",
                timeout=30_000,
            )
            js_rows = page.locator("app-findings-list .finding-row").count()
            js_text = page.locator("app-findings-list").inner_text().lower()
            check(js_rows > 0, "js-analysis: dependency rows rendered", f"{js_rows} rows")
            check("lodash" in js_text, "js-analysis: known dependency visible", "lodash")

            # ── SPA routes: select profile, route map renders ────────────────
            print("[*] spa-routes: route map", flush=True)
            page.goto(f"{FRONTEND}/spa-routes")
            page.select_option("#spa-profile-select", str(rich_profile_id))
            page.wait_for_selector(".route-map", timeout=30_000)
            page.wait_for_function(
                "document.querySelectorAll('.route-node').length > 0", timeout=30_000
            )
            nodes = page.locator(".route-node").count()
            guard_rows = page.locator(".guards-panel .finding-row").count()
            check(nodes > 0, "spa-routes: route map nodes rendered", f"{nodes} nodes")
            check(guard_rows > 0, "spa-routes: auth guards rendered", f"{guard_rows} guards")
        finally:
            context.close()
            browser.close()

    print(f"[*] console errors: {len(console_errors)}", flush=True)
    for message in console_errors:
        print(f"    CONSOLE ERROR: {message}", flush=True)
    print(f"[*] page errors: {len(page_errors)}", flush=True)
    for message in page_errors:
        print(f"    PAGE ERROR: {message}", flush=True)

    check(not console_errors, "no console errors")
    check(not page_errors, "no page errors")

    failed = [label for ok, label, _ in results if not ok]
    print(f"\n{'PASS' if not failed else 'FAIL'}: {len(results) - len(failed)}/{len(results)} checks")
    for label in failed:
        print(f"  - {label}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(run())
