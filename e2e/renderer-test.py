"""Debug DocHub renderer UI content."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.add_init_script("""
        window.docHub = {
            listCategories: () => Promise.resolve([
                { id: 1, name: '合同/协议', parentId: null, icon: 'file-contract', color: '#E74C3C', priority: 10 },
                { id: 2, name: '发票/票据', parentId: null, icon: 'receipt', color: '#27AE60', priority: 5 },
            ]),
            listFiles: () => Promise.resolve({ files: [
                { id: 1, path: '/test/a.pdf', name: 'a.pdf', ext: '.pdf', size: 2048000, modifiedAt: 1750000000000, status: 'parsed' },
            ], total: 1 }),
            search: () => Promise.resolve({ results: [], total: 0 }),
            saveRules: () => Promise.resolve(),
            startWatch: () => Promise.resolve(),
            retryFile: () => Promise.resolve(),
            onStatusUpdate: (cb) => { cb({ indexed: 2, pending: 0, error: 0 }); return () => {}; },
            onFileIndexed: () => () => {},
        };
    """)

    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    root_html = page.locator('#root').inner_html()
    print(f"Root HTML length: {len(root_html)}")

    if len(root_html) < 100:
        print("BLANK PAGE - React did not render")
        # Check for errors
        with open('e2e/screenshots/error-content.html', 'w', encoding='utf-8') as f:
            f.write(page.content())
        print("Saved full HTML to e2e/screenshots/error-content.html")
    else:
        print("PAGE HAS CONTENT - React rendered successfully")
        # Check for key UI elements
        has_tabs = '文件浏览' in root_html  # 文件浏览
        has_categories = '合同' in root_html  # 合同
        has_files = 'a.pdf' in root_html
        has_status = '已索引' in root_html  # 已索引
        print(f"  Tabs: {has_tabs}, Categories: {has_categories}, Files: {has_files}, Status: {has_status}")

    page.screenshot(path='e2e/screenshots/dochub-ui.png', full_page=True)
    print("Screenshot saved")
    browser.close()
