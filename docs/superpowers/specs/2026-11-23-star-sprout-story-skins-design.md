# 星芽大冒险：皮肤自选与叙事层（第二轮）

日期：2026-11-23 · 范围：本地横版闯关「星芽大冒险」12 关。联机四章已在第一轮完成（见 2026-11-23-coop-chapters-story-characters-design.md）。

## 1. 目标

第一轮把联机四章的人物/自选/剧情/元素补齐后，星芽侧剩两个缺口：角色只有两套固定配色、不能自选；12 关只有操作 hint、没有故事线。本轮复用第一轮资产，不新建第二套形象系统。

## 2. 皮肤自选

- 身份复用 `tandem-buddy-v1` 本地偏好与 `Appearance` 模型：P1=left、P2=right，与联机大厅同一份选择，跨模式一致。
- `quest-game.tsx` 持有 `looks: BuddyLooks`（初始 `loadBuddyPreference` 回退 `DEFAULT_APPEARANCE`），变更时 `saveBuddyPreference`；经 `QuestStage` / `QuestPreview` 传入 `createQuest(..., { looks })`，存于 `QuestRun.looks`（纯表现字段，不参与规则）。
- `quest-render.ts:264,328` 的 `paintHero` 增加第 5 参 `looks`；`paintHero` 内 `skin = paletteOf(looks[index])`，体型只缩放绘制（big 1.12 / small 0.94），**不改碰撞盒**；coop 名牌改画玩家名字。
- 头部统一：`buddy.ts` 导出 `BUDDY_SPECIES`（fur/furDark/muzzle）与 `paintHead`（联机四章共用）。星芽侧**内联**物种头（bear 圆耳口鼻 / fox 尖耳 / penguin 黑罩橙喙）于 `quest-art.ts` 原有头段：实测共享 `paintHead` 接入 quest 的 guardian 绘制路径会出现角色不可见回归，故星芽保留已验证的原头段结构、仅注入物种与配色差异。eye/mouth 表情沿用 heroPose。
- 选择界面：`buddy-picker.tsx` 抽出 `BuddyControls({ appearance, onChange })`（物种 4 / 色板 6 / 体型 2 / 名字 8），大厅席位卡与 `quest-map.tsx` 共用。quest-map 新增「我的形象」区：P1 卡常驻、P2 卡仅 coop 显示；沿用 `.quest-role` 卡片语言与 `BuddyPreview`。

## 3. 叙事层

- `quest-levels.ts`：`QuestLevel` 增加 `story: string`（每关一句剧情，替换 hint 之外的叙事位；hint 保留为操作提示）。12 句定稿见 §4。
- 新增 `src/shared/quest-story.ts`：`WORLD_STORY: { world, intro, hook }[]` 四世界开场/收尾；`worldStoryOf(level)`、`levelStoryLine(level)`。
- 渲染：quest-map 世界卡显示 intro；quest-stage 顶部 `.story-bubble` 显示本关 story（复用第一轮样式）；结算面板在本世界末关显示 hook。
- 文案原则：一句话交代「为什么去那里」，不播片、不挡操作；与联机委托线共用站长獭獭口吻。

## 4. 文案定稿

世界开场：
- 晨光草原：「獭獭：草原的金币被栗栗搬走了。芽芽，去把它们顶回来。」
- 云端奇旅：「獭獭：云梯通向天空遗迹。风大，牵好搭档的手。」
- 秘境巡游：「獭獭：糖果厂、浅海和夜林都发了求救信号。一路别松手。」
- 菇霸决战：「獭獭：菇霸把彩虹桥锁进了城堡。最后一战，两个人一起上。」

每关 story：
1 绿野第一步「栗栗把金币埋进草坡，顶一顶问号砖就能找回。」
2 蘑菇丘陵「水管里的咬咬花守着丘陵小径，等它低头再过去。」
3 金币洞窟「洞窟深处有一整面金币墙，踩弹簧才够得到。」
4 云端阶梯「云梯一步一停，掉下去也有存档旗接住你。」
5 流沙遗迹「遗迹的流沙会吞脚，移动平台是唯一的路。」
6 霜糖滑道「企鹅壳在冰面上滑来滑去，踢走它再慢慢停。」
7 糖果传送带「传送带把糖果运向相反方向，逆着走才拿得到。」
8 泡泡浅海「水母在浅海打盹，划水绕开它们去够高处的泡泡。」
9 萤火夜林「夜林只有萤火虫照路，跟着光走别掉队。」
10 熔岩要塞「熔岩池上架着碎砖，踩稳了再跳下一块。」
11 彩虹天桥「天桥的相位板一隐一现，数着节奏过。」
12 菇霸城堡「菇霸落地会头晕：跳上去三次，把彩虹桥赢回来。」

世界 hook（末关结算显示）：
- 晨光草原→「獭獭：草原干净了。下一封委托在云上。」
- 云端奇旅→「獭獭：天空遗迹安静了。秘境那边还在响求救铃。」
- 秘境巡游→「獭獭：三处求救都回了信。只剩菇霸的城堡。」
- 菇霸决战→「獭獭：彩虹桥回来了。今天的星芽队，满分。」

## 5. 测试与验收

- 单元：`tests/quest-story.test.ts` 覆盖 12 关 story 非空、四世界 intro/hook 齐全、`worldStoryOf` 映射；现有 `tests/quest.test.ts` 逐关机器人（单人+双人）必须仍全绿（looks 为可选表现字段）。
- e2e：新增 `tests/e2e/quest-skins.spec.ts`：首页→双人同乐→形象卡可见→改 P1 物种后名字/预览更新→进入关卡无 console 报错；390px 无溢出。
- 视觉：无头截图星芽第 1 关与第 12 关，确认物种头+星徽帽共存、名牌为名字、体型缩放不穿地。
- 验收：`npm run typecheck && npm test && npm run test:e2e`；通过后 commit + push。

## 6. 不做的事

- 不改星芽物理/关卡几何/机器人判定；不做新 pose（沿用 heroPose）；不做云端存档；不动联机四章代码路径（仅抽共用头段）。