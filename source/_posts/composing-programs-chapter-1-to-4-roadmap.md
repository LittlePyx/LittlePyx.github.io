---
title: "从函数到分布式系统：Composing Programs 第一至第四章总路线图"
date: 2026-09-08 10:00:00
top_img: /img/composing-programs-higher-order-functions-nature-cover.jpg
cover: /img/composing-programs-higher-order-functions-nature-cover.jpg
cover_credit: "Ge Xiao · National Geographic Your Shot"
cover_source: "https://www.nationalgeographic.com/photography/article/wildlife-gallery-yourshot"
description: 串联 Composing Programs 第一至第四章：从函数抽象、对象与状态，到解释器、惰性数据流、声明式系统和分布式计算，建立一张完整的程序设计知识地图。
categories:
  - Notes
  - Computer Science
tags:
  - Python
  - Composing Programs
  - Programming Abstraction
  - Software Engineering
toc: true
toc_number: false
---

<link rel="stylesheet" href="/css/composing-programs-roadmap.css">

这四章并不是四组彼此独立的知识点。它们一直在回答同一个问题：**怎样隐藏容易变化的细节，让程序的其余部分只依赖稳定的规则？**

区别只在于，抽象的边界越来越大：第一章封装一段计算行为，第二章封装数据和状态，第三章封装一门语言的语义，第四章则开始封装数据流、执行策略与机器之间的协作。

<div class="cp-series-hero">
  <span class="cp-series-hero__eyebrow">PROGRAMMING ABSTRACTION</span>
  <strong>四章，其实是一条不断扩大的抽象路线</strong>
  <p>行为可以被组合，数据可以被保护，程序可以被解释，计算可以跨越时间与机器。</p>
</div>

## 1. 先看全局：四章分别扩大了哪一层边界

<div class="cp-series-route" aria-label="Composing Programs 第一至第四章学习路线">
  <a class="cp-series-route__step is-ch1" href="#chapter-1">
    <span>CHAPTER 01</span>
    <strong>行为抽象</strong>
    <small>把函数当作值，组合新的计算规则</small>
  </a>
  <a class="cp-series-route__step is-ch2" href="#chapter-2">
    <span>CHAPTER 02</span>
    <strong>数据与对象</strong>
    <small>让调用者依赖接口，而不是内部表示</small>
  </a>
  <a class="cp-series-route__step is-ch3" href="#chapter-3">
    <span>CHAPTER 03</span>
    <strong>程序与语义</strong>
    <small>把源码变成数据，再由运行时赋予含义</small>
  </a>
  <a class="cp-series-route__step is-ch4" href="#chapter-4">
    <span>CHAPTER 04</span>
    <strong>数据流与系统</strong>
    <small>把计算推迟、拆分，并交给多个执行单元</small>
  </a>
</div>

这条路线可以压缩成四次视角变化：

| 章节 | 不再只把它看成 | 开始把它看成 | 得到的设计能力 |
|---|---|---|---|
| 第一章 | 固定的执行步骤 | 可以传递和组合的行为 | 用高阶函数消除重复控制逻辑 |
| 第二章 | 一堆字段或容器 | 带有契约、身份和协议的对象 | 隔离表示变化，管理共享状态 |
| 第三章 | 只能直接运行的源码 | Token、AST、环境和求值规则 | 理解解释器、DSL 与安全执行 |
| 第四章 | 当前机器上的立即计算 | 按需数据流、声明、消息和任务 | 处理大数据、并发与分布式失败 |

第一章到第四章不是用“更高级”的概念淘汰前面的概念。相反，后面的系统始终建立在前面的能力之上：分布式任务仍需要函数，对象仍需要闭包，解释器仍需要数据抽象，惰性管道仍需要统一协议。

<h2 id="chapter-1">2. 第一章：先学会抽象行为</h2>

普通函数把一组操作封装成一个名字；高阶函数更进一步，把“怎样计算”本身也变成输入或输出。于是程序不必反复复制循环、重试、过滤和转换的控制结构，只需要传入真正会变化的那部分行为。

核心关系是：

```text
函数是一等值
    ↓ 可以作为参数和返回值
高阶函数
    ↓ 返回的函数保留定义环境
闭包
    ↓ 多个小行为连接起来
函数组合、装饰器与可配置流程
```

闭包在这里是连接第一章和后续章节的关键。它既可以保存参数形成新的函数，也可以保存可变状态产生对象身份；第三章的用户函数同样需要把代码与定义环境一起保存，才能实现词法作用域。

