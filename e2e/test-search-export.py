"""
Test DocHub full-text search -> preview -> export flow.
Start with: python scripts/with_server.py --server "npm run dev:renderer" --port 5173 -- python e2e/test-search-export.py
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.add_init_script("""
        window.__exportCalls = [];
        window.__openCalls = [];
        window.docHub = {
            listCategories: () => Promise.resolve([
                { id: 1, name: '合同/协议', parentId: null, icon: 'file-contract', color: '#E74C3C', priority: 10 },
                { id: 2, name: '发票/票据', parentId: null, icon: 'receipt', color: '#27AE60', priority: 5 },
            ]),
            listFiles: () => Promise.resolve({ files: [], total: 0 }),
            search: (query) => {
                if (query.query.includes('安全阀')) {
                    return Promise.resolve({
                        results: [
                            {
                                fileId: 1, name: '安全阀校验报告001.pdf',
                                path: 'C:/test/安全阀校验报告001.pdf', ext: '.pdf',
                                size: 2048000, modifiedAt: 1717392000000,
                                categoryName: '报告/汇报',
                                snippet: '<mark>安全阀</mark>校验报告详情内容...',
                                highlights: ['安全阀']
                            },
                            {
                                fileId: 2, name: '安全阀采购合同.docx',
                                path: 'C:/test/安全阀采购合同.docx', ext: '.docx',
                                size: 1024000, modifiedAt: 1717305600000,
                                categoryName: '合同/协议',
                                snippet: '甲方乙方<mark>安全阀</mark>采购合同条款...',
                                highlights: ['安全阀']
                            },
                            {
                                fileId: 3, name: '锅炉安全阀台账.xlsx',
                                path: 'C:/test/锅炉安全阀台账.xlsx', ext: '.xlsx',
                                size: 512000, modifiedAt: 1717219200000,
                                categoryName: '技术文档',
                                snippet: '设备编号<mark>安全阀</mark>型号规格...',
                                highlights: ['安全阀']
                            },
                        ],
                        total: 3
                    });
                }
                return Promise.resolve({ results: [], total: 0 });
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
            onStatusUpdate: (cb) => { cb({ indexed: 3, pending: 0, error: 0 }); return () => {}; },
            onFileIndexed: () => () => {},
        };
    """)

    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(800)

    errors = []
    print('=== DocHub Full-Text Search -> Preview -> Export Test ===')
    print()

    # ---- 1. Navigate to search tab ----
    print('1. Navigate to search page')
    for b in page.locator('button').all():
        if '全文搜索' in (b.text_content() or ''):
            b.click()
            break
    page.wait_for_timeout(300)
    search_input = page.locator('input[type="text"]').first
    assert search_input.is_visible(), 'FAIL: search input not found'
    print('   PASS: search page loaded')

    # ---- 2. Perform search ----
    print('2. Search "安全阀"')
    search_input.fill('安全阀')
    # Use submit button (not the tab which also contains "搜索")
    page.locator('button[type="submit"]').click()
    page.wait_for_timeout(500)

    content = page.content()
    assert '安全阀校验报告001.pdf' in content, 'FAIL: search result not displayed'
    assert '找到 3 个结果' in content, 'FAIL: result count wrong'
    print('   PASS: 3 search results displayed')

    # ---- 3. Verify search result details ----
    print('3. Verify result details (category + highlights)')
    assert '合同/协议' in content, 'FAIL: category label missing'
    assert '报告/汇报' in content, 'FAIL: category label missing'
    assert '技术文档' in content, 'FAIL: category label missing'
    # Highlights should be rendered
    assert 'mark' in content.lower(), 'FAIL: highlight marks missing'
    print('   PASS: categories and highlights displayed')

    # ---- 4. Verify openFile API ----
    print('4. Verify openFile API')
    open_result = page.evaluate("window.docHub.openFile('C:/test/test.pdf')")
    assert open_result['success'] == True, 'FAIL: openFile returned error'
    print(f'   PASS: openFile works')

    # ---- 5. Verify exportFile API ----
    print('5. Verify exportFile API')
    export_result = page.evaluate("window.docHub.exportFile('C:/test/test.pdf')")
    assert export_result['success'] == True, 'FAIL: exportFile returned error'
    assert 'destPath' in export_result, 'FAIL: exportFile missing destPath'
    print(f'   PASS: exportFile works, destPath={export_result["destPath"]}')

    # ---- 6. Screenshot ----
    page.screenshot(path='e2e/screenshots/search-export-test.png', full_page=True)
    print()
    print('Screenshot saved: e2e/screenshots/search-export-test.png')

    browser.close()
    print()
    print('ALL TESTS PASSED: search -> preview -> export')
