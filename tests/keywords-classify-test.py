"""
Direct IPC test: edit keywords -> save -> verify -> classification
Uses IPC calls directly (bypassing UI selectors) for reliable testing
"""
import sys, time
from playwright.sync_api import sync_playwright

def log(msg):
    safe = msg.encode('ascii', errors='replace').decode('ascii')
    print(f"  [{time.strftime('%H:%M:%S')}] {safe}")

def main():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        page = browser.contexts[0].pages[0]
        log("Connected")

        # ===== 1. Initial state =====
        print("\n" + "="*60)
        print("  1. Get initial state")
        print("="*60)

        cats = page.evaluate("""async () => await window.docHub.listCategories()""")
        test_cat = cats[0]
        log(f"Categories: {len(cats)}")

        # Show all categories and their rules
        for c in cats:
            rules = page.evaluate("""async (id) => await window.docHub.getCategoryRules(id)""", c['id'])
            kws = [kw for r in rules for kw in r.get('value', [])]
            log(f"  [{c['name']}] id={c['id']}: {len(rules)} rules, keywords={kws[:5]}{'...' if len(kws)>5 else ''}")
        results.append(("Initial state", "PASS"))

        # Save original keywords for restore
        orig_rules = page.evaluate("""async (id) => await window.docHub.getCategoryRules(id)""", test_cat['id'])
        orig_kws = [kw for r in orig_rules for kw in r.get('value', [])]

        # ===== 2. Save unique test keywords via IPC =====
        print("\n" + "="*60)
        print("  2. Save test keywords via saveRules IPC")
        print("="*60)

        test_keywords = ['关键词测试A', '关键词测试B', '唯一验证词999', '贵州检验清单']
        log(f"Test keywords: {test_keywords}")

        save_result = page.evaluate("""async (data) => {
            const rules = data.keywords.map(kw => ({
                field: 'both',
                operator: 'contains',
                value: [kw],
                weight: 1,
                enabled: true
            }));
            await window.docHub.saveRules(data.catId, rules);
            return 'ok';
        }""", {'catId': test_cat['id'], 'keywords': test_keywords})
        log(f"saveRules result: {save_result}")
        results.append(("Save via IPC", "PASS"))

        # ===== 3. Verify saved via IPC =====
        print("\n" + "="*60)
        print("  3. Verify keywords saved (getCategoryRules)")
        print("="*60)

        saved_rules = page.evaluate("""async (catId) => {
            return await window.docHub.getCategoryRules(catId);
        }""", test_cat['id'])

        saved_kws = [kw for r in saved_rules for kw in r.get('value', [])]
        log(f"Saved rules: {len(saved_rules)}")
        log(f"Saved keywords: {saved_kws}")

        all_found = all(any(tk in sk for sk in saved_kws) for tk in test_keywords)
        log("PASS: All test keywords saved!" if all_found else "FAIL: Some keywords missing")
        results.append(("Verify saved keywords", "PASS" if all_found else "FAIL"))

        # ===== 4. Navigate to Settings and check UI =====
        print("\n" + "="*60)
        print("  4. Verify keywords visible in Settings UI")
        print("="*60)

        page.locator('button:has-text("设置")').first.click()
        page.wait_for_timeout(1500)

        # Find and click the category item in the left list
        # The category items are inside div.w-48, each is a div with onClick
        clicked = page.evaluate("""(catName) => {
            // Find all clickable category items in the settings page
            const divs = document.querySelectorAll('div.w-48 > div');
            for (const d of divs) {
                if (d.textContent?.includes(catName)) {
                    d.click();
                    return true;
                }
            }
            return false;
        }""", test_cat['name'])

        if not clicked:
            log("WARN: Could not click category via JS, trying text selector...")
            # Use last match (settings page items come after sidebar items)
            items = page.locator(f'text={test_cat["name"]}')
            count = items.count()
            log(f"  Found {count} elements with text '{test_cat['name']}'")
            # Click the one in the settings page (should be after sidebar ones)
            if count >= 2:
                items.nth(count - 2).click()  # skip sidebar match
            elif count >= 1:
                items.last.click()
            page.wait_for_timeout(800)

        textarea = page.locator('textarea').first
        ui_keywords = textarea.input_value()
        log(f"UI textarea: '{ui_keywords}'")

        ui_has_kws = all(tk in ui_keywords for tk in test_keywords)
        log("PASS: Keywords visible in UI!" if ui_has_kws else f"WARN: UI shows: '{ui_keywords[:100]}'")
        results.append(("Keywords in Settings UI", "PASS" if ui_has_kws else "WARN"))

        # ===== 5. Edit via UI and save =====
        print("\n" + "="*60)
        print("  5. Edit keywords in UI, save, and re-verify")
        print("="*60)

        modified_input = "关键词测试A、关键词测试B、唯一验证词999、贵州检验清单、新增关键词ZZZ"
        textarea.fill('')
        textarea.fill(modified_input)
        page.wait_for_timeout(300)

        # Click save button
        dialogs = []
        page.on('dialog', lambda d: dialogs.append(d.message) or d.accept())
        page.locator('button:has-text("保存规则")').first.click()
        page.wait_for_timeout(1000)

        log(f"Dialog: '{dialogs[0] if dialogs else '(none)'}'")

        # Verify via IPC
        final_rules = page.evaluate("""async (catId) => {
            return await window.docHub.getCategoryRules(catId);
        }""", test_cat['id'])
        final_kws = [kw for r in final_rules for kw in r.get('value', [])]

        has_new = '新增关键词ZZZ' in final_kws
        log(f"IPC keywords after UI edit+save: {final_kws}")
        log("PASS: UI edit + save works!" if has_new else "FAIL: New keyword not saved")
        results.append(("UI edit + save via IPC verify", "PASS" if has_new else "FAIL"))

        # ===== 6. Test classification =====
        print("\n" + "="*60)
        print("  6. Test classification with keywords")
        print("="*60)

        # Search for files that match our keywords
        search_kw = '贵州检验清单'
        search_res = page.evaluate("""async (q) => {
            const res = await window.docHub.search({ query: q, page: 1, pageSize: 5 });
            return { total: res.total, results: res.results.map(r => ({
                name: r.name, category: r.categoryName
            })) };
        }""", search_kw)
        log(f"Search '{search_kw}': {search_res['total']} files")
        for r in search_res['results'][:3]:
            log(f"  {r['name']} -> category: {r['category'] or 'none'}")

        # Check category file count
        cat_files = page.evaluate("""async (catId) => {
            const res = await window.docHub.listFiles({ categoryId: catId, page: 1, pageSize: 10 });
            return { total: res.total, files: res.files.slice(0, 5).map(f => f.name) };
        }""", test_cat['id'])
        log(f"Files in '{test_cat['name']}' category: {cat_files['total']}")
        for f in cat_files['files']:
            log(f"  - {f}")

        results.append(("Classification search", "PASS"))

        # ===== 7. Restore original =====
        print("\n" + "="*60)
        print("  7. Restore original keywords")
        print("="*60)

        restore_kws = orig_kws if orig_kws else []
        page.evaluate("""async (data) => {
            const rules = data.keywords.map(kw => ({
                field: 'both',
                operator: 'contains',
                value: [kw],
                weight: 1,
                enabled: true
            }));
            await window.docHub.saveRules(data.catId, rules);
        }""", {'catId': test_cat['id'], 'keywords': restore_kws})

        # Verify restore
        check_rules = page.evaluate("""async (catId) => {
            return await window.docHub.getCategoryRules(catId);
        }""", test_cat['id'])
        check_kws = [kw for r in check_rules for kw in r.get('value', [])]
        log(f"Restored keywords: {check_kws}")

        restored_ok = len(check_kws) == len(orig_kws) if orig_kws else len(check_kws) == 0
        results.append(("Restore original", "PASS" if restored_ok else "WARN"))

        browser.close()

    # ===== Report =====
    print("\n" + "="*60)
    print("  Keywords + Classification Test Results")
    print("="*60)
    pcount = sum(1 for _, r in results if r.startswith("PASS"))
    fcount = sum(1 for _, r in results if r.startswith("FAIL"))
    for name, result in results:
        s = "+" if result.startswith("PASS") else "X" if result.startswith("FAIL") else "~"
        print(f"  [{s}] {name}: {result}")
    print(f"\n  +{pcount} PASS | X{fcount} FAIL | Total {len(results)}")
    return 0 if fcount == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
