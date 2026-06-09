"""
Test: Full-text search -> click result -> preview panel -> open/export
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    open_calls = []
    export_calls = []

    page.add_init_script("""
        window.__openCalls = [];
        window.__exportCalls = [];
        window.docHub = {
            listCategories: () => Promise.resolve([]),
            listFiles: () => Promise.resolve({ files: [], total: 0 }),
            search: (query) => {
                return Promise.resolve({
                    results: [
                        {
                            fileId: 1, name: '合同001.pdf', path: 'C:/docs/合同001.pdf',
                            ext: '.pdf', size: 2048000, modifiedAt: 1700000000000,
                            categoryName: '合同/协议',
                            snippet: '甲方<mark>合同</mark>乙方签订<mark>合同</mark>编号...',
                            highlights: ['合同']
                        },
                        {
                            fileId: 2, name: '安全阀报告.docx', path: 'C:/docs/安全阀报告.docx',
                            ext: '.docx', size: 1024000, modifiedAt: 1700100000000,
                            categoryName: '报告/汇报',
                            snippet: '<mark>报告</mark>内容安全阀校验结果汇总...',
                            highlights: ['报告']
                        },
                    ],
                    total: 2
                });
            },
            saveRules: () => Promise.resolve(),
            startWatch: () => Promise.resolve(),
            retryFile: () => Promise.resolve(),
            getPathForFile: () => '',
            openFile: (path) => {
                window.__openCalls.push(path);
                return Promise.resolve({ success: true });
            },
            exportFile: (sourcePath) => {
                window.__exportCalls.push(sourcePath);
                return Promise.resolve({ success: true, destPath: 'C:/Desktop/' + sourcePath.split('/').pop() });
            },
            onStatusUpdate: (cb) => { cb({ indexed: 2, pending: 0, error: 0 }); return () => {}; },
            onFileIndexed: () => () => {},
        };
    """)

    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(800)

    print('=== Search -> Preview -> Open/Export Test ===')
    print()

    # 1. Navigate to search
    print('1. Open search page')
    for b in page.locator('button').all():
        if '全文搜索' in (b.text_content() or ''):
            b.click()
            break
    page.wait_for_timeout(300)
    assert page.locator('input[type="text"]').first.is_visible()
    print('   PASS')

    # 2. Search
    print('2. Search for files')
    page.locator('input[type="text"]').first.fill('合同')
    page.locator('button[type="submit"]').click()
    page.wait_for_timeout(500)
    content = page.content()
    assert '合同001.pdf' in content, 'Result not found'
    assert '找到 2 个结果' in content, 'Count wrong'
    print('   PASS: 2 results found')

    # 3. Click first result -> preview panel
    print('3. Click first result to open preview panel')
    page.locator('text=合同001.pdf').first.click()
    page.wait_for_timeout(400)
    panel_content = page.content()
    assert '合同/协议' in panel_content, 'Category not in panel'
    assert '2048000' in panel_content or '2.0 MB' in panel_content or 'KB' in panel_content, 'File size not in panel'
    assert '📂 打开文件' in panel_content, 'Open button missing'
    assert '💾 导出到...' in panel_content, 'Export button missing'
    print('   PASS: preview panel with category, size, buttons')

    # 4. Click second result -> panel updates
    print('4. Click second result to switch preview')
    page.locator('text=安全阀报告.docx').first.click()
    page.wait_for_timeout(400)
    panel_content = page.content()
    assert '报告/汇报' in panel_content, 'Category not updated'
    assert '💾 导出到...' in panel_content, 'Export button missing after switch'
    print('   PASS: panel updated to second file')

    # 5. Test openFile via panel button
    print('5. Click "Open file" button')
    page.locator('button:has-text("打开文件")').click()
    page.wait_for_timeout(300)
    open_count = page.evaluate("window.__openCalls.length")
    assert open_count >= 1, f'openFile not called, count={open_count}'
    last_open = page.evaluate("window.__openCalls[window.__openCalls.length-1]")
    assert '安全阀报告.docx' in last_open, f'Wrong file opened: {last_open}'
    print(f'   PASS: openFile called for {last_open}')

    # 6. Test exportFile via panel button
    print('6. Click "Export" button')
    page.locator('button:has-text("导出到")').click()
    page.wait_for_timeout(300)
    export_count = page.evaluate("window.__exportCalls.length")
    assert export_count >= 1, f'exportFile not called, count={export_count}'
    last_export = page.evaluate("window.__exportCalls[window.__exportCalls.length-1]")
    assert '安全阀报告.docx' in last_export, f'Wrong file exported: {last_export}'
    print(f'   PASS: exportFile called for {last_export}')

    # Screenshot
    page.screenshot(path='e2e/screenshots/search-preview-export.png', full_page=True)
    print()
    print('Screenshot: e2e/screenshots/search-preview-export.png')
    print()
    print('ALL 6 TESTS PASSED')

    browser.close()
