"""
Verify that monitored directory files are indexed in the system
Checks: file count, parse status, categories, FTS search
"""
import os, sys, time, json
from playwright.sync_api import sync_playwright

MONITOR_DIR = r"C:\Users\Administrator\Desktop\软件课设作业"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')

def log(msg):
    safe = msg.encode('ascii', errors='replace').decode('ascii')
    print(f"  [{time.strftime('%H:%M:%S')}] {safe}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        page = browser.contexts[0].pages[0]

        print("\n" + "="*60)
        print("  Verify: Monitored Files Indexed in System")
        print(f"  Directory: {MONITOR_DIR}")
        print("="*60)

        # === 1. List ALL files via IPC ===
        print("\n--- 1. All files in database ---")
        all_files = page.evaluate("""async () => {
            const res = await window.docHub.listFiles({ categoryId: undefined, page: 1, pageSize: 10000 });
            return { total: res.total, files: res.files };
        }""")
        print(f"  Total files in DB: {all_files['total']}")

        # === 2. Check which files are from the monitored directory ===
        print(f"\n--- 2. Files from monitored directory ---")

        # Get files specifically from the monitored path
        monitored_files_info = page.evaluate("""async (dir) => {
            const res = await window.docHub.listFiles({ categoryId: undefined, page: 1, pageSize: 10000 });
            const fromDir = res.files.filter(f => f.path.toLowerCase().startsWith(dir.toLowerCase()));
            return {
                count: fromDir.length,
                files: fromDir.map(f => ({
                    name: f.name,
                    path: f.path,
                    size: f.size,
                    status: f.status,
                    categoryId: f.categoryId,
                    ext: f.ext
                })).slice(0, 50)  // first 50
            };
        }""", MONITOR_DIR)

        count = monitored_files_info['count']
        files = monitored_files_info['files']

        print(f"  Files from monitored dir: {count}")

        if count == 0:
            print("\n  *** No files from this directory found! ***")
            print("  Checking if directory was actually monitored...")

            # List all file paths to see what's there
            some_paths = page.evaluate("""async () => {
                const res = await window.docHub.listFiles({ categoryId: undefined, page: 1, pageSize: 20 });
                return res.files.map(f => f.path);
            }""")
            print(f"  Sample paths in DB:")
            for p in some_paths[:10]:
                print(f"    {p}")
            browser.close()
            return 1

        # Show file details
        parsed_count = sum(1 for f in files if f['status'] == 'parsed')
        pending_count = sum(1 for f in files if f['status'] == 'pending')
        error_count = sum(1 for f in files if f['status'] == 'error')

        print(f"  Status breakdown:")
        print(f"    Parsed (indexed): {parsed_count}")
        print(f"    Pending:          {pending_count}")
        print(f"    Error:            {error_count}")

        print(f"\n  File list (first 20):")
        for i, f in enumerate(files[:20]):
            status_icon = '+' if f['status'] == 'parsed' else '~' if f['status'] == 'pending' else 'X'
            size_kb = f['size'] / 1024
            print(f"    [{status_icon}] {f['name']} ({size_kb:.0f}KB) [{f['ext']}] status={f['status']} cat_id={f['categoryId']}")

        # === 3. Check file detail view in the app ===
        print(f"\n--- 3. Navigate to browse page and check ---")

        # Click browse tab
        browse_btn = page.locator('button:has-text("文件浏览")').first
        if browse_btn.count() > 0:
            browse_btn.click()
            page.wait_for_timeout(2000)

        # Take screenshot of file list
        screenshot_path = os.path.join(SCREENSHOT_DIR, 'verify-files.png')
        page.screenshot(path=screenshot_path)
        print(f"  Screenshot: {screenshot_path}")

        # === 4. Check index status ===
        print(f"\n--- 4. Index Status ---")
        status = page.evaluate("""async () => {
            return new Promise((resolve) => {
                // Get status via the hook mechanism
                const unsubscribe = window.docHub.onStatusUpdate((s) => {
                    unsubscribe();
                    resolve(s);
                });
            });
        }""")
        print(f"  Indexed: {status['indexed']}")
        print(f"  Pending: {status['pending']}")
        print(f"  Error:   {status['error']}")

        # === 5. Test full-text search on monitored files ===
        print(f"\n--- 5. Full-text search test ---")

        # Try a few search queries
        for query in ['作业', '报告', '软件']:
            result = page.evaluate("""async (q) => {
                const res = await window.docHub.search({ query: q, page: 1, pageSize: 5 });
                return { total: res.total, names: res.results.map(r => r.name) };
            }""", query)
            if result['total'] > 0:
                print(f"  Search '{query}': {result['total']} results")
                for n in result['names'][:3]:
                    print(f"    - {n}")
            else:
                print(f"  Search '{query}': 0 results")

        # === 6. Check categories ===
        print(f"\n--- 6. Category classification ---")
        cats = page.evaluate("""async () => {
            return await window.docHub.listCategories();
        }""")
        print(f"  Categories: {len(cats)}")
        for c in cats[:10]:
            # Count files per category
            count = page.evaluate("""async (catId) => {
                const res = await window.docHub.listFiles({ categoryId: catId, page: 1, pageSize: 10000 });
                return res.total;
            }""", c['id'])
            print(f"    {c['name']}: {count} files")

        # === 7. Check the database directly ===
        print(f"\n--- 7. Direct DB verification ---")
        db_info = page.evaluate("""async () => {
            const res = await window.docHub.listFiles({ categoryId: undefined, page: 1, pageSize: 5 });
            // Show some files and their parse status
            return res.files.map(f => ({
                name: f.name,
                hasContentHash: f.contentHash !== null,
                hasText: f.indexedAt !== null,
                status: f.status
            }));
        }""")
        print(f"  Sample file details:")
        for f in db_info[:5]:
            print(f"    {f['name']}: hash={f['hasContentHash']}, indexed={f['hasText']}, status={f['status']}")

        # Summary
        print(f"\n{'='*60}")
        print(f"  VERIFICATION RESULT")
        print(f"{'='*60}")

        file_ok = count > 0
        parsed_ok = parsed_count > 0
        total_ok = all_files['total'] > 0

        print(f"  Files found from monitored dir: {'PASS' if file_ok else 'FAIL'} ({count} files)")
        print(f"  Files parsed/indexed:          {'PASS' if parsed_ok else 'FAIL'} ({parsed_count}/{count} parsed)")
        print(f"  Database has files:            {'PASS' if total_ok else 'FAIL'} ({all_files['total']} total)")

        if file_ok and parsed_ok:
            print(f"\n  => Monitoring IS working. Files are being indexed.")
        elif file_ok and not parsed_ok:
            print(f"\n  => Files found but not yet parsed. May be still processing...")
        else:
            print(f"\n  => Files from this directory NOT found in DB.")
            print(f"     The 'startWatch' may have failed silently.")
            print(f"     Check: is the directory readable? Does it have supported files?")

        browser.close()
        return 0 if (file_ok and parsed_ok) else 1

if __name__ == '__main__':
    sys.exit(main())
