"""
Test: Multi-directory watch — add two directories incrementally.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    watch_calls = []
    current_paths = []

    page.add_init_script("""
        window.__watchPaths = [];
        window.docHub = {
            listCategories: () => Promise.resolve([]),
            listFiles: () => Promise.resolve({ files: [], total: 0 }),
            search: () => Promise.resolve({ results: [], total: 0 }),
            saveRules: () => Promise.resolve(),
            startWatch: (dirs) => {
                // Merge new dirs with existing
                for (const d of dirs) {
                    if (!window.__watchPaths.includes(d)) window.__watchPaths.push(d);
                }
                return Promise.resolve([...window.__watchPaths]);
            },
            retryFile: () => Promise.resolve(),
            getPathForFile: () => '',
            openFile: () => Promise.resolve({ success: true }),
            exportFile: () => Promise.resolve({ success: true, destPath: 'C:/test.pdf' }),
            onStatusUpdate: (cb) => { cb({ indexed: 0, pending: 0, error: 0 }); return () => {}; },
            onFileIndexed: () => () => {},
        };
    """)

    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(800)

    print('=== Multi-Directory Watch Test ===')
    print()

    # 1. Open settings
    print('1. Open settings page')
    for b in page.locator('button').all():
        if '设置' in (b.text_content() or ''):
            b.click()
            break
    page.wait_for_timeout(300)
    assert page.locator('text=监控目录').is_visible()
    print('   PASS')

    # 2. Add first directory
    print('2. Add first directory "C:/Docs/Contracts"')
    textarea = page.locator('textarea').first
    textarea.fill('C:/Docs/Contracts')
    page.locator('button:has-text("开始监控")').click()
    page.wait_for_timeout(500)

    paths = page.evaluate("window.__watchPaths")
    assert len(paths) == 1, f'Expected 1 path, got {len(paths)}'
    assert 'C:/Docs/Contracts' in paths[0], f'Wrong path: {paths}'
    # Textarea should show the merged paths
    ta_content = textarea.input_value()
    assert 'C:/Docs/Contracts' in ta_content, f'Textarea not updated: {ta_content}'
    print(f'   PASS: {len(paths)} directory monitored')

    # 3. Add second directory without losing first
    print('3. Add second directory "D:/Reports"')
    textarea.fill('D:/Reports')
    page.locator('button:has-text("开始监控")').click()
    page.wait_for_timeout(500)

    paths = page.evaluate("window.__watchPaths")
    assert len(paths) == 2, f'Expected 2 paths, got {len(paths)}'
    assert 'C:/Docs/Contracts' in paths, 'First directory lost!'
    assert 'D:/Reports' in paths, 'Second directory not added!'
    ta_content = textarea.input_value()
    assert 'C:/Docs/Contracts' in ta_content, 'First dir missing from textarea'
    assert 'D:/Reports' in ta_content, 'Second dir missing from textarea'
    print(f'   PASS: {len(paths)} directories monitored, both preserved')

    # 4. Add duplicate directory (should be deduplicated)
    print('4. Add duplicate "C:/Docs/Contracts" (should skip)')
    textarea.fill('C:/Docs/Contracts')
    page.locator('button:has-text("开始监控")').click()
    page.wait_for_timeout(500)

    paths = page.evaluate("window.__watchPaths")
    assert len(paths) == 2, f'Duplicate should be skipped, got {len(paths)} paths'
    print(f'   PASS: duplicate skipped, still {len(paths)} directories')

    # 5. Screenshot
    page.screenshot(path='e2e/screenshots/multi-watch.png', full_page=True)
    print()
    print('Screenshot: e2e/screenshots/multi-watch.png')
    print()
    print('ALL 4 TESTS PASSED')

    browser.close()
