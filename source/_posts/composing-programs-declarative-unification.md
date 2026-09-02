---
title: 从“怎样执行”到“满足什么”：SQL、逻辑规则与 Unification
date: 2026-09-02 11:00:00
top_img: /img/composing-programs-declarative-unification-nature-cover.jpg
cover: /img/composing-programs-declarative-unification-nature-cover.jpg
cover_credit: "Stefano Unterthiner · National Geographic"
cover_source: "https://www.nationalgeographic.com/photography/article/epic-bird-gallery"
description: Composing Programs 第四章笔记之二：从 SQL 的结果描述走向事实、规则和查询，再用 Unification 解释变量绑定与逻辑推理怎样发生。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - SQL
  - Declarative Programming
  - Logic Programming
  - Unification
toc: true
toc_number: false
katex: false
---

上一篇用 Iterator 和 Generator 把大量数据组织成按需流动的 Pipeline。不过，那条管道仍然由程序员规定了每一个执行步骤：先读取，再过滤，然后转换和聚合。

这一次继续向上抽象：**程序只描述结果必须满足什么条件，执行系统自己决定怎样得到结果。**

本文把教材 [4.3 Declarative Programming](https://www.composingprograms.com/pages/43-declarative-programming.html)、[4.4 Logic Programming](https://www.composingprograms.com/pages/44-logic-programming.html) 和 [4.5 Unification](https://www.composingprograms.com/pages/45-unification.html) 重新组织成一条递进路线：

{% mermaid %}
flowchart TB
    PROCEDURE["命令式程序<br/>描述怎样执行"] --> DECLARE["SQL + Logic Rules<br/>声明结果与关系"]
    DECLARE --> SOLVE["Unification + Search<br/>绑定变量并寻找证明"]
{% endmermaid %}

## 1. 声明式编程隐藏的是执行过程，不是计算本身

假设任务执行记录保存在 `task_runs` 表中：

| task_id | service | status | duration_ms |
|---|---|---|---:|
| t-17 | search | failed | 820 |
| t-18 | storage | succeeded | 140 |
| t-19 | search | failed | 510 |

我们希望得到每个服务失败任务的平均耗时。

### 1.1 命令式写法规定了控制流程

```python
totals: dict[str, int] = {}
counts: dict[str, int] = {}

for run in task_runs:
    if run["status"] != "failed":
        continue

    service = run["service"]
    totals[service] = totals.get(service, 0) + run["duration_ms"]
    counts[service] = counts.get(service, 0) + 1

averages = {
    service: totals[service] / counts[service]
    for service in totals
}
```

这段代码同时描述了：

- 以什么顺序遍历记录；
- 何时跳过一条记录；
- 用哪些中间字典保存状态；
- 怎样完成累加和除法。

### 1.2 SQL 描述结果应该具有什么形状

```sql
SELECT
    service,
    AVG(duration_ms) AS average_duration_ms
FROM task_runs
WHERE status = 'failed'
GROUP BY service;
```

SQL 说明了需要哪些列、哪些行以及怎样分组，却没有指定数据库必须使用哪一种循环、索引或连接算法。

```text
命令式：告诉计算机每一步怎样做
声明式：告诉系统最终结果需要满足什么关系
```

声明式并不意味着“没有执行过程”。过滤、分组和聚合仍然必须发生，只是具体过程由数据库执行器和优化器负责。

{% mermaid %}
flowchart TB
    REQUEST["结果需求 → SQL<br/>列 · 条件 · 分组 · 聚合"]
    REQUEST --> PLAN["数据库选择执行计划"]
    PLAN --> RESULT["关系结果<br/>service + average"]
{% endmermaid %}

## 2. 表与查询操作构成了一套数据变换语言

数据库把结构相似的记录组织成 table。查询再把一个或多个输入表转换成结果表。

### 2.1 四种最重要的关系操作

| 操作 | SQL 中的常见形式 | 作用 |
|---|---|---|
| Selection（选择） | `WHERE` | 保留满足条件的行 |
| Projection（投影） | `SELECT column` | 选择或计算输出列 |
| Join（连接） | `JOIN ... ON` | 按条件组合不同表的行 |
| Aggregation（聚合） | `GROUP BY`、`COUNT`、`SUM` | 把多行汇总成组级结果 |

例如，任务表只保存提交者 ID，用户名称位于另一张表：

```sql
SELECT
    users.name,
    COUNT(*) AS failure_count
FROM task_runs
JOIN users ON users.id = task_runs.user_id
WHERE task_runs.status = 'failed'
GROUP BY users.id, users.name
ORDER BY failure_count DESC;
```

可以用一条概念管道理解查询，但不要把它误认为数据库唯一的物理执行顺序：

{% mermaid %}
flowchart TB
    SOURCE["FROM + JOIN<br/>取得并连接输入行"] --> FILTER["WHERE + GROUP BY<br/>过滤并分组"]
    FILTER --> OUTPUT["SELECT + ORDER BY<br/>形成并排列结果"]
{% endmermaid %}

查询结果仍然是结构化行，因此可以继续被下一层查询、视图或应用程序消费。这种“输入关系 → 输出关系”的闭合性，让复杂查询可以逐层组合。

### 2.2 结果顺序也需要明确声明

没有 `ORDER BY` 时，不应依赖数据库“碰巧”返回的顺序。即使同一条查询今天看起来稳定，索引、数据量或执行计划变化后，行顺序也可能改变。

这是声明式接口的一项基本纪律：**调用者只能依赖查询明确承诺的结果，不应依赖执行器内部碰巧采用的过程。**

## 3. Query Plan 把“要什么”翻译成“怎样算”

同一条 SQL 通常存在多种合法执行方法。以连接用户与失败任务为例：

```text
方案 A：先连接全部任务和用户，再过滤失败记录
方案 B：先过滤出失败任务，再与用户连接
```

如果失败记录只占很小一部分，方案 B 可能显著减少后续工作。数据库还可能根据统计信息选择：

- 全表扫描还是索引扫描；
- 哪张表作为连接的驱动端；
- 使用 nested loop、hash join 还是 merge join；
- 先聚合还是先连接；
- 是否并行执行部分算子。

{% mermaid %}
flowchart TB
    SQL["同一条 SQL"] --> A["Plan A<br/>Join 全量数据<br/>再 Filter"]
    SQL --> B["Plan B<br/>先 Filter<br/>再 Join 少量数据"]
    STATS["索引 · 数据量 · 分布统计"] --> OPT["Optimizer"]
    OPT --> A
    OPT --> B
    A --> RESULT["相同结果"]
    B --> RESULT
{% endmermaid %}

### 3.1 声明式抽象为什么给优化留下空间

命令式循环已经决定了执行顺序，系统很难在不改变可观察行为的前提下随意重排。SQL 主要描述关系结果，只要不同计划产生同样的语义结果，优化器就可以选择成本更低的一种。

因此可以把抽象分工写成：

```text
查询编写者负责：结果条件是否正确
数据库负责：怎样执行这些条件
```

但优化器并非全知。索引缺失、统计信息过期、数据分布倾斜或表达式写法不当，都可能导致计划不理想。工程中应通过 `EXPLAIN` 或 `EXPLAIN ANALYZE` 检查真实计划，而不是凭 SQL 长短判断性能。

### 3.2 ORM 没有消除查询成本

ORM 可以把表映射为对象，但数据库仍然执行查询。典型的 N+1 问题是：

```text
1 次查询取得 N 个 task
随后为每个 task 各查询一次 user
总计 N + 1 次数据库往返
```

对象访问写起来像普通属性，并不代表数据已经在本地。是否预加载、是否连接、产生多少 SQL，仍然需要观察。

## 4. Logic Programming 从“查询记录”走向“推导关系”

SQL 擅长从表中筛选和组合记录。**Logic Programming（逻辑编程）** 进一步允许系统根据事实和规则推导新的关系。

我们用一个权限例子代替教材中的动物族谱。

### 4.1 Fact 表示已经成立的关系

```text
role(alice, reviewer)
role(bob, operator)
grant(reviewer, read_report)
grant(operator, run_task)
```

这些不是函数调用，而是声明：

```text
alice 与 reviewer 之间存在 role 关系
reviewer 与 read_report 之间存在 grant 关系
```

### 4.2 Rule 描述怎样从已有关系推出新关系

```text
allowed(User, Action) :-
    role(User, Role),
    grant(Role, Action)
```

读作：如果某个用户拥有一个角色，并且该角色被授予某个操作，那么用户被允许执行该操作。

规则没有手写“遍历全部用户，再遍历全部角色”的循环。它只描述 `allowed` 成立所需要满足的关系。

### 4.3 Query 留出未知变量

```text
allowed(alice, ?action)
```

查询中的 `?action` 是变量，系统需要寻找能够让整个关系成立的绑定：

```text
?action = read_report
```

{% mermaid %}
flowchart TB
    QUERY["Query<br/>allowed(alice, ?action)"] --> RULE["Rule<br/>role(alice, ?role)<br/>grant(?role, ?action)"]
    RULE --> FACTS["Facts<br/>role(alice, reviewer)<br/>grant(reviewer, read_report)"]
    FACTS --> ANSWER["Bindings<br/>?role = reviewer<br/>?action = read_report"]
    class ANSWER cp-path-good
{% endmermaid %}

## 5. Relation 为什么不只是换一种写法的函数

普通函数通常具有明确方向：

```text
输入 → 执行函数 → 输出
```

关系描述的是多个值之间是否满足约束，并不天然规定哪个位置是输入、哪个位置是输出。

例如：

```text
append_to_form(left, right, whole)
```

同一条关系可以支持不同查询：

```text
已知 left 和 right，求 whole
已知 whole，求所有可能的 left 与 right
已知 left 和 whole，求 right
```

命令式函数往往需要为不同方向编写不同实现；关系则描述三者共同满足的条件，由查询中的已知量和变量决定本次求解方向。

这也是逻辑编程表达力强的来源之一，但代价是系统必须在候选绑定中进行搜索。

## 6. Unification 寻找让两个结构一致的变量绑定

查询怎样与事实或规则连接起来？最基础的操作是 **Unification（合一）**：

> 给定两个可能包含变量的结构，寻找一组变量绑定，使替换变量后的两个结构相同。

### 6.1 从简单匹配开始

```text
查询：role(alice, ?role)
事实：role(alice, reviewer)
```

逐项比较：

| 位置 | 查询 | 事实 | 结果 |
|---|---|---|---|
| 关系名 | `role` | `role` | 相同 |
| 第一个参数 | `alice` | `alice` | 相同 |
| 第二个参数 | `?role` | `reviewer` | 绑定 `?role = reviewer` |

得到 substitution：

```python
{"?role": "reviewer"}
```

### 6.2 同一个变量必须始终表示同一个值

模式：

```text
same(?x, ?x)
```

与 `same(read, read)` 可以合一，得到 `?x = read`；与 `same(read, write)` 不能合一，因为同一个 `?x` 不可能同时绑定两个不同值。

### 6.3 Unification 可以同时处理两边的变量

Pattern matching 常指“用含变量的模式匹配一个确定值”；Unification 更一般，两边都可能包含变量：

```text
allowed(?user, read_report)
allowed(alice, ?action)
```

可以得到：

```text
?user = alice
?action = read_report
```

### 6.4 嵌套结构需要递归合一

```text
event(task(?id), result(failed, ?reason))
event(task(t-17), result(failed, timeout))
```

外层结构相同后，还要递归比较 `task(...)` 和 `result(...)`，最终得到：

```text
?id = t-17
?reason = timeout
```

{% mermaid %}
flowchart LR
    ROOT["event(…, …)"] --> LEFT["task(?id)<br/>↔ task(t-17)"]
    ROOT --> RIGHT["result(failed, ?reason)<br/>↔ result(failed, timeout)"]
    LEFT --> ID["?id = t-17"]
    RIGHT --> REASON["?reason = timeout"]
    ID --> ENV["Bindings"]
    REASON --> ENV
    class ENV cp-path-good
{% endmermaid %}

### 6.5 一个最小 Unification 算法

下面用 tuple 表示结构，以 `?` 开头的字符串表示变量：

```python
def is_variable(value: object) -> bool:
    return isinstance(value, str) and value.startswith("?")


def resolve(value: object, bindings: dict[str, object]) -> object:
    while is_variable(value) and value in bindings:
        value = bindings[value]
    return value


def unify(
    left: object,
    right: object,
    bindings: dict[str, object],
) -> bool:
    left = resolve(left, bindings)
    right = resolve(right, bindings)

    if left == right:
        return True

    if is_variable(left):
        bindings[left] = right
        return True

    if is_variable(right):
        bindings[right] = left
        return True

    if isinstance(left, tuple) and isinstance(right, tuple):
        if len(left) != len(right):
            return False
        return all(
            unify(a, b, bindings)
            for a, b in zip(left, right)
        )

    return False
```

使用：

```python
query = ("role", "alice", "?role")
fact = ("role", "alice", "reviewer")
bindings: dict[str, object] = {}

assert unify(query, fact, bindings)
assert bindings == {"?role": "reviewer"}
```

这个版本足以说明递归结构和变量绑定，但完整实现还需要处理循环绑定、失败回滚、变量重命名等问题。例如 `?x` 与 `f(?x)` 不应形成无限递归的自引用；成熟系统会使用 occurs check 或其他约束避免这种绑定。

## 7. Unification 负责连接，Search 负责寻找整条证明路径

Unification 只回答“这两个局部结构能否一致”。要证明一条查询，解释器还要搜索事实和规则的组合。

对：

```text
allowed(alice, ?action)
```

大致过程是：

```text
1. 将查询与 allowed 规则的结论合一
2. 得到需要满足的子目标 role(alice, ?role)
3. 在事实库中寻找与子目标合一的事实
4. 得到 ?role = reviewer
5. 继续寻找 grant(reviewer, ?action)
6. 得到 ?action = read_report
7. 所有子目标成立，返回绑定
```

如果某一步有多个候选事实，系统要逐个探索；一条路径失败时，再返回最近的选择点尝试其他候选，这就是 backtracking（回溯）。

{% mermaid %}
flowchart LR
    Q["allowed(alice, ?action)"] --> R1["尝试 role = reviewer"]
    Q --> R2["尝试 role = operator"]
    R1 --> G1["grant(reviewer, read_report)"] --> OK["成功<br/>?action = read_report"]
    R2 --> G2["没有匹配 grant"] --> BACK["回溯"]
    class OK cp-path-good
    class G2,BACK cp-path-bad
{% endmermaid %}

### 7.1 声明式语义不等于自动高效

同一组事实和规则可以有清楚的逻辑含义，但不同搜索顺序的性能差异很大：

- 先搜索候选很少的条件，通常更快缩小范围；
- 递归规则缺少终止约束时，可能进入无限分支；
- 重复子目标可能造成大量重复推导；
- 建立索引、缓存中间结果或使用专门求解算法，都可能改变效率。

因此仍然需要区分：

```text
Declarative semantics  描述什么答案是正确的
Evaluation strategy    决定系统怎样寻找这些答案
```

## 8. 工程中怎样使用声明式思想

声明式思想并不限于 SQL 或 Prolog。它反复出现在工程系统中：

| 场景 | 声明内容 | 执行系统负责的过程 |
|---|---|---|
| SQL 查询 | 需要哪些关系结果 | 索引、连接、排序和并行计划 |
| 权限策略 | 哪些主体满足访问条件 | 匹配身份、资源和规则 |
| 配置编排 | 期望系统处于什么状态 | 创建、更新和收敛资源 |
| 数据验证 | 值需要满足哪些约束 | 遍历字段并产生错误信息 |
| 路由规则 | 什么条件选择哪个处理器 | 规则匹配、优先级和回退 |

使用声明式接口时仍需关注三个边界。

### 8.1 语义边界

条件是否准确表达业务含义？例如权限规则中的默认拒绝、继承和优先级需要明确，不应依赖规则引擎的偶然顺序。

### 8.2 性能边界

系统是否拥有合适索引和统计信息？是否产生笛卡尔积、N+1 查询或无界搜索？抽象隐藏了过程，但没有消灭过程的成本。

### 8.3 安全边界

不要通过字符串拼接构造 SQL：

```python
# 错误示例
sql = f"SELECT * FROM task_runs WHERE task_id = '{task_id}'"
```

应使用驱动提供的参数绑定：

```python
cursor.execute(
    "SELECT * FROM task_runs WHERE task_id = ?",
    (task_id,),
)
```

参数化的目的，是把查询结构与输入数据分开，而不是手工猜测应该转义哪些字符。

## 9. 把本篇收束成四个层次

{% mermaid %}
flowchart TB
    GOAL["目标层<br/>想得到什么结果"] --> DECLARE["声明层<br/>SQL · Facts · Rules · Query"]
    DECLARE --> MATCH["匹配层<br/>Unification 建立变量绑定"]
    MATCH --> EXECUTE["执行层<br/>Query Plan · Search · Backtracking"]
{% endmermaid %}

最终需要保留六个判断：

1. **声明式程序隐藏具体执行步骤，但计算仍然真实存在**；
2. **SQL 查询描述关系结果，Query Plan 决定扫描、连接和聚合方式**；
3. **Logic Programming 用 Fact、Rule 和 Query 表达关系与推导**；
4. **关系没有固定输入输出方向**，未知位置由本次查询中的变量决定；
5. **Unification 寻找一致的变量绑定，Search 再组合事实和规则形成证明**；
6. **声明式语义正确不代表执行一定高效**，仍要观察计划、索引和搜索空间。

到这里，数据可以按需流动，计算也可以用更高层的目标来描述。下一篇会处理新的边界：当数据和执行节点位于不同机器上时，函数调用变成网络消息，失败也不再只有“成功”与“抛异常”两种状态。

## 参考

- [Composing Programs 4.3：Declarative Programming](https://www.composingprograms.com/pages/43-declarative-programming.html)
- [Composing Programs 4.4：Logic Programming](https://www.composingprograms.com/pages/44-logic-programming.html)
- [Composing Programs 4.5：Unification](https://www.composingprograms.com/pages/45-unification.html)
- [SQLite 文档：Query Planning](https://www.sqlite.org/queryplanner.html)
- [OWASP：Query Parameterization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html)