<div class="cp-series-chapter is-ch1">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 01 · BEHAVIOR</span>
    <strong>先把变化的行为从固定流程中抽出来</strong>
    <p>重点不是记住 map、filter 或 decorator 的写法，而是理解函数为什么能够成为组合程序的零件。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/07/28/composing-programs-higher-order-functions/">
      <span>01</span>
      <div><strong>高阶函数：从参数化数据到参数化行为</strong><small>一等函数、高阶函数、闭包、组合、柯里化与装饰器</small></div>
      <em>阅读全文 →</em>
    </a>
  </div>
</div>

<h2 id="chapter-2">3. 第二章：从值走向有边界的数据与对象</h2>

函数能组织计算，但程序还要长期保存和修改数据。第二章先用构造器与选择器建立抽象屏障，再引入可变状态和对象身份，最后解释 Python 的类系统怎样把这些机制组织成统一的属性访问协议。

这一章最重要的不是“学会写一个类”，而是分清四个层次：

1. **表示**决定数据在内部怎样保存，例如 tuple、dict 或实例字段；
2. **接口**规定调用者可以做什么，例如构造、查询、更新；
3. **不变量**规定什么状态始终合法；
4. **协议**让不同类型可以被同一段高层代码使用。

只要调用者越过接口直接依赖表示，抽象屏障就被打穿了。只要多个地方能够随意修改同一状态，对象身份又会带来别名、时序和并发问题。因此，封装不只是给字段加下划线，而是限制依赖与修改状态的路径。

<div class="cp-series-chapter is-ch2">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 02 · DATA &amp; OBJECTS</span>
    <strong>从“数据长什么样”推进到“对象承诺什么”</strong>
    <p>先建立数据契约，再理解状态、类机制与泛型协议，顺序不能颠倒。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-data-abstraction/">
      <span>01</span><div><strong>数据抽象：让程序依赖契约而不是表示</strong><small>构造器、选择器、抽象屏障、序列与递归数据</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-mutable-state/">
      <span>02</span><div><strong>可变状态：对象身份与消息传递从何而来</strong><small>绑定、变异、nonlocal、闭包状态、别名与消息分派</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-object-system/">
      <span>03</span><div><strong>对象系统：属性查找、方法绑定与类的实现</strong><small>实例、类、MRO、descriptor、bound method 与继承</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/24/composing-programs-object-abstraction-efficiency/">
      <span>04</span><div><strong>泛型操作：统一协议、表示选择与效率</strong><small>duck typing、Protocol、ABC、dispatch、coercion 与复杂度</small></div><em>阅读全文 →</em>
    </a>
  </div>
</div>

<h2 id="chapter-3">4. 第三章：把程序本身也变成研究对象</h2>

前两章默认 Python 已经知道每句代码是什么意思。第三章把这个前提拆开：源码最初只是一串字符，它必须先被解析成结构，再由求值器按照语言规则执行。

源码先经过词法分析和语法分析，成为 AST。之后，求值器与环境协作产生运行时结果：

| 部分 | 在这条路径中的职责 |
|---|---|
| Token → AST | 从字符中识别词法单位，再建立表达式的结构 |
| Validate / IR | 执行前可以增加校验，并按需要转换为中间表示；简单解释器也可以直接解释 AST |
| Eval | 按节点形式处理表达式；遇到名字就查询环境，遇到组合表达式就递归求值 |
| Apply | 在需要调用过程时，接收已经得到的过程与参数，执行内建操作或进入用户函数体 |
| Environment | 保存名字绑定，供求值过程查询；调用用户函数时，新建环境并绑定参数 |
| Value / Error | 计算完成后返回值，或在对应边界报告失败 |

Eval、Apply 和 Environment 是相互配合的机制。例如，Eval 处理调用表达式时会用到 Apply，而 Apply 执行用户函数体时又会回到 Eval。

这条链把“结构”和“含义”分开了。AST 只说明代码写成什么形状；Eval、Apply、作用域和运行时规则才决定它做什么。也正因为中间存在这些边界，工程上才可以在执行前做校验、转换、优化、权限限制和错误定位。

第三章还把第一章的闭包讲得更完整：一个用户函数不只有函数体，还必须保存定义时的环境。调用时创建的新 frame 负责本次参数，closure 指向的环境负责自由变量；这就是词法作用域能够成立的原因。

<div class="cp-series-chapter is-ch3">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 03 · LANGUAGE</span>
    <strong>让语法、语义和运行时各自承担清楚的责任</strong>
    <p>理解这条路径后，解释器、规则引擎、模板系统和受限表达式执行就不再是黑盒。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/08/27/composing-programs-source-to-ast/">
      <span>01</span><div><strong>程序如何成为数据：从源码到 Token、AST 与 IR</strong><small>词法分析、语法分析、结构校验与中间表示</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/27/composing-programs-evaluator-error-boundary/">
      <span>02</span><div><strong>求值器如何赋予语义：Eval、Apply 与错误边界</strong><small>表达式分派、特殊形式、过程调用、REPL 与错误分层</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/08/27/composing-programs-runtime-abstraction/">
      <span>03</span><div><strong>运行时如何支持抽象：环境、闭包、作用域与安全执行</strong><small>frame、lexical scope、执行预算、能力边界与可观测性</small></div><em>阅读全文 →</em>
    </a>
  </div>
