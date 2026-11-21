季策 · GitHub Pages 上传说明

1. 把本目录所有文件上传到仓库根目录（jice-fund），覆盖同名文件。
2. 必须包含 .nojekyll（不要让 GitHub 用 Jekyll 处理）。
3. 打开 https://1984402116-beep.github.io/jice-fund/ 检查：
   - 页面能打开、底部有“说明”按钮；
   - 首次打开会弹使用说明；
   - 主页持仓会显示“确认份额/看收益”日期。
4. 本静态版不含 /now、/daily、/admin 三个本地服务页面，也不发系统通知；
   这些功能只在手机本地服务（npm run supervisor）里用。
5. 净值/盯盘接口仍指向原来配置的后端（当前阿里云 FC 欠费会 403，页面会提示连不上）。
