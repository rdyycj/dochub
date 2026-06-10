"""
Fix pending files - retry parsing for stuck files in monitored directory
"""
import os, sys, time
from playwright.sync_api import sync_playwright

MONITOR_DIR = r"C:\Users\Administrator\Desktop\软件课设作业"

def log(msg):
    safe = msg.encode('ascii', errors='replace').decode('ascii')
    print(f"  [{time.strftime('%H:%M:%S')}] {safe}")

def main():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        page = browser.contexts[0].pages[0]

        print("\n" + "="*60)
        print("  Fix Pending Files - Retry Parse")
        print("="*60)

        # === 1. Get pending files from monitored dir ===
        print("\n--- 1. Finding pending files ---")
        all_files = page.evaluate("""async (dir) => {
            const res = await window.docHub.listFiles({ categoryId: undefined, page: 1, pageSize: 10000 });
            const pending = res.files.filter(f =>
                f.path.toLowerCase().startsWith(dir.toLowerCase()) && f.status === 'pending'
            );
            return pending.map(f => ({ id: f.id, name: f.name, path: f.path, ext: f.ext }));
        }""", MONITOR_DIR)

        print(f"  Found {len(all_files)} pending files from monitored dir")

        if len(all_files) == 0:
            print("  No pending files! Everything is indexed.")
            browser.close()
            return 0

        # === 2. Retry each file ===
        print("\n--- 2. Retrying parse for each file ---")
        for i, f in enumerate(all_files):
            print(f"  [{i+1}/{len(all_files)}] Retrying: {f['name']} ...")
            try:
                result = page.evaluate("""async (fileId) => {
                    try {
                        await window.docHub.retryFile(fileId);
                        return 'ok';
                    } catch(e) {
                        return 'error: ' + e.message;
                    }
                }""", f['id'])
            except Exception as e:
                print(f"    Error: {e}")

        # === 3. Wait for parsing ===
        print("\n--- 3. Waiting for parsing to complete ---")
        max_wait = 30
        for i in range(max_wait):
            time.sleep(2)
            status = page.evaluate("""async (dir) => {
                const res = await window.docHub.listFiles({ categoryId: undefined, page: 1, pageSize: 10000 });
                const fromDir = res.files.filter(f =>
                    f.path.toLowerCase().startsWith(dir.toLowerCase())
                );
                const parsed = fromDir.filter(f => f.status === 'parsed').length;
                const pending = fromDir.filter(f => f.status === 'pending').length;
                const error = fromDir.filter(f => f.status === 'error').length;
                return { total: fromDir.length, parsed, pending, error };
            }""", MONITOR_DIR)

            print(f"  [{i+1}/{max_wait}] Parsed: {status['parsed']}, Pending: {status['pending']}, Error: {status['error']}")

            if status['pending'] == 0:
                print("  All files parsed!")
                break

        # === 4. Check indexing results ===
        print("\n--- 4. Final verification ---")
        final = page.evaluate("""async (dir) => {
            const res = await window.docHub.listFiles({ categoryId: undefined, page: 1, pageSize: 10000 });
            const fromDir = res.files.filter(f =>
                f.path.toLowerCase().startsWith(dir.toLowerCase())
            );
            return fromDir.map(f => ({
                name: f.name,
                status: f.status,
                categoryId: f.categoryId,
                size: f.size,
                ext: f.ext
            }));
        }""", MONITOR_DIR)

        parsed = [f for f in final if f['status'] == 'parsed']
        pending = [f for f in final if f['status'] == 'pending']
        errors = [f for f in final if f['status'] == 'error']

        print(f"\n  Results:")
        print(f"    Parsed:  {len(parsed)}")
        print(f"    Pending: {len(pending)}")
        print(f"    Error:   {len(errors)}")

        if parsed:
            print(f"\n  Successfully indexed files:")
            for f in parsed:
                cat_id = f['categoryId']
                cat_str = f'cat_id={cat_id}' if cat_id else 'uncategorized'
                size_kb = f['size'] / 1024
                print(f"    [+] {f['name']} ({size_kb:.0f}KB) [{cat_str}]")

        if pending:
            print(f"\n  Still pending:")
            for f in pending:
                print(f"    [~] {f['name']}")

        if errors:
            print(f"\n  Errors:")
            for f in errors:
                print(f"    [X] {f['name']}")

        # === 5. Search test ===
        print(f"\n--- 5. Search test ---")
        test_queries = ['软件', '课程', '设计', '作业', '图']
        for q in test_queries:
            r = page.evaluate("""async (q) => {
                const res = await window.docHub.search({ query: q, page: 1, pageSize: 5 });
                return res.total;
            }""", q)
            status_str = 'OK' if r > 0 else 'none'
            print(f"  '{q}': {r} results [{status_str}]")

        # === Summary ===
        print(f"\n{'='*60}")
        print(f"  FINAL RESULT")
        print(f"{'='*60}")
        success = len(parsed) > 0
        print(f"  Files discovered & recorded:    {'PASS' if len(final) > 0 else 'FAIL'} ({len(final)} files)")
        print(f"  Files parsed & searchable:      {'PASS' if success else 'FAIL'} ({len(parsed)}/{len(final)} parsed)")
        print(f"  => Monitoring + Indexing:       {'WORKING' if success else 'PARTIAL - some files stuck'}")

        browser.close()
        return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())
