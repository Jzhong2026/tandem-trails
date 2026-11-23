# 联机四章：角色形象、自选形象、剧情与关卡元素升级

日期：2026-11-23 · 范围：联机协作四章（双桨救援队 / 萤火虫矿洞 / 摇摇晃晃送龙蛋 / 泡泡潜艇）。星芽大冒险的叙事与皮肤自选另开一轮 spec，不在本文件范围。

## 1. 目标与问题

用户反馈：合作方式可以，但剧情过于简单、闯关元素少、人物形象差、不能自选形象。现状证据：

- 人物：四章各画各的色块小人，无脸、无四肢、无走路动画（`src/web/mine-canvas.tsx:125`、`src/web/egg-canvas.tsx:135`、`src/web/river-art.ts:259`、`src/web/sub-canvas.tsx:264`）。星芽已有成熟骨架（`src/web/quest-art.ts:75-355`）。
- 剧情：只有 `title` + 一句话 `summary`（`src/shared/game-levels.ts:14-26`），无任务动机、无 NPC、无过场。
- 元素：每章机制单一；第二关（mine2/egg2）与首关差异小。
- 身份：`PlayerView` 只有 `{online, ready}`（`src/shared/protocol.ts:21`），无任何外观字段。

目标：一套统一角色骨架 + 玩家自选形象（物种 / 配色 / 体型 / 名字）+ 贯穿四章的委托故事线 + 每章第二关新增 2 个协作机制。不新增按键，全部复用现有「按住 / 方向 / 操作机关」输入。

## 2. 角色形象系统

### 2.1 外观模型 `src/shared/buddy.ts`（新增）

```ts
export const BUDDY_BODIES = ['kid', 'bear', 'fox', 'penguin'] as const;
export type BuddyBody = typeof BUDDY_BODIES[number];
export const BUDDY_SIZES = ['big', 'small'] as const;   // big=家长 small=孩子
export type BuddySize = typeof BUDDY_SIZES[number];
export const BUDDY_PALETTE_COUNT = 6;
export const BUDDY_NAME_MAX = 8;
export interface Appearance { body: BuddyBody; palette: number; size: BuddySize; name: string }
export const DEFAULT_APPEARANCE: Record<Seat, Appearance>;  // left: kid/0/big/芽芽  right: kid/1/small/豆豆
export const BODY_DEFAULT_NAME: Record<BuddyBody, string>;  // 芽芽 / 熊墩墩 / 狐小焰 / 企鹅波波
export function sanitizeAppearance(input: unknown, fallback: Appearance): Appearance;
```

`sanitizeAppearance` 是服务端唯一入口校验：body/size 不在枚举内回退 fallback；palette 取 `Math.floor` 后 clamp 到 `[0, 5]`，非数回退；name 去首尾空白、截断到 8 个码点、空串回退 `BODY_DEFAULT_NAME[body]`。拒绝控制字符。客户端 picker 只产出合法值，服务端不信任客户端。

### 2.2 绘制模块 `src/web/buddy.ts`（新增）

移植原型 v1 定稿骨架（来源 `quest-art.ts:75-355`，原型 `D:\tmp\Debug\tt-buddy-v1.html`）：

- `paintBuddy(ctx, opts)`，`opts = { x, feet, scale, facing, appearance, outfit, pose, phase, seconds }`。
- 骨架固定：两段腿+靴、两段臂+手、渐变躯干、头+脸（眼/腮红/嘴/眨眼）、走路/待机/欢呼相位。物种头钩子（kid 刘海 / bear 圆耳口鼻 / fox 尖耳白口鼻 / penguin 黑头罩白脸橙喙）与职业装钩子（`miner` 安全帽+矿灯+反光条 / `sailor` 水手帽+领巾 / `carrier` 护蛋背带+肩垫 / `pilot` 耳机+风镜 / `sprout` 星徽帽+嫩芽，sprout 保留给星芽轮）分层绘制，物种头先画、职业装后画。
- `BUDDY_PALETTES`：6 套 12 键调色板（coral/mint/amber/sky/berry/leaf），键名与 `HERO_SKINS` 一致便于星芽轮复用。
- 体型：`buddyScale(size)` → big 1.37、small 1.0（基准身高 41px → 56 / 41）。
- 姿态：`walk | idle | win | paddle | carry | bust`。`paddle` 隐藏腿、手臂按相位划桨；`carry` 双臂上举扶担架；`bust` 只画头肩（潜艇舱内）。
- 章节默认职业装：river→sailor、mine→miner、egg→carrier、sub→pilot。玩家自选只改 body/palette/size/name，职业装由章节决定（叙事身份）。

