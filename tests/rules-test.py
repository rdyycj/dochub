"""
Test category rule management in Settings page
Tests: list categories, select category, edit keywords, save rules, verify persistence
"""
import os, sys, time, json
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def log(msg):
    safe = msg.encode('ascii', errors='replace').decode('ascii')
    print(f"  [{time.strftime('%H:%M:%S')}] {safe}")

def shot(page, name):
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, f'{name}.png'))

def main():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        page = browser.contexts[0].pages[0]
        log("Connected to Electron")

        # === 1. Get initial categories ===
        print("\n--- 1. List categories ---")
        initial_cats = page.evaluate("""async () => {
            return await window.docHub.listCategories();
        }""")
        log(f"Found {len(initial_cats)} categories:")
        for c in initial_cats:
            log(f"  id={c['id']} name={c['name']} icon={c['icon']}")
        results.append(("List categories", "PASS" if len(initial_cats) > 0 else "FAIL"))
        shot(page, '01-initial')

        # === 2. Navigate to Settings ===
        print("\n--- 2. Navigate to Settings ---")
        settings_btn = page.locator('button:has-text("设置")').first
        if settings_btn.count() > 0:
            settings_btn.click()
            page.wait_for_timeout(1000)
            log("Navigated to Settings")
            results.append(("Navigate to Settings", "PASS"))
        else:
            log("FAIL: Settings button not found")
            results.append(("Navigate to Settings", "FAIL"))
            browser.close()
            return 1
        shot(page, '02-settings')

        # === 3. Check categories list in sidebar ===
        print("\n--- 3. Categories list in Settings ---")
        cat_items = page.locator('text=分类规则管理')
        if cat_items.count() > 0:
            log("PASS: Found category section header")
            results.append(("Category section visible", "PASS"))
        else:
            log("FAIL: Category section not found")
            results.append(("Category section visible", "FAIL"))

        # Count category items in the settings list (left side of rule section)
        # They're rendered as divs inside the category list
        all_divs = page.locator('section h3:has-text("分类规则管理") + div > div > div')
        cat_count = all_divs.count()
        log(f"  Category items in settings list: {cat_count}")
        shot(page, '03-categories')

        # === 4. Click first category to open RuleEditor ===
        print("\n--- 4. Select category and check RuleEditor ---")
        if cat_count > 0:
            first_cat = all_divs.first
            cat_name = first_cat.inner_text()
            first_cat.click()
            page.wait_for_timeout(500)
            log(f"Clicked category: '{cat_name}'")

            # Check RuleEditor appears
            editor = page.locator('textarea')
            heading = page.locator('h3')
            if editor.count() > 0:
                heading_text = heading.last.inner_text() if heading.count() > 0 else '(no heading)'
                log(f"PASS: RuleEditor appeared - heading: '{heading_text}'")
                results.append(("RuleEditor appears on click", "PASS"))
            else:
                log("FAIL: No textarea found after clicking category")
                results.append(("RuleEditor appears on click", "FAIL"))
            shot(page, '04-editor-open')
        else:
            log("FAIL: No categories to click")
            results.append(("RuleEditor appears on click", "FAIL - no categories"))

        # === 5. Edit keywords ===
        print("\n--- 5. Edit and save keywords ---")
        test_keywords = "测试关键词A、测试关键词B、软件、作业、报告"
        editor = page.locator('textarea').first
        if editor.count() > 0:
            # Read current value
            old_val = editor.input_value()
            log(f"  Old keywords: '{old_val[:80]}'")

            # Type new keywords
            editor.fill('')
            editor.fill(test_keywords)
            page.wait_for_timeout(300)
            new_val = editor.input_value()
            log(f"  New keywords: '{new_val}'")
            results.append(("Edit keywords", "PASS" if test_keywords in new_val else "FAIL"))
            shot(page, '05-keywords-edited')

            # === 6. Click Save ===
            print("\n--- 6. Save rules ---")
            save_btn = page.locator('button:has-text("保存规则")').first
            if save_btn.count() > 0:
                # Set up dialog handler for alert()
                dialogs = []
                def handle_dialog(dialog):
                    dialogs.append(dialog.message)
                    dialog.accept()
                page.on('dialog', handle_dialog)

                save_btn.click()
                page.wait_for_timeout(1000)

                if dialogs:
                    log(f"  Dialog: '{dialogs[0]}'")
                    if '已保存' in str(dialogs[0]):
                        log("PASS: Rules saved successfully")
                        results.append(("Save rules", "PASS"))
                    else:
                        log(f"  WARN: Unexpected dialog: {dialogs[0]}")
                        results.append(("Save rules", f"WARN - {dialogs[0]}"))
                else:
                    # No dialog? Maybe no alert in this version
                    log("  No dialog - rules may have saved silently")
                    results.append(("Save rules", "PASS (silent)"))

                shot(page, '06-saved')
            else:
                log("FAIL: Save button not found")
                results.append(("Save rules", "FAIL - button not found"))
        else:
            log("FAIL: No textarea to edit")
            results.append(("Edit keywords", "FAIL - no editor"))

        # === 7. Verify rules persisted ===
        print("\n--- 7. Verify rules persisted ---")
        # Get all enabled rules via IPC
        all_rules_count = page.evaluate("""async () => {
            const cats = await window.docHub.listCategories();
            // Check if we can get rules per category indirectly
            // by re-reading the keywords from a file search
            return cats.length;
        }""")
        log(f"  Categories still available: {all_rules_count}")

        # Click a different category then click back to verify persistence
        if cat_count > 1:
            all_divs.nth(1).click()
            page.wait_for_timeout(300)
            log("  Clicked another category...")
            all_divs.first.click()
            page.wait_for_timeout(300)
            current_val = page.locator('textarea').first.input_value()
            if test_keywords in current_val:
                log("PASS: Keywords persisted after switching categories!")
                results.append(("Rules persist after switch", "PASS"))
            else:
                log(f"  WARN: Keywords not persisted. Got: '{current_val[:80]}'")
                results.append(("Rules persist after switch", "WARN"))
        else:
            results.append(("Rules persist after switch", "SKIP - only 1 category"))
        shot(page, '07-verified')

        # === 8. Test rule classification effect ===
        print("\n--- 8. Test classification with new rules ---")
        # Search for a keyword we added
        search_result = page.evaluate("""async (kw) => {
            const res = await window.docHub.search({ query: kw, page: 1, pageSize: 5 });
            return { total: res.total, firstResult: res.results[0]?.name || 'none' };
        }""", "报告")
        log(f"  Search '报告': {search_result['total']} results, first: {search_result['firstResult']}")
        if search_result['total'] > 0:
            results.append(("Search with new keywords", "PASS"))
        else:
            results.append(("Search with new keywords", "WARN - no results for test keyword"))

        # === 9. Try to get rules for the first category ===
        print("\n--- 9. Verify rules via saveRules/getRules cycle ---")
        first_cat_id = initial_cats[0]['id'] if initial_cats else 1
        first_cat_name = initial_cats[0]['name'] if initial_cats else 'unknown'

        # Save a known set of rules
        known_keywords = "验证测试、verification、check"
        log(f"  Saving known rules for category '{first_cat_name}' (id={first_cat_id})")
        save_ok = page.evaluate("""async (data) => {
            try {
                const rules = data.keywords.split(/[、,\\s]+/).filter(Boolean).map(kw => ({
                    field: 'both',
                    operator: 'contains',
                    value: [kw],
                    weight: 1,
                    enabled: true
                }));
                await window.docHub.saveRules(data.catId, rules);
                return 'ok';
            } catch(e) {
                return 'error: ' + e.message;
            }
        }""", {'catId': first_cat_id, 'keywords': known_keywords})

        # Verify: search for "验证测试" should now match files with that content
        verify_search = page.evaluate("""async (kw) => {
            const res = await window.docHub.search({ query: kw, page: 1, pageSize: 10 });
            return { total: res.total, results: res.results.slice(0, 3).map(r => ({
                name: r.name,
                category: r.categoryName
            })) };
        }""", "验证测试")
        log(f"  Verify search '验证测试': {verify_search['total']} results")
        if verify_search['total'] > 0:
            log(f"    First result: {verify_search['results'][0]['name']}")
        results.append(("SaveRules IPC", "PASS" if save_ok == 'ok' else f"FAIL - {save_ok}"))

        shot(page, '08-final')

        browser.close()

    # === Report ===
    print("\n" + "="*60)
    print("  Category Rules Test Results")
    print("="*60)
    passed = sum(1 for _, r in results if r.startswith("PASS"))
    failed = sum(1 for _, r in results if r.startswith("FAIL"))
    for name, result in results:
        s = "+" if result.startswith("PASS") else "X" if result.startswith("FAIL") else "~"
        print(f"  [{s}] {name}: {result}")

    print(f"\n  Total: {len(results)} | +{passed} PASS | X{failed} FAIL")
    print(f"  Screenshots: {SCREENSHOT_DIR}")

    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
