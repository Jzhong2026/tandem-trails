"""Build offline original exercises for the Shanghai course catalogue."""
import json
import random
import sqlite3
import subprocess
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "data" / "shanghai.sqlite"
# A term's words and explanations form matching exercises in both directions.
# Each definition is written as a self-contained clue with one accepted match.
WORDS = {
"21": """池塘|小蝌蚪生活的小水塘
传播|种子从原来的地方被送到别处
蒲公英|种子带着小伞，常借风旅行的植物
梧桐|叶子形状像手掌的高大树木
稻谷|秋天收割后可以加工成大米的庄稼
彩虹|雨后天空里有时出现的彩色弧线
观察|仔细看事物的样子和变化
陡峭|形容山坡很直、很难爬
清晰|看得很清楚，和“模糊”相反
无边无际|一眼望不到边
坐井观天|比喻看到的地方很小，见识有限
得过且过|只顾眼前过得去，不为以后打算
扁担|挑东西时横在肩上的长条工具
水汽|水受热变成的气体
称赞|用话肯定别人的优点
祝福|向别人表达美好的愿望""",
"22": """嫩芽|植物刚刚冒出的幼小的芽
植树|把树苗栽到泥土里
足迹|人在路上走过后留下的脚印
劳动|用双手或脑力做事，创造需要的东西
端午|人们常吃粽子、赛龙舟的传统节日
团圆|分开的人重新聚在一起
喜鹊|常在树上用树枝搭窝，名字里有“喜”的鸟
想象|在脑海里创造新的图景
亡羊补牢|羊丢了就修羊圈，出了问题及时补救
揠苗助长|拔高禾苗来帮它生长，反而害了它
指南针|利用磁针帮助人辨别方向的工具
雷雨|伴着雷声和闪电的一场雨
泥塘|充满泥和水的小池塘
蜕变|小毛虫经历成长，样子发生很大改变
神话|古人用奇妙想象讲述世界与英雄的故事
疏导|引水沿着通道流走，减轻水患""",
"31": """绚丽多彩|颜色灿烂，丰富又好看
鸦雀无声|形容安静得一点声音都没有
层林尽染|一层层树林都染上了秋色
预测|根据已有线索推想接下来会发生什么
犹豫|想做一件事，却一时拿不定主意
翠绿|鲜明而像翡翠一样的绿色
富饶|物产丰富，资源充足
瑰丽|异常美丽，色彩动人
演奏|用乐器奏出曲调
敏捷|动作迅速而灵活
争分夺秒|连一分一秒都要抓紧
围绕中心|让不同的句子都服务于同一个主要意思""",
"32": """掠过|轻快地从表面擦过去
姿态|身体或事物呈现出的样子
守株待兔|把碰巧得来的好运当成可以一直依靠的办法
谦虚|有本领也愿意听别人的意见
创举|以前很少有人做过的重大创造
工艺|制作物品的方法和技术
观察记录|把亲眼看到的变化按顺序写下来
推测|根据已经知道的情况估计未知的情况
想象力|把现实中没有的情景组合出来的能力
诚信|说到做到，答应别人的事认真完成
变幻|形状或颜色不断改变
复述|用自己的话按顺序把故事重新讲出来""",
"41": """人声鼎沸|许多人的声音像锅里的水沸腾一样喧闹
若隐若现|看上去好像出现了，又好像消失了
提问|阅读中把不明白或想深入了解的地方说出来
连续观察|在多个时间点跟踪记录同一事物
毫不可惜|一点儿也不觉得惋惜
神话想象|用超越日常经验的情节表现古人心中的世界
起因|推动一件事开始发生的原因
经过|一件事情从开始到结束的发展过程
雄伟|气势盛大，形体壮观
远眺|从高处向很远的地方看
批注|读书时在旁边写下疑问、感受或理解
志向|一个人希望努力实现的远大目标""",
"42": """和谐|各部分配合适当，给人协调的感觉
朴素|自然简单，没有过多装饰
推断|根据证据和已有知识作出判断
纳米|常用来描述极小尺度的长度单位
诗节|一首现代诗中由若干诗行组成的一段
拟人|把事物当作人来写，赋予人的动作或情感
警戒|保持警惕，防止危险出现
游览顺序|按照游人经过地点的先后组织文章
过渡句|连接上下文，使内容自然衔接的句子
人物品质|从人物言行中能看出的性格和精神
自我介绍|向别人有重点地说出自己的情况
童话|常用想象和拟人讲述的儿童故事""",
"51": """借物喻人|借一种事物的特点表现人的品质
信赖|相信并愿意依靠对方
协调|不同部分互相配合得当
简要复述|保留主要情节，用简洁的话重新讲述
民间故事|在人们口耳之间流传的故事
详略|写作中对重点多写、对次要内容少写的安排
列数字|用具体数值把事物的特点说清楚
作比较|借两种事物的相同或不同说明特点
细节描写|写出细小而具体的动作、神态或环境
动态描写|着重表现景物怎样运动和变化
静态描写|着重表现景物相对静止时的样子
体会情感|结合具体语句理解作者的感受""",
"52": """童趣|童年生活中天真活泼的乐趣
读后感|在读懂作品的基础上联系实际写自己的感受
神机妙算|形容谋划高明，估计准确
肃然起敬|因敬佩而产生庄重的态度
动作描写|从人物具体怎样做来刻画人物
神态描写|用面部表情表现人物的心情
自相矛盾|同一个人的说法彼此冲突，不能同时成立
谋略|为达成目标而安排的办法和计策
纵横交错|横的和竖的交叉穿过
讲解|把事物的特点有条理地说明给听众
言外之意|表面话语之外暗含的意思
回忆|把过去经历过的事情重新想起""",
"61": """联想|由眼前事物想到与它有关的其他事物
象征|用具体事物表现抽象的意义
点面结合|同时写整体场景和其中有代表性的个体
侧面描写|通过别人的反应或环境间接表现主要人物
阅读目的|读一篇文章想解决的具体问题
浏览|快速看过材料以获取大致信息
情节|小说中事件发生、发展和变化的过程
环境描写|描绘人物所处的自然或社会背景
照应|前文的内容在后文得到呼应
论点|议论性文章中作者要表达的主要看法
论据|支持一个观点的事实或道理
质疑|对已有说法提出有根据的问题""",
"62": """风俗|一个地方或群体长期形成的生活习惯
详写|对最能表现主题的内容具体展开
叙述视角|由谁、从什么位置来讲述故事
追忆|回想过去的人物或往事
情景交融|把内心感情融入景物描写之中
心理描写|揭示人物内心想法与感受
梗概|按原作顺序保留主干情节写成的简述
伏笔|为后文发展预先作出的暗示
事例|用来说明某种观点的具体事情
倡议|为了共同目标向大家提出行动建议
比喻|以不同事物间的相似之处帮助表达
对比|把差异鲜明的两方面放在一起突出特点"""
}
# Each original instruction splits at / into two meaningful pieces. Matching
# both pieces makes listening and reading part of the parcel-delivery game.
LINES = {
"21": """Open/your eyes.|睁开/你的眼睛
Tidy/your room.|整理/你的房间
Look at/the bus.|看一看/那辆公交车
Kick/the ball.|踢/那个球
Fly/a kite.|放/一只风筝
Draw/a fish.|画/一条鱼
I like/spring.|我喜欢/春天
Wash/the apple.|洗/那个苹果
Smell/the flower.|闻一闻/那朵花
Touch/your nose.|摸一摸/你的鼻子""",
"22": """Enjoy/your holiday.|享受/你的假期
Sweep/the floor.|扫/地板
I feel/happy.|我感到/开心
Build/a robot.|搭建/一个机器人
Help/your friend.|帮助/你的朋友
Thank/your mum.|感谢/你的妈妈
Water/the plant.|浇一浇/那株植物
Watch/the ducks.|看/那些鸭子
Wash/your hands.|洗/你的双手
Close/your eyes.|闭上/你的眼睛""",
"31": """Meet/my teacher.|见一见/我的老师
Show/your drawing.|展示/你的画
Plant/some seeds.|种下/一些种子
Save/clean water.|节约/清洁的水
Carry/the boxes.|搬/这些箱子
I feel/proud.|我感到/自豪
Ask/the doctor.|询问/那位医生
Find/the library.|找到/图书馆
Celebrate/the festival.|庆祝/那个节日
Taste/the noodles.|尝一尝/面条""",
"32": """Listen to/the birds.|听/鸟儿的叫声
Touch/the soft toy.|摸一摸/那个柔软的玩具
Smell/the lemon.|闻一闻/那个柠檬
Feed/the rabbit.|喂/那只兔子
Spin/the top.|转动/那个陀螺
Wear/a coat.|穿上/一件外套
Draw/a triangle.|画/一个三角形
Mix/the colours.|调和/这些颜色
I love/summer.|我喜爱/夏天
Raise/your arms.|举起/你的双臂""",
"41": """Visit/our school.|参观/我们的学校
Introduce/your classmate.|介绍/你的同班同学
Protect/the forest.|保护/那片森林
Make/a birthday card.|制作/一张生日贺卡
Walk to/the museum.|步行去/博物馆
Collect/autumn leaves.|收集/秋天的叶子
Eat/a healthy breakfast.|吃/一顿健康的早餐
Tell/the truth.|说出/真相
Check/the time.|查看/时间
Take/an umbrella.|带上/一把雨伞""",
"42": """Taste/the sour fruit.|尝一尝/那种酸味水果
Feel/the rough stone.|摸一摸/那块粗糙的石头
Trace/the shadow.|描出/那个影子
Join/the sports club.|加入/体育社团
Draw/the puppy.|画出/那只小狗
Set/the table.|摆好/餐桌
Listen for/the bell.|留心听/铃声
Read/the timetable.|阅读/时间表
Play/the violin.|演奏/小提琴
Watch/the dragon boats.|观看/那些龙舟""",
"51": """Join/the chess club.|加入/国际象棋社团
Learn/a traditional game.|学习/一种传统游戏
Study/the roots.|研究/这些根
Observe/the animals.|观察/这些动物
See/a doctor.|去看/医生
Practise/the difficult part.|练习/困难的部分
Describe/the experiment.|描述/这个实验
Design/an invention.|设计/一项发明
Save/the document.|保存/这个文档
Reuse/the paper.|再次使用/这些纸张""",
"52": """Put away/the toys.|收起/这些玩具
Measure/the growing plant.|测量/正在生长的植物
Reduce/the noise.|减少/噪声
Order/a glass of juice.|点/一杯果汁
Choose/a film.|挑选/一部电影
Review/the science lesson.|复习/这节科学课
Follow/the signs.|遵照/这些标志
Record/the temperature.|记录/气温
Explore/the museum.|参观探索/博物馆
Share/a holiday story.|分享/一个假日故事""",
"61": """Compare/two timetables.|比较/两份时间表
Interview/a family member.|采访/一位家庭成员
Prepare/a balanced meal.|准备/一顿均衡的饭菜
Recommend/a team sport.|推荐/一项团队运动
Describe/an animal habitat.|描述/一种动物栖息地
Plan/a trip to Shanghai.|规划/一次上海之旅
Explain/the class rules.|解释/班级规则
Discuss/your weekend plans.|讨论/你的周末计划
List/the ingredients.|列出/这些食材
Choose/the fastest route.|选择/最快的路线""",
"62": """Respect/different opinions.|尊重/不同的意见
Follow/the safety rules.|遵守/安全规则
Compare/two festivals.|比较/两个节日
Check/the weather forecast.|查看/天气预报
Improve/our neighbourhood.|改善/我们的社区
Research/a historical figure.|研究/一位历史人物
Describe/your strengths.|描述/你的长处
Explain/the reason.|解释/原因
Reduce/household waste.|减少/生活垃圾
Write/a short biography.|撰写/一篇短传记"""
}