### 2.3 替换清单

| 文件 | 现状 | 改为 |
| --- | --- | --- |
| `src/web/river-art.ts:215-265` | 船内两个圆圈头 | 两个 `paintBuddy(pose:'paddle')`，左右各一，桨相位沿用现有摆动 |
| `src/web/mine-canvas.tsx:125-141,178,220` | `paintMiner` 色块 | `paintBuddy(outfit:'miner')`，移动时 walk 否则 idle；矿灯光束保留 |
| `src/web/egg-canvas.tsx:135-152` | 蛋形色块 | `paintBuddy(outfit:'carrier', pose:'carry')`，抬端时手臂上举 |
| `src/web/sub-canvas.tsx:264-270` | 舱内圆脸 | `paintBuddy(pose:'bust', outfit:'pilot')` |
| `src/web/finish-art.ts:61-67` | 另画两个小人 | `paintBuddy(pose:'win')` |

四章 canvas 均经 `PanoramaCanvas`，只换绘制函数，不动渲染框架与 `animationSeconds`（reduced-motion 约定保留）。

## 3. 自选形象

### 3.1 协议与服务端

- `protocol.ts`：`PlayerView` 增加 `appearance: Appearance`；`ClientEvents` 增加 `'room:appearance': (appearance: Appearance, respond: Respond<RoomView>) => void`。`room:create/join/resume` 签名不变。
- `room.ts`：`Member` 增加 `appearance`，`admit` 时取 `DEFAULT_APPEARANCE[seat]`；新增 `setAppearance(seat, input, now)` 调 `sanitizeAppearance` 后存储并 `activeAt = now`；`view()` 下发 appearance。重连保留（Member 不重建）。
- `game-server.ts`：按 `updateRoom` 模式接线 `room:appearance`，任意 phase 允许（纯表现层，不影响 30Hz 规则）。
- 客户端 `use-room.ts`：新增 `setAppearance`；admit/resume 成功后把本地偏好发一次。

### 3.2 持久化与大厅 UI

- localStorage key `tandem-buddy-v1`，存 `{ left?: Appearance, right?: Appearance }` 按席位记忆；读取走 try/catch + `sanitizeAppearance`（仿 `quest-map.tsx:9-22`）。
- `RoomLobby`（`src/web/app.tsx:151`）席位列表改为形象卡：每席一个 96×96 预览 canvas（`paintBuddy idle`）+ 名字 + 体型标签。自己席位展开 picker：物种 4 钮（带迷你头像）、配色 6 色板、体型 2 钮（家长大 / 孩子小）、名字输入（maxLength 8，正式 label 在输入框上方）。对方席位只读预览。
- 样式进 `src/web/styles.css`，沿用现有 `.seats` 网格与按钮语言；选中态用 `aria-pressed`。移动端 390px 不溢出（e2e 断言 scrollWidth）。
- 局内 HUD 名牌用玩家名字替换硬编码「左桨/右桨」职责文案之外的显示名（职责文案保留）。

## 4. 剧情层 `src/shared/story.ts`（新增）

贯穿设定：玩家是「 Tandem 救援队」搭档，站长**獭獭**（水獭）在每章开头派委托，章末交代下一封委托信。剧情制造信息差与回合，服务产品目标「孩子主动发出指令、家长愿意停下来等」（2026-11-18 spec）。

```ts
export interface StoryBeat { at: number; npc: string; text: string }   // at = 关卡进度 0..1
export interface ChapterStory {
  chapter: 'river' | 'mine' | 'egg' | 'sub';
  requester: string; mission: string; whyTwo: string;
  intro: string[]; beats: StoryBeat[]; outro: string; nextHook: string;
}
export const CHAPTER_STORY: Record<ChapterStory['chapter'], ChapterStory>;
export function storyFor(level: GameLevel): ChapterStory;
export function levelProgress(level: GameLevel, run: RoomView['run']): number;
export function currentBeat(story: ChapterStory, progress: number): { npc: string; text: string } | null;
```

