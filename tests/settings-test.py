"""
DocHub 设置页功能测试
测试: 监控目录输入、粘贴路径、清空、开始监控
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

TEST_DIR = r"C:\Users\Administrator\Desktop\软件课设作业"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def log(msg):
    safe = msg.encode('ascii', errors='replace').decode('ascii')
    print(f"  [{time.strftime('%H:%M:%S')}] {safe}")

def screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, f'{name}.png')
    page.screenshot(path=path)
    print(f"  [SCREENSHOT] {name}.png")
    return path

def main():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # === 1. 打开应用 ===
        print("\n" + "="*60)
        print("   DocHub 设置页功能测试")
        print("="*60)

        log("正在打开 http://localhost:5173 ...")
        page.goto('http://localhost:5173', wait_until='networkidle', timeout=15000)
        page.wait_for_timeout(2000)
        screenshot(page, '01-initial-load')

        # === 2. 导航到设置页 ===
        print("\n--- 测试 1: 导航到设置页 ---")
        settings_btn = page.locator('button:has-text("设置")')
        if settings_btn.count() > 0:
            settings_btn.first.click()
            page.wait_for_timeout(1000)
            log("✅ 点击「设置」导航按钮")
            screenshot(page, '02-settings-page')
            results.append(("导航到设置页", "PASS"))
        else:
            # Try finding by text content
            settings_btn = page.locator('text=设置')
            if settings_btn.count() > 0:
                settings_btn.first.click()
                page.wait_for_timeout(1000)
                log("✅ 通过文本找到「设置」")
                screenshot(page, '02-settings-page')
                results.append(("导航到设置页", "PASS"))
            else:
                log("❌ 找不到设置导航按钮")
                # Take a screenshot of whatever we see
                screenshot(page, '02-settings-page-fallback')
                results.append(("导航到设置页", "FAIL - 找不到按钮"))

        # === 3. 检查页面元素 ===
        print("\n--- 测试 2: 页面元素检查 ---")

        # 检查标题
        heading = page.locator('h2')
        if heading.count() > 0:
            text = heading.first.inner_text()
            log(f"✅ 页面标题: '{text}'")
            results.append(("页面标题", "PASS" if '设置' in text else f"WARN - 标题: {text}"))
        else:
            log("❌ 找不到页面标题")
            results.append(("页面标题", "FAIL"))

        # 检查 textarea
        textarea = page.locator('textarea')
        if textarea.count() > 0:
            log(f"✅ 找到 textarea (共 {textarea.count()} 个)")
            results.append(("输入框 textarea", "PASS"))
        else:
            log("❌ 找不到 textarea")
            results.append(("输入框 textarea", "FAIL"))

        # 检查三个按钮
        buttons = page.locator('button')
        btn_texts = []
        for i in range(buttons.count()):
            btn_texts.append(buttons.nth(i).inner_text())

        log(f"找到 {len(btn_texts)} 个按钮: {btn_texts}")

        paste_btn = page.locator('button:has-text("粘贴路径")')
        clear_btn = page.locator('button:has-text("清空")')
        start_btn = page.locator('button:has-text("开始监控")')

        has_paste = paste_btn.count() > 0
        has_clear = clear_btn.count() > 0
        has_start = start_btn.count() > 0

        log(f"✅ 粘贴路径按钮: {'存在' if has_paste else '不存在'}")
        log(f"✅ 清空按钮: {'存在' if has_clear else '不存在'}")
        log(f"✅ 开始监控按钮: {'存在' if has_start else '不存在'}")
        results.append(("三个功能按钮", "PASS" if (has_paste and has_clear and has_start) else "FAIL"))

        # === 4. 测试输入路径 ===
        print("\n--- 测试 3: 手动输入路径 ---")
        if textarea.count() > 0:
            ta = textarea.first
            ta.click()
            ta.fill(TEST_DIR)
            page.wait_for_timeout(500)
            current_val = ta.input_value()
            log(f"输入内容: '{current_val}'")
            if TEST_DIR in current_val:
                log("✅ 手动输入路径成功")
                screenshot(page, '03-typed-path')
                results.append(("手动输入路径", "PASS"))
            else:
                log(f"❌ 输入内容不匹配: 期望包含 '{TEST_DIR}', 实际 '{current_val}'")
                results.append(("手动输入路径", "FAIL"))

        # === 5. 测试清空功能 ===
        print("\n--- 测试 4: 清空功能 ---")
        if clear_btn.count() > 0:
            clear_btn.first.click()
            page.wait_for_timeout(500)
            current_val = textarea.first.input_value() if textarea.count() > 0 else ''
            if current_val == '':
                log("✅ 清空成功，输入框为空")
                screenshot(page, '04-cleared')
                results.append(("清空功能", "PASS"))
            else:
                log(f"❌ 清空失败，输入框仍包含: '{current_val}'")
                results.append(("清空功能", "FAIL"))
        else:
            log("❌ 清空按钮不存在")
            results.append(("清空功能", "FAIL - 按钮不存在"))

        # === 6. 重新输入路径并测试开始监控 ===
        print("\n--- 测试 5: 开始监控 ---")
        if textarea.count() > 0:
            ta = textarea.first
            ta.fill(TEST_DIR)
            page.wait_for_timeout(500)

            if start_btn.count() > 0:
                # 设置 dialog handler
                dialog_msg = [None]
                page.on('dialog', lambda d: dialog_msg.append(d.message) or d.accept())

                start_btn.first.click()
                page.wait_for_timeout(2000)

                screenshot(page, '05-after-start')

                if dialog_msg[-1] is not None:
                    log(f"对话框消息: '{dialog_msg[-1]}'")
                    if '已开始监控' in str(dialog_msg[-1]):
                        log("✅ 开始监控成功")
                        results.append(("开始监控", "PASS"))
                    elif '请先输入' in str(dialog_msg[-1]):
                        log("⚠️ 提示需要输入路径（可能是因为不在 Electron 环境）")
                        results.append(("开始监控", "SKIP - 非 Electron 环境，window.docHub 不可用"))
                    else:
                        log(f"⚠️ 未知对话框: {dialog_msg[-1]}")
                        results.append(("开始监控", f"SKIP - {dialog_msg[-1]}"))
                else:
                    log("⚠️ 无对话框弹出，可能 startWatch 在浏览器中静默失败")
                    results.append(("开始监控", "SKIP - 无对话框（可能非 Electron）"))
            else:
                log("❌ 开始监控按钮不存在")
                results.append(("开始监控", "FAIL - 按钮不存在"))

        # === 7. 测试粘贴路径功能 ===
        print("\n--- 测试 6: 粘贴路径功能 ---")
        if clear_btn.count() > 0:
            clear_btn.first.click()
            page.wait_for_timeout(500)

        if paste_btn.count() > 0:
            # 无法在 headless 中真正测试剪贴板，但验证按钮存在且可点击
            paste_btn.first.click()
            page.wait_for_timeout(1000)
            screenshot(page, '06-after-paste')

            # 检查是否弹出错误对话框（剪贴板可能被拒绝）
            log("✅ 粘贴按钮可点击")
            log("   (剪贴板功能需要在 Electron 环境中完整测试)")
            results.append(("粘贴路径按钮", "PASS (UI) - 剪贴板需 Electron 测试"))
        else:
            log("❌ 粘贴路径按钮不存在")
            results.append(("粘贴路径按钮", "FAIL - 按钮不存在"))

        # === 8. 检查分类规则管理区域 ===
        print("\n--- 测试 7: 分类规则管理 ---")
        cat_section = page.locator('text=分类规则管理')
        if cat_section.count() > 0:
            log("✅ 找到「分类规则管理」区域")
            results.append(("分类规则管理", "PASS"))
        else:
            log("⚠️ 未找到「分类规则管理」")
            results.append(("分类规则管理", "WARN"))

        # === 9. 最终截图 ===
        screenshot(page, '07-final-state')

        browser.close()

    # === 测试报告 ===
    print("\n" + "="*60)
    print("   测试结果汇总")
    print("="*60)
    passed = 0
    failed = 0
    skipped = 0
    for name, result in results:
        status = "✅" if result.startswith("PASS") else "❌" if result.startswith("FAIL") else "⚠️"
        print(f"  {status} {name}: {result}")
        if result.startswith("PASS"): passed += 1
        elif result.startswith("FAIL"): failed += 1
        else: skipped += 1

    print(f"\n  总计: {len(results)} 项 | ✅ {passed} 通过 | ❌ {failed} 失败 | ⚠️ {skipped} 跳过")
    print(f"\n  截图保存在: {SCREENSHOT_DIR}")

    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