def maths(code, n):
    a, b = n + 2, 2 * n + 1
    if code == "21":
        return [
            ("退位减法", f"有 {50+n} 枚贴纸，用去 {n+7} 枚，还剩几枚？", 43, f"{50+n} − {n+7} = 43"),
            ("加减混合", f"车上有 {20+n} 人，下车 8 人，又上车 {n} 人。现在有几人？", 12+2*n, "先减去下车的人，再加上车的人。"),
            ("购物", f"一个本子 {n} 元，付一张 20 元，应找几元？", 20-n, f"20 − {n} = {20-n}"),
            ("表内乘法", f"{n} 辆三轮车一共有几个轮子？", n*3, f"{n} 个 3 相加，可以算 {n} × 3。"),
            ("分类", f"把 {n} 个苹果、{n+1} 个梨和 3 根黄瓜按水果、蔬菜分。水果有几个？", 2*n+1, "苹果和梨同属水果，把这两组的数量相加。"),
            ("找规律", f"{n}，{2*n}，{3*n}，接下来填几？", 4*n, f"每次增加 {n}。"),
            ("方向与路线", f"向东走 {n+3} 步，再向西走 {n} 步，现在在起点东边几步？", 3, "东与西相反，两段步数相减。"),
        ]
    if code == "22":
        return [
            ("表内除法", f"{n*6} 个草莓平均分给 6 人，每人几个？", n, f"{n*6} ÷ 6 = {n}"),
            ("余数", f"{n*4+3} 人每 4 人一组，分完完整的小组后还剩几人？", 3, f"{n*4+3} = 4 × {n} + 3"),
            ("数位", f"{n} 个千、3 个十和 2 个一合起来是多少？", n*1000+32, "千位写给出的数字，百位写 0，十位写 3，个位写 2。"),
            ("时间", f"从 8 时 {n} 分到 8 时 30 分，经过了几分钟？", 30-n, f"30 − {n} = {30-n}"),
            ("三位数加法", f"{298+n} + {104+n} = ?", 402+2*n, "相同数位对齐，满十向前一位进一。"),
            ("搭配", f"{n} 件不同上衣与 2 条不同裤子各选一件，有几种搭配？", n*2, "每件上衣都有两种搭法。"),
        ]
    if code == "31":
        return [
            ("两步运算", f"{n} 盒铅笔，每盒 8 支，送出 5 支，还剩几支？", n*8-5, "先算总数，再减去送出的数量。"),
            ("乘法", f"{10*n+3} × 4 = ?", (10*n+3)*4, "把两位数分成整十数和个位数，分别乘 4 后相加。"),
            ("除法", f"{n*24} ÷ 6 = ?", n*4, f"因为 {n*4} × 6 = {n*24}。"),
            ("平面图形", f"{n} 个互不重叠的三角形共有几个顶点？", 3*n, "每个三角形都有 3 个顶点。"),
            ("年月日", f"连续 {n} 个星期有多少天？", 7*n, "一个星期有 7 天。"),
            ("周长", f"长方形长 {a} 米、宽 {n} 米，围一圈长几米？", (a+n)*2, "两条长和两条宽相加。"),
        ]
    if code == "32":
        return [
            ("乘法", f"每排 {n+12} 个座位，12 排共有多少个？", (n+12)*12, "一排的数量乘排数。"),
            ("除法", f"{n*24} 张卡片，每 12 张一袋，能装几袋？", 2*n, f"{n*24} ÷ 12 = {2*n}"),
            ("条形统计图", f"每格表示 5 人。条形高 {n} 格，代表几人？", 5*n, "格数乘每格对应的数量。"),
            ("分数初步", f"将一张纸平均分成 {n+2} 份，涂 2 份。表示涂色部分的分数约分前，分母是几？", n+2, "分母表示把整个物体平均分成的总份数。"),
            ("路程", f"每分钟走 60 米，{n} 分钟走几米？", 60*n, "路程等于速度乘时间。"),
            ("面积", f"一块长 {a} 分米、宽 {n} 分米的长方形，面积是几平方分米？", a*n, "面积等于长乘宽。"),
        ]
    if code == "41":
        return [
            ("运算律", f"25 × {n} × 4 = ?", 100*n, "用乘法交换律和结合律，先算 25 × 4。"),
            ("大数改写", f"{n*10000} 改写成以“万”为单位的数，是几万？", n, "一万等于一万个一。"),
            ("量的换算", f"{n} 千克加 250 克，一共多少克？", n*1000+250, "1 千克等于 1000 克，先统一单位。"),
            ("分数", f"{n*6} 颗珠子的三分之一有几颗？", n*2, "平均分成 3 份，取其中 1 份。"),
            ("线与角", f"平角分成两个角，一个是 {n*10} 度，另一个是几度？", 180-n*10, "平角是 180 度。"),
            ("路线", f"向北行 {n*3} 千米，再向南行 {n} 千米，离起点几千米？", n*2, "沿同一条直线往返，位移大小等于两段路程之差。"),
        ]
    if code == "42":
        return [
            ("小数加减", f"{n}.4 元加 2.3 元，共几元？", n+2.7, "小数点对齐，十分位与十分位相加。"),
            ("小数性质", f"{n}.50 米等于多少厘米？", n*100+50, "1 米等于 100 厘米。小数末尾添 0 不改变大小。"),
            ("小数点移动", f"{n}.2 扩大到原来的 10 倍是多少？", n*10+2, "小数点向右移动一位。"),
            ("折线统计图", f"折线图显示周一 {n+12} ℃、周二 {2*n+12} ℃，升了几摄氏度？", n, "用周二温度减去周一温度。"),
            ("垂直", f"{n} 个直角的度数之和是几度？", 90*n, "互相垂直的直线形成直角，一个直角是 90 度。"),
            ("比赛场次", f"{a} 人两两各赛一场，共几场？", a*(a-1)//2, "每人与其他每人各赛一场，每场涉及两人，所以要除以 2。"),
        ]
    if code == "51":
        return [
            ("小数乘法", f"每千克 2.5 元，{n} 千克需几元？", 2.5*n, "单价乘数量等于总价。"),
            ("小数除法", f"{n*3} 升水装入容量为 0.5 升的瓶子，能装满几个？", n*6, "每升能装满 2 个这样的瓶子。"),
            ("平均数", f"三次成绩为 {70+n}、{73+n}、{76+n} 分，平均几分？", 73+n, "把三个成绩相加再除以 3。"),
            ("面积", f"三角形的底为 {2*n} 厘米，高为 5 厘米，面积是多少平方厘米？", 5*n, "底乘对应的高再除以 2。"),
            ("因数和倍数", f"{n} 的最小正倍数与第 3 个正倍数之和是多少？", n*4, f"{n} + {3*n} = {4*n}"),
            ("旅行方案", f"{n} 人每人车票 12.5 元，共需几元？", n*12.5, "总票价等于每人票价乘人数。"),
        ]
    if code == "52":
        return [
            ("正数和负数", f"气温从零下 {n} ℃ 升到零上 3 ℃，升高几摄氏度？", n+3, "先升到 0 ℃，再升到 3 ℃。"),
            ("方程", f"3x + 5 = {3*n+5}，x 是多少？", n, "等式两边先同时减 5，再同时除以 3。"),
            ("体积", f"长方体长 {a}、宽 3、高 {n} 厘米，体积是几立方厘米？", a*3*n, "长方体的体积等于长乘宽乘高。"),
            ("表面积", f"棱长为 {n} 厘米的正方体，表面积是几平方厘米？", 6*n*n, "6 个面都是相同的正方形。"),
            ("容积", f"{n} 升加 200 毫升共几毫升？", n*1000+200, "1 升等于 1000 毫升。"),
            ("可能性", f"袋中 {n} 个红球、{n} 个蓝球，大小相同。抽到红球的可能性是百分之几？", 50, "两种球数量一样，各占总数的一半。"),
        ]
    if code == "61":
        return [
            ("有理数", f"（−{n}）×（−4）= ?", 4*n, "两个负数相乘得正数，绝对值相乘。"),
            ("乘方", f"（−{n}）² = ?", n*n, "底数是一个负数，它的平方为正。"),
            ("代数式", f"当 a = {n} 时，3a − 2 等于多少？", 3*n-2, "先把 a 换成给定值，再按运算顺序计算。"),
            ("一元一次方程", f"2(x − 1) = {2*n}，x 等于多少？", n+1, "两边除以 2，再一起加 1。"),
            ("线段", f"线段长 {4*n} 厘米，中点到一端的距离是几厘米？", 2*n, "中点将线段分成相等的两段。"),
            ("角", f"一个角为 {n*8}°，它的余角是几度？", 90-n*8, "两个互余的角之和是 90 度。"),
        ]
    return [
        ("比例", f"x : 6 = {n} : 3，x 是多少？", 2*n, "第二个比的后项扩大到两倍，前项也要扩大到两倍。"),
        ("百分数", f"{n*40} 的 25% 是多少？", n*10, "25% 等于四分之一。"),
        ("圆的周长", f"圆的直径是 {n} 厘米，π 取 3.14，周长是几厘米？", 3.14*n, "周长等于 π 乘直径。"),
        ("扇形面积", f"圆面积为 {4*n} 平方厘米，90° 扇形面积是多少平方厘米？", n, "90° 占周角的四分之一。"),
        ("圆柱", f"圆柱底面积为 {a} 平方厘米、高 {n} 厘米，体积是几立方厘米？", n*a, "圆柱体积等于底面积乘高。"),
        ("圆锥", f"圆锥与体积为 {6*n} 立方厘米的圆柱等底等高。圆锥体积是几立方厘米？", 2*n, "等底等高时，圆锥体积是圆柱的三分之一。"),
        ("方程组", f"x + y = {3*n}，x − y = {n}，求 x。", 2*n, "两式相加得 2x，再把两边同除以 2。"),
    ]


def fmt(number):
    return f"{number:.3f}".rstrip("0").rstrip(".")


def seed():
    rows = []
    rng = random.Random(2436)
    for code, content in WORDS.items():
        g, t = map(int, code)
        def add(subject, topic, prompt, correct, distractors, explanation, parts=None):
            other = list(dict.fromkeys(x for x in distractors if x != correct))
            options = [correct, *rng.sample(other, 3)]
            rng.shuffle(options)
            rows.append((f"sh{code}-{subject}-{len(rows)}",g,t,subject,topic,prompt,
                         json.dumps(options,ensure_ascii=False),options.index(correct),explanation,
                         json.dumps(parts,ensure_ascii=False) if parts else None))
        pairs = [line.split("|") for line in content.splitlines()]
        for term, meaning in pairs:
            add("chinese","词语理解",f"哪一个词表示“{meaning}”？",term,[a for a,b in pairs],f"“{term}”的意思是{meaning}。")
            add("chinese","词义辨析",f"“{term}”是什么意思？",meaning,[b for a,b in pairs],f"读词时结合语境理解：{meaning}。")
        lines = [line.split("|") for line in LINES[code].splitlines()]
        for en, cn in lines:
            sentence, meaning = en.replace("/", " "), cn.replace("/", "")
            add("english","听读与理解",sentence,meaning,[c.replace("/","") for e,c in lines],
                f"{sentence} 的意思是“{meaning}”。",cn.split("/"))
            add("english","情境表达",f"要表达“{meaning}”，应该说哪句英语？",sentence,
                [e.replace("/"," ") for e,c in lines],f"可以这样说：{sentence}")
        for n in range(2,10):
            for topic, prompt, value, explain in maths(code,n):
                add("math",topic,prompt,fmt(value),[fmt(value+d) for d in (-5,-2,-1,1,2,5,10) if value+d >= 0],explain)
    # Retain existing textbook exercises when their named lesson occurs in the
    # current Shanghai directory; keep older editions out of the live pool.
    with sqlite3.connect(DB) as db:
        paths = [r[0] for r in db.execute("SELECT path FROM topic WHERE grade=2 AND term=1 AND subject='chinese'")]
        raw = subprocess.check_output(["node","--input-type=module","-e",
            "import {RACE_QUESTIONS} from './src/shared/race-questions.ts';console.log(JSON.stringify(RACE_QUESTIONS))"],
            cwd=DB.parents[1], encoding="utf-8")
        for q in json.loads(raw):
            if q["subject"] != "chinese" or q["id"] == "c50" or not any(q["topic"] in path for path in paths):
                continue
            rows.append((q["id"],2,1,"chinese",q["topic"],q["prompt"],json.dumps(q["options"],ensure_ascii=False),q["answer"],q["explain"],None))

        db.execute("BEGIN")
        db.execute("DROP TABLE IF EXISTS question")
        db.execute("""CREATE TABLE question(id TEXT PRIMARY KEY, grade INTEGER, term INTEGER, subject TEXT,
                  topic TEXT, prompt TEXT, options TEXT, answer INTEGER, explain TEXT, parts TEXT,
                  UNIQUE(grade,term,subject,prompt))""")
        db.executemany("INSERT INTO question VALUES(?,?,?,?,?,?,?,?,?,?)", rows)
        db.execute("CREATE INDEX question_course ON question(grade,term,subject)")
    print(f"{len(rows)} original practice items")


if __name__ == "__main__":
    seed()