`levelProgress`：river 用 `(x-start)/(dock-start)`；mine/egg/sub 用两名玩家最大 x / 出口 x。`currentBeat` 返回 `at <= progress` 的最后一条；progress < 首个 beat 时返回 intro 最后一句（开场白常驻到第一个里程碑）。

渲染点（全部客户端读 run 状态，不改协议）：
- 大厅：任务卡（requester / mission / whyTwo），替换现在的一句话 `summary` 位置，summary 保留为操作提示。
- 局内：舞台顶部 NPC 气泡（名字 + 一句话，`aria-live="polite"`），随进度切换；不遮挡操作区。
- 结算：`FinishOverlay` 增加 outro + nextHook 两段文案。

文案（定稿，直接落地）：

- **river** requester 鸭妈妈 · mission 把走失的小鸭接回码头 · whyTwo 一支桨只会转圈，两支桨才走得直。
  intro：「獭獭：救援队，鸭妈妈的小鸭在浮木后面哭。去接它回家。」/「鸭妈妈：它只怕生人，你们要慢慢靠近。」
  beats：0.25 獭獭「先一个人试桨，船会转；两个人一起按，船才走。商量好谁喊口令。」；0.55 鸭妈妈「看到浮木了吗？喊出方向，让搭档跟着划。」；0.85 小鸭「嘎！我看到码头啦！」
  outro：「小鸭扑进鸭妈妈翅膀里。码头灯为你们亮了一整晚。」 nextHook：「獭獭递来下一封委托：矿洞里的萤火虫不敢出门了。」
- **mine** requester 萤火虫长老 · mission 各带一只萤火虫走出矿洞 · whyTwo 桥和升降梯各在一层，一个人按不到两个开关。
  intro：「獭獭：矿洞塌了一半，萤火虫的光被关在里面。」/「长老：孩子怕黑，大人怕高。你们正好互补。」
  beats：0.2 长老「下层按住绿开关，桥才放得下。上层过桥后别忘了回报一声。」；0.5 獭獭「升降梯要上层一直按住。下层站上去之前，先问一句『准备好了吗』。」；0.8 长老「出口的水晶门认光：两只萤火虫都到，门才开。」
  outro：「萤火虫把矿洞照成一条星河。长老说，这是今年最亮的一次。」 nextHook：「委托信被风吹上山：龙妈妈的蛋还在坡那边。」
- **egg** requester 龙妈妈 · mission 把龙蛋平稳抬回巢 · whyTwo 担架两端各一人，坡道要轮流抬低的一端。
  intro：「獭獭：山上风大，龙蛋不能一个人抱。」/「龙妈妈：它听得懂慢脚步。你们走稳，它就睡。」
  beats：0.25 龙妈妈「上坡了！低的那一端抬高，喊一声再走。」；0.55 獭獭「风口要两个人一起扶稳。风向会变，看旗子报给搭档。」；0.85 龙蛋「（蛋里传来轻轻的心跳声）」
  outro：「蛋落进巢里，裂开一条缝，露出一只打哈欠的小龙。」 nextHook：「海马医生的潜水电报：珊瑚站缺气泡，请潜艇支援。」
- **sub** requester 海马医生 · mission 收集气泡送到珊瑚站 · whyTwo 一个管上下一个管前后，谁也代替不了谁。
  intro：「獭獭：珊瑚站的病人等气泡做药。」/「海马医生：礁石会动，洋流会推。你们要把对方的操作当自己的眼睛。」
  beats：0.25 海马医生「垂下的礁石要下潜绕。驾驶员，报深度给你的搭档。」；0.55 獭獭「洋流带会把船推偏，顶住方向再进。」；0.8 海马医生「触手门一开一合，看准节奏，喊『现在』再冲。」
  outro：「气泡在珊瑚站炸成一片小烟花。病人们排队向你们鞠躬。」 nextHook：「獭獭合上委托簿：今天的救援队，满分。」

## 5. 每章第二关新增元素（各 2 个，数据驱动）

首关保持教学不变；新元素只进第二关（river→bend、mine→mine2、egg→egg2、sub→sub 首关即唯一关，故进 sub）。

