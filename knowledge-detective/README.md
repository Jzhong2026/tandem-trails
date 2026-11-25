# 知识侦探社

独立的全栈学习游戏原型，与 `tandem-trails` 原仓库没有代码依赖。支持：

- 单人剧情探案：切换调查员 / 分析员身份，收集并分享线索。
- 双设备联机：两人各看一组私有线索，通过共享证据板合作破案。
- 3 个原创案件：校园广播、罗盘失物、展览时间线。
- 错题补救：答错后生成小任务，不淘汰、不重置。
- 本地进度：保存已破解案件与掌握概念。

## 运行

需要 Node.js 24 LTS。

```sh
npm install
npm run dev
```

- 游戏界面：`http://localhost:5173`
- 服务与 API：`http://localhost:3000`
- 局域网联机：在另一台设备访问运行电脑的 IP 加 `:5173`。

## 验证

```sh
npm run typecheck
npm test
npm run test:e2e
```

浏览器测试使用系统 Chrome。生产构建与启动：

```sh
npm run build
npm start
```

生产模式默认端口为 `3000`，可通过 `PORT` 和 `HOST` 环境变量修改。
