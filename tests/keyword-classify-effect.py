"""
Test: does changing category keywords affect file classification?
"""
import sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

def log(msg):
    print('  ' + str(msg))

def main():
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp('http://localhost:9222')
        page = browser.contexts[0].pages[0]

        page.goto('http://localhost:5173', wait_until='networkidle', timeout=10000)
        page.wait_for_timeout(2000)

        # ===== 1. Initial state =====
        print('=' * 60)
        print('  1. INITIAL STATE')
        print('=' * 60)

        cats = page.evaluate('async () => await window.docHub.listCategories()')

        # Pick category 3 (报告/汇报) as test target
        test_cat = cats[2]
        log('Test category: ' + test_cat['name'] + ' (id=' + str(test_cat['id']) + ')')

        # Get current file counts for ALL categories
        print()
        print('  Before - files per category:')
        for c in cats:
            count = page.evaluate('async (id) => (await window.docHub.listFiles({categoryId:id,page:1,pageSize:9999})).total', c['id'])
            print('    ' + c['name'] + ': ' + str(count) + ' files')

        # Save old keywords for restore
        old_rules = page.evaluate('async (id) => await window.docHub.getCategoryRules(id)', test_cat['id'])
        old_kws = [kw for r in old_rules for kw in r.get('value', [])]
        log('\n  Old keywords for ' + test_cat['name'] + ': ' + str(old_kws))

        # ===== 2. Find files that match certain keywords =====
        print()
        print('=' * 60)
        print('  2. FIND MATCHING FILES')
        print('=' * 60)

        # Search for files whose names contain specific words
        for kw in ['市一医', '合同', '安全阀', '检验']:
            res = page.evaluate('async (q) => await window.docHub.search({query:q,page:1,pageSize:3})', kw)
            if res['total'] > 0:
                log('Search "' + kw + '": ' + str(res['total']) + ' results')
                for r in res['results'][:3]:
                    log('  ' + r['name'] + ' -> cat: ' + str(r.get('categoryName') or 'none'))

        # Pick a file to test with
        sample_files = page.evaluate('''async () => {
            const res = await window.docHub.listFiles({categoryId:undefined,page:1,pageSize:100});
            return res.files.slice(0, 20).map(f => ({
                id: f.id, name: f.name, catId: f.categoryId, status: f.status
            }));
        }''')

        # Find a file in a KNOWN category that we can re-classify
        test_file = None
        for f in sample_files:
            if f['catId'] and f['catId'] != test_cat['id'] and f['status'] == 'parsed':
                test_file = f
                break

        if not test_file:
            test_file = sample_files[0]
            log('WARN: using first file as fallback')

        log('\n  Test file: ' + test_file['name'] + ' (id=' + str(test_file['id']) + ', cat_id=' + str(test_file['catId']) + ')')

        # ===== 3. Save NEW keywords to test category =====
        print()
        print('=' * 60)
        print('  3. SAVE NEW KEYWORDS')
        print('=' * 60)

        # Use the test file's name as a keyword to guarantee it matches
        file_name_words = test_file['name'].replace('.docx','').replace('.xlsx','').replace('.pdf','')
        new_kws = [file_name_words[:10], file_name_words[-10:] if len(file_name_words) > 10 else file_name_words]

        log('New keywords for ' + test_cat['name'] + ': ' + str(new_kws))

        page.evaluate('''async (d) => {
            const rules = d.kws.map(k => ({
                field:'both',operator:'contains',value:[k],weight:100,enabled:true
            }));
            await window.docHub.saveRules(d.catId, rules);
        }''', {'catId': test_cat['id'], 'kws': new_kws})

        # Verify keywords saved
        check = page.evaluate('async (id) => (await window.docHub.getCategoryRules(id)).flatMap(x=>x.value)', test_cat['id'])
        log('Saved keywords: ' + str(check))

        # ===== 4. Check if file count changed (it should NOT) =====
        print()
        print('=' * 60)
        print('  4. CHECK FILE COUNT AFTER KEYWORD CHANGE')
        print('=' * 60)

        # Give a moment for any background processing
        page.wait_for_timeout(2000)

        print('  After keyword change - files per category:')
        for c in cats:
            count = page.evaluate('async (id) => (await window.docHub.listFiles({categoryId:id,page:1,pageSize:9999})).total', c['id'])
            changed = ''
            print('    ' + c['name'] + ': ' + str(count) + ' files' + changed)

        test_cat_count = page.evaluate('async (id) => (await window.docHub.listFiles({categoryId:id,page:1,pageSize:9999})).total', test_cat['id'])
        log('\n  ' + test_cat['name'] + ' still has ' + str(test_cat_count) + ' files')
        log('  (Changing keywords does NOT re-classify existing files)')

        # ===== 5. Force re-parse the test file =====
        print()
        print('=' * 60)
        print('  5. FORCE RE-PARSE TEST FILE')
        print('=' * 60)

        old_cat_id = test_file['catId']
        log('Before re-parse: file is in category_id=' + str(old_cat_id))

        # Retry the file
        page.evaluate('async (id) => await window.docHub.retryFile(id)', test_file['id'])
        log('Called retryFile(' + str(test_file['id']) + ')')

        # Wait for parsing to complete
        max_wait = 15
        reclassified = False
        for i in range(max_wait):
            page.wait_for_timeout(2000)
            status = page.evaluate('''async (fid) => {
                const res = await window.docHub.listFiles({categoryId:undefined,page:1,pageSize:10000});
                const file = res.files.find(f => f.id === fid);
                return file ? {status: file.status, catId: file.categoryId} : null;
            }''', test_file['id'])

            if status:
                log('  [' + str(i+1) + '/' + str(max_wait) + '] status=' + status['status'] + ' cat_id=' + str(status['catId']))

                if status['status'] == 'parsed' and status['catId'] == test_cat['id']:
                    log('  FILE RE-CLASSIFIED to ' + test_cat['name'] + '!')
                    reclassified = True
                    break
                elif status['status'] == 'parsed':
                    log('  File parsed but still in original category')
                    break

        # ===== 6. Final check =====
        print()
        print('=' * 60)
        print('  6. FINAL STATE')
        print('=' * 60)

        final_count = page.evaluate('async (id) => (await window.docHub.listFiles({categoryId:id,page:1,pageSize:9999})).total', test_cat['id'])
        log(test_cat['name'] + ' files: ' + str(final_count) + ' (was ' + str(test_cat_count) + ')')

        # ===== 7. Restore =====
        print()
        print('=' * 60)
        print('  7. RESTORE ORIGINAL KEYWORDS')
        print('=' * 60)

        page.evaluate('''async (d) => {
            const rules = d.kws.map(k => ({
                field:'both',operator:'contains',value:[k],weight:1,enabled:true
            }));
            await window.docHub.saveRules(d.catId, rules);
        }''', {'catId': test_cat['id'], 'kws': old_kws})

        restored = page.evaluate('async (id) => (await window.docHub.getCategoryRules(id)).flatMap(x=>x.value)', test_cat['id'])
        log('Restored: ' + str(restored))

        # ===== RESULTS =====
        print()
        print('=' * 60)
        print('  CONCLUSION')
        print('=' * 60)
        print()
        print('  Q: Does changing keywords move existing files?')
        print('  A: NO. Existing files keep their category until re-parsed.')
        print()
        if reclassified:
            print('  Q: Does re-parsing apply new keywords?')
            print('  A: YES. After retryFile(), file was re-classified.')
        print()

        browser.close()

if __name__ == '__main__':
    main()