### 5.1 river · bend：水流带 + 移动浮木
- `RIVER_COURSES.bend.currents: { x, y, rx, ry, pushY }[]` = `[{470,200,70,120,80},{700,200,60,120,-80}]`。船在椭圆内每 tick `y += pushY * dt`；双桨同按抵消 100%，单桨抵消 50%，不划全推。岸 clamp 不变。
- `rafts: { x, y, rx, ry, range, speed, phase }[]` = `[{582,276,47,40,70,0.9,0}]`，`y = base + sin(elapsedSec*speed+phase)*range`，碰撞判定用当前 y（替换该处静态 log）。
- 渲染：水流带画横向流线箭头，浮木画木纹+上下位移。

### 5.2 mine · mine2：矿车 + 水晶门
- 下层地板开缺口 `[600,760]`；`cart = { from:600, to:760, y:lowerY, switchX:upper 平台 700, x:600, speed:120 }`。上层在新开关按住「操作机关」且下层站在车上（|x-cart.x|<24）时车前进；松开原地停（沿用桥的等待语义）。下层在车上时 x 跟随车。
- `crystalGate = { x:880 }`：下层出口前的门，双方萤火虫都收集后才开（`fireflies.left && fireflies.right`），否则下层在门前等待并提示「等队友的萤火虫」。
- 渲染：矿车=斗+两轮+轨道；水晶门=两扇半透明晶板，开启时向两侧滑。

### 5.3 egg · egg2：变向阵风 + 冰面段
- 现有风口增加 `gust = { periodMs:2600, dir:'left'|'right' }`，按 `floor(elapsedMs/periodMs)%2` 切换。通过条件升级为：两人同按扶稳 **且** 迎风端（dir=left→left，dir=right→right）按住抬高。旗子渲染风向。
- `ice = { from:340, to:430 }`：该段移动带惯性（速度以 6/s 趋向目标、3/s 衰减），松开不会立刻停，提示「冰面打滑，点按别长按」。
- 渲染：风口旗+风向箭头；冰面浅蓝高光带。

### 5.4 sub · sub：洋流带 + 触手门
- `currents: { x, y, rx, ry, pushX, pushY }[]` = `[{430,210,80,90,70,0},{640,150,70,80,0,60}]`。舱内每 tick 加推流；前进/后退按住抵消 pushX 100%，上浮/下潜按住抵消 pushY 100%，未按全推。
- `tentacle = { x:760, periodMs:3200, openMs:1400, phase:0 }`：闭合时为实体礁石判定（碰回最近浮标），开启时可穿。周期由 elapsedMs 决定，双端可见同一节奏。
- 渲染：洋流流线；触手门=四条摆动触手，开启时缩回。

## 6. 测试与验收

- 单元（`tsx --test`）：`tests/buddy.test.ts` 覆盖 sanitize（非法 body/palette/name/控制字符/超长）；`tests/rooms.test.ts` 增加 appearance 同步、重连保留、非法输入回退；`tests/story.test.ts` 覆盖 progress/currentBeat 边界；四章各增机制测试（水流抵消比例、浮木碰撞随相位、矿车等待语义、水晶门双萤火虫、阵风迎风端、冰面惯性、洋流抵消、触手门周期）。
- 机器人通关：现有逐关自动机器人（quest 轮之外，四章 e2e）更新 mine2/egg2/sub/bend 路径以使用新机制；首关 e2e 不变。
- e2e：lobby 形象卡可见、picker 改名字/体型后对方席位预览同步、390px 无横向溢出、剧情气泡随进度出现、结算含 outro。
- 验收命令：`npm run typecheck && npm test && npm run test:e2e`。每步验证通过即 commit + push（用户约定）。
- 视觉验收：无头 Chrome 多相位截图四章角色（走路/待机/欢呼），确认四肢可数、脚掌符合物种、矿灯光束与名字牌不遮脸。

## 7. 发布路线

- 星芽（纯前端）本轮之后可单独发 Qoder Sites 静态站（`prepare_site` → `publish_site`）。
- 联机四章**不能原样上 Qoder Sites**：Sites Function 为 edge/Deno HTTP handler，不支持 Express 常驻进程与跨实例内存房间；Socket.IO 需重写为 `Deno.upgradeWebSocket` + 房间状态入库 + tick 驱动改造，另立 spec。本轮维持 Node 路线（局域网家庭内测 → VPS/HTTPS）。

## 8. 不做的事

- 不做账号/云端存档（匿名席位约定不变）；形象只存本地 + 房间内存。
- 不做星芽侧改动（另轮）；不做新按键/新输入通道；不做关卡编辑器。
- 不重构四章引擎结构，只加数据驱动字段与判定分支。