</div>

<h2 id="chapter-4">5. 第四章：让计算跨越时间、数据规模与机器</h2>

到了第四章，问题不再只是“某个表达式怎样求值”，而是：数据可能放不进内存、结果可能晚些才需要、执行可能发生在其他线程、进程或机器上，此时程序应该怎样保持可组合、可恢复和可解释？

四篇笔记分别处理四种扩张：

- **时间上的扩张**：Iterator 与 Generator 让数据按需产生，消费端驱动整条 Pipeline；
- **表达方式的扩张**：SQL、Fact 与 Rule 描述目标，执行器选择扫描、连接或搜索路径；
- **机器边界的扩张**：本地调用变成消息后，必须面对超时、重试、重复和部分失败；
- **计算规模的扩张**：并发组织等待，并行利用多个执行单元，MapReduce 按 key 拆分并重新聚合工作。

第四章并没有离开前三章。惰性 Pipeline 依靠第一章的函数组合和第二章的迭代协议；声明式系统需要第三章的解析与求值；分布式任务仍要依靠数据契约、纯函数、幂等状态更新和明确错误边界。

<div class="cp-series-chapter is-ch4">
  <div class="cp-series-chapter__intro">
    <span>CHAPTER 04 · SYSTEMS</span>
    <strong>当执行不再立即、单机、同步完成</strong>
    <p>接口之外还要设计时间、容量、失败语义和状态所有权。</p>
  </div>
  <div class="cp-series-links">
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-lazy-pipeline/">
      <span>01</span><div><strong>数据如何按需流动：Iterator、Generator 与惰性 Pipeline</strong><small>迭代协议、yield、惰性转换、终止操作与背压</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-declarative-unification/">
      <span>02</span><div><strong>从“怎样执行”到“满足什么”：SQL、逻辑规则与 Unification</strong><small>声明式接口、Fact、Rule、变量绑定、搜索与查询计划</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-distributed-reliability/">
      <span>03</span><div><strong>机器之间如何协作：消息、协议与分布式失败</strong><small>schema、deadline、timeout、retry、idempotency 与 tracing</small></div><em>阅读全文 →</em>
    </a>
    <a href="https://littlepyx.github.io/2026/09/02/composing-programs-parallel-mapreduce/">
      <span>04</span><div><strong>计算如何同时展开：并发、并行、MapReduce 与共享状态</strong><small>I/O 与 CPU、race、lock、queue、Map–Shuffle–Reduce</small></div><em>阅读全文 →</em>
    </a>
  </div>
</div>

## 6. 三条贯穿四章的主线

如果只按章节记忆，概念仍然容易散开。更稳定的理解方式，是沿着三类问题横向回看四章。

<div class="cp-series-threads">
  <section>
    <span>THREAD 01</span>
    <strong>变化应该被放在哪里？</strong>
    <p><b>高阶函数</b>把变化放进函数参数，<b>数据抽象</b>把变化限制在接口实现，<b>解释器</b>把变化放进节点规则，<b>声明式与分布式系统</b>把执行策略交给运行时或框架。</p>
  </section>
  <section>
    <span>THREAD 02</span>
    <strong>状态由谁拥有？</strong>
    <p><b>闭包</b>保存局部环境，<b>对象</b>形成持久身份，<b>Environment</b>管理语言中的名字绑定，<b>并发与分布式系统</b>进一步要求锁、队列、事务、分区所有权和幂等更新。</p>
  </section>
  <section>
    <span>THREAD 03</span>
    <strong>调用双方依赖什么？</strong>
    <p>从<b>函数签名</b>到<b>对象协议</b>，再到<b>语言语义</b>和<b>网络 Schema</b>，依赖越来越正式。边界越远、失败成本越高，契约就越需要显式、可验证和可演进。</p>
  </section>
</div>

### 6.1 主线一：从复用代码到控制变化

最初，我们用函数避免复制代码；随后发现，真正需要复用的往往不是几行语句，而是一种控制结构。高阶函数允许替换行为，数据抽象允许替换表示，对象协议允许替换类型，解释器允许替换语法节点，声明式系统甚至允许替换整套执行计划。

因此，判断一个抽象是否有效，不是看它用了多少类或设计模式，而是看：**需求变化时，修改能否被限制在少数清楚的边界内。**

### 6.2 主线二：状态让时间进入程序

纯函数的结果只由输入决定；一旦引入可变状态，同一个调用在不同时刻可能得到不同结果。对象身份、迭代器位置、生成器暂停点、解释器环境、并发队列和分布式任务状态，本质上都在记录“系统已经走到哪里”。

这也解释了为什么后续章节不断强调状态边界：状态越多、拥有者越分散，程序越容易受到调用顺序、别名、竞争条件、重复消息和部分失败的影响。

### 6.3 主线三：距离越远，契约越重要

同一函数里的局部调用失败，调用栈通常足以定位问题；两个对象之间协作，需要清楚的公开 API；解释器执行用户输入，需要语法校验、资源预算和能力限制；跨机器发送消息，则还要定义版本、超时、重试和幂等语义。

可以用一句话概括：**抽象边界越大，默认共享的上下文越少，契约就必须越明确。**

## 7. 用一条完整路径把概念接起来

假设系统要持续接收文本请求，解析其中的规则，调用相应操作，并把结果可靠地交付出去。四章知识会自然落在同一条路径上：

<div class="cp-series-pipeline" aria-label="四章知识在一个请求处理系统中的连接方式">
  <div><span>01</span><strong>组合行为</strong><small>用函数与装饰器组织校验、转换和重试策略</small></div>
  <i>→</i>
  <div><span>02</span><strong>建立对象边界</strong><small>用协议表达请求、结果、工具与状态存储</small></div>
  <i>→</i>
  <div><span>03</span><strong>解析并赋予语义</strong><small>把文本变成 AST，校验后在受控环境中求值</small></div>
  <i>→</i>
  <div><span>04</span><strong>按需并可靠执行</strong><small>流式消费、并发调度，通过消息跨服务协作</small></div>
</div>

在这条路径里：

- 高阶函数让处理步骤可以组合，而不是写成一整个不可替换的大函数；
- 数据抽象与 Protocol 让上层只依赖能力，不绑定某个具体实现；
- AST、Eval 与 Environment 让外部规则先成为可检查的数据，再进入运行时；
- Generator 控制内存与消费速度，并发执行提高资源利用率；
- timeout、retry、idempotency 和 trace 让跨服务调用在失败时仍可恢复、可解释。

这就是四章真正串起来的地方：它们共同把一个复杂系统拆成**可以独立理解、替换、验证和恢复的边界**。

## 8. 容易混淆的概念，放在一起区分

| 容易混淆的概念 | 应该保留的区别 |
|---|---|
| 函数对象与函数调用 | 前者是可传递的行为，后者是一次执行产生的结果 |
| 闭包与对象 | 都能保存状态；闭包通过词法环境保存，对象通过实例身份和属性协议组织 |
| 接口与表示 | 接口描述允许怎样使用，表示决定内部怎样存储 |
| 类型注解与运行时校验 | 注解主要服务静态分析，运行时数据仍需显式验证 |
| AST 与执行结果 | AST 保存程序结构，求值器才根据语义产生结果 |
| Eval 与 Apply | Eval 解释表达式，Apply 调用已经求值得到的过程 |
| 惰性与异步 | 惰性决定何时产生值，异步决定等待期间是否让出执行权 |
| 并发与并行 | 并发关注多个任务推进，并行关注多个任务同时执行 |
| 超时与失败 | 超时只说明没有及时收到结果，远端可能未执行、正在执行或已经完成 |
| Retry 与幂等 | Retry 负责再次尝试，幂等负责让重复尝试不产生重复业务效果 |

## 9. 最后形成的程序设计判断

读完四章后，真正值得留下的不是零散术语，而是下面这组判断顺序：

1. 先找到会变化的部分，再决定把它放进函数、对象、规则还是执行策略；
2. 先定义调用者需要的最小能力，再选择内部数据结构和具体类型；
3. 一旦存在可变状态，就明确所有者、合法状态、修改入口和并发边界；
4. 面对外部输入，先解析成结构化数据，校验后再赋予执行能力；
5. 面对大量或持续数据，优先考虑按需产生、流式转换和背压；
6. 面对等待与计算，先区分 I/O-bound 和 CPU-bound，再选择并发或并行模型；
7. 一旦跨越进程或机器，就显式设计 schema、deadline、retry、idempotency 与 observability；
8. 抽象并不会消除成本，它只是把变化和复杂性移动到更合适、更可控的位置。

从第一章到第四章，程序设计的视角完成了一次扩展：

```text
组合函数
  → 组织数据与状态
    → 定义语言和运行时
      → 协调数据流、任务与机器
```

无论系统规模怎样变化，核心方法始终一致：**找出边界，明确契约，限制状态，隔离变化。**
