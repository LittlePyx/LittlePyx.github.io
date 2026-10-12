---
title: 大语言模型：规模、训练阶段与工程取舍
date: 2026-10-12 10:00:00
updated: 2026-10-12 10:00:00
top_img: /img/happy-llm-training-natgeo-cover.jpg
cover: /img/happy-llm-training-natgeo-cover.jpg
cover_credit: "Maria Stenzel · National Geographic Image Collection"
cover_source: "https://www.nationalgeographic.com/photo-of-the-day/photo/andes-mountains-stars-volcano"
description: Happy-LLM 第四章笔记：从训练预算和数据质量理解大模型能力，讲清预训练、SFT、RLHF 与 DPO，并用显存计算器比较 DDP 和 ZeRO。
categories:
  - Notes
  - AI Agent
tags:
  - Happy-LLM
  - Transformer
  - Inference
toc: true
toc_number: false
katex: false
llm_note: true
---

<p class="llm-cover-credit">封面：安第斯山脉 Llullaillaco 火山上空的星轨 · 摄影 Maria Stenzel / <a href="https://www.nationalgeographic.com/photo-of-the-day/photo/andes-mountains-stars-volcano" target="_blank" rel="noopener noreferrer">National Geographic Image Collection</a></p>

第三章解释了模型怎样预测 token。这一章进一步讨论：同样采用下一 token 预测，为什么训练规模、语料和后续训练不同，会得到使用体验差异很大的模型？从一个基础模型到能稳定回答指令、调用工具的模型，中间还需要哪些工作？

本篇对应 [Happy-LLM 第四章](https://datawhalechina.github.io/happy-llm/#/./chapter4/第四章%20大语言模型)。先确定训练阶段分别优化什么，再讨论算力、数据与显存如何约束训练，最后回到能力评估和应用选择。

<!-- more -->

## 1. 从语言建模到指令模型

### 1.1 “大”体现在哪些方面

LLM 仍是语言模型：给定上下文，输出词表上的条件概率分布。以自回归模型为例：

$$
p_\theta(x_{1:T})=\prod_{t=1}^{T}p_\theta(x_t\mid x_{<t}).
$$

扩大模型并没有改变这条概率分解。变化主要是参数量、训练 token 数、数据覆盖范围和训练计算量，以及后续适配任务的方式。LLM 没有公认的参数量硬门槛，也不应以“是否表现出涌现”为定义标准。

本文用 $N$ 表示模型参数量，$D$ 表示训练过程中实际处理的 token 总数，$C$ 表示训练计算量。$D$ 计入重复训练的 token：同一批文本读三遍，其训练 token 数会增加，但独立信息并没有增加三倍。

### 1.2 三类训练信号分别改变什么

| 阶段 | 一条训练数据提供什么 | 优化什么 | 主要用途 |
| --- | --- | --- | --- |
| 预训练 | 文本及其后续 token | 下一 token 的似然 | 学习可迁移的语言、知识和任务模式 |
| 监督微调 SFT | 指令、上下文和期望回答 | 目标回答的似然 | 适应任务、对话协议与输出形式 |
| 偏好优化 | 同一输入下的回答比较，或可计算的反馈 | 提高偏好或奖励目标 | 调整回答选择与行为倾向 |

预训练、SFT 都可以使用交叉熵，区别在数据分布与监督位置。偏好优化则不必给出唯一的标准回答，而是比较哪些行为更符合训练目标。[InstructGPT](https://arxiv.org/abs/2203.02155) 是理解这一区别的经典案例。

这是一种常见训练组织方式，不是每个模型必须走完的固定流程。已有基础模型可以直接用于续写，也可以只做 SFT；偏好阶段可采用 RLHF 或 DPO 等方法。SFT 同样能够学习新信息和任务能力，不能把各阶段的作用切成互不相干的几块。

## 2. 规模与预算：参数量不是唯一自变量

### 2.1 计算量从哪里来

对常见稠密 Transformer，在忽略部分注意力、词表输出等开销的近似下：

$$
C\approx6ND.
$$

一次前向计算的主要矩阵乘法约为每 token、每参数 2 FLOPs；加上反向传播，粗略得到系数 6。这是<strong>计算量估算</strong>，不能从这个等式单独推出最优训练 token 数。长序列、MoE、激活重计算等情况还会改变实际开销。[Scaling Laws](https://arxiv.org/abs/2001.08361)

例如教学配置取 $N=7\times10^9$、$D=10^{12}$，则 $C\approx4.2\times10^{22}$ FLOPs。若有 $K$ 张卡，每卡持续有效吞吐为 $F_{\mathrm{eff}}$ FLOP/s，计算时间可粗估为：

$$
t_{\mathrm{train}}\approx\frac{C}{KF_{\mathrm{eff}}}.
$$

实际工期还要计入数据读取、保存检查点、评测和故障恢复。硬件标称峰值不是持续有效吞吐，不能直接用峰值算出确定的训练天数。

### 2.2 Scaling law 回答的是资源如何分配

一种常见的经验损失模型为：

$$
L(N,D)\approx L_\infty+\frac{a}{N^\alpha}+\frac{b}{D^\beta}.
$$

$L_\infty$ 是拟合中的损失下限，其他系数由实验确定。在预算 $6ND\le C_0$ 下，扩大 $N$ 会压缩可用的 $D$；模型太大、训练太少，可能不如较小但训练充分的模型。

[Chinchilla](https://arxiv.org/abs/2203.15556) 研究了这种计算最优分配，得到参数量与训练 token 数应共同增长的结论。常见的“约 20 token／参数”是特定实验设定下的经验量级，不是所有数据、模型和预算都适用的常数。

<strong>训练计算最优与部署成本最优也不同。</strong>若模型会服务大量请求，可能值得给较小模型投入更多训练 token，以换取较低的长期推理成本。最终比较应包含训练成本、每次请求成本以及目标质量，而不只看一次预训练的 FLOPs。

## 3. 预训练数据：从网页到可复现的 token 流

### 3.1 数量之外，还要控制什么

训练数据通常混合网页、书籍、代码、论文和其他文本。来源比例决定模型反复接触什么；过滤和去重则决定这些 token 中有多少是有效信息。

| 处理环节 | 具体工作 | 出问题时的后果 |
| --- | --- | --- |
| 提取与规范化 | 提取正文，处理编码、模板、重复导航 | 模型大量学习页面噪声 |
| 质量筛选 | 检查语言、完整性、异常重复与低信息内容 | token 预算被无效文本占用 |
| 去重与污染检查 | 文档／片段去重，排查训练集与评测集重叠 | 泛化评估虚高，重复记忆增加 |
| 数据混合 | 按来源与任务需求采样，记录各域比例 | 总体 loss 下降，但关键领域退化 |
| 分词与打包 | 固定 tokenizer，规定 EOS、文档边界和截断方式 | 输入、标签或注意力边界错误 |

质量不是一个能脱离任务统一排序的分数。只保留规范长文，可能损失代码、口语和短问答；过度过滤小语种，也会改变语言覆盖。筛选规则应结合抽样审查和分域验证集迭代。

### 3.2 文档边界、训练量和恢复

把短文档拼成定长样本能减少 padding，但要明确：文档之间是否允许注意力交互，跨边界的预测是否计入损失。EOS 是一个 token，单独插入它不会自动隔离注意力。

对普通数据并行，若每卡每次处理 $b$ 条序列，数据并行副本数为 $K_{\mathrm{DP}}$，梯度累积次数为 $G$：

$$
B_{\mathrm{global}}=bK_{\mathrm{DP}}G.
$$

这里的 $K_{\mathrm{DP}}$ 不是混合并行时的 GPU 总数。定长、无 padding 时，每步 token 数约为 $B_{\mathrm{global}}T$；变长训练应统计有效 token。只比较“训练了多少步”容易把不同训练量当成同等预算。

要精确续训，除了模型权重，还需要优化器、学习率调度、随机数状态，以及采样器或数据流的读取位置。评测集与训练集还应在同源文档或近重复簇层面隔离，避免仅随机切分文本块造成泄漏。

## 4. 显存与并行：先分清什么占空间

### 4.1 权重能放下，不等于能训练

全参数训练需要保存权重、梯度、优化器状态，以及反向传播需要的激活。下面采用一个明确的教学约定：低精度权重和梯度各 2 字节，FP32 主权重及 Adam 两个状态各 4 字节。

| 状态 | 每参数字节数 | 作用 |
| --- | --- | --- |
| 低精度权重 | 2 | 前向与反向计算 |
| 梯度 | 2 | 累积参数更新方向 |
| FP32 主权重 | 4 | 保留更新精度 |
| Adam 一阶、二阶状态 | 8 | 记录梯度的移动统计量 |
| 合计 | 16 | 不含激活与临时缓冲 |

于是模型状态约占 $16N$ 字节，而仅加载低精度权重约为 $2N$ 字节。7B 参数在此约定下分别为 112 GB 和 14 GB。实际实现可能使用 FP32 梯度、不同优化器或不同主权重策略，应按配置重新核算；GB 表示 $10^9$ 字节，GiB 表示 $2^{30}$ 字节。[ZeRO 论文](https://arxiv.org/abs/1910.02054)

### 4.2 数据并行、模型并行和 ZeRO

| 方法 | 分配什么 | 主要代价 |
| --- | --- | --- |
| 普通数据并行 DDP | 每个副本完整保存模型，处理不同数据 | 同步梯度；完整状态仍在每卡重复 |
| 张量并行 TP | 把层内矩阵计算拆到多卡 | 层内频繁通信 |
| 流水线并行 PP | 把不同层放到不同设备 | 调度与流水线空泡 |
| ZeRO | 在数据并行组内分片训练状态 | 按阶段同步、收集所需状态 |

ZeRO-1 分片优化器状态，ZeRO-2 再分片梯度，ZeRO-3 继续分片参数。这里把 FP32 主权重与 Adam 状态合计为 12 字节／参数，设分片组大小为 $K$，稳态模型状态近似为：

$$
\begin{aligned}
M_{\mathrm{DDP}}&=16N,\\
M_{\mathrm{Z1}}&=4N+\frac{12N}{K},\\
M_{\mathrm{Z2}}&=2N+\frac{14N}{K},\\
M_{\mathrm{Z3}}&=\frac{16N}{K}.
\end{aligned}
$$

ZeRO-3 计算某层时仍要取得所需参数，因此瞬时峰值还包含参数收集和通信缓冲。阶段越高不保证吞吐越低或越高，结果与网络带宽、重叠通信和 batch 等有关。[DeepSpeed ZeRO 说明](https://www.deepspeed.ai/tutorials/zero/)

### 4.3 算一算分片到底省在哪里

下表直接计算上面的公式。修改参数量和分片组大小，观察哪些列变化；当 $K=1$ 时，四种方案应得到相同结果。它只估算模型状态，不用于判断某张卡一定能否完成训练。

<div id="llm-training-budget" class="llm-training-budget">
<div class="training-budget-controls"><label>参数量 N<select name="parameters" aria-label="模型参数量"><option value="1">1B</option><option value="7" selected>7B</option><option value="13">13B</option><option value="70">70B</option></select></label><label>分片组大小 K<select name="ranks" aria-label="数据并行分片组大小"><option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="8" selected>8</option><option value="16">16</option><option value="32">32</option></select></label></div>
<div class="training-budget-scroll" tabindex="0" role="region" aria-label="各分片方案显存对照表，可横向滚动"><table><caption>每卡模型状态 · GB（十进制）；窄屏可横向查看</caption><thead><tr><th scope="col">方案</th><th scope="col">权重</th><th scope="col">梯度</th><th scope="col">主权重＋Adam</th><th scope="col">合计</th></tr></thead><tbody><tr><th scope="row">DDP</th><td>14.00</td><td>14.00</td><td>84.00</td><td>112.00</td></tr><tr><th scope="row">ZeRO-1</th><td>14.00</td><td>14.00</td><td>10.50</td><td>38.50</td></tr><tr><th scope="row">ZeRO-2</th><td>14.00</td><td>1.75</td><td>10.50</td><td>26.25</td></tr><tr><th scope="row">ZeRO-3</th><td>1.75</td><td>1.75</td><td>10.50</td><td>14.00</td></tr></tbody></table></div>
<p class="training-budget-result" aria-live="polite" aria-atomic="true">7B 参数、8 路分片：ZeRO-3 的每卡稳态模型状态为 14.00 GB，DDP 为 112.00 GB。</p>
<p class="training-budget-caption">固定假设：权重 2、梯度 2、主权重与 Adam 12 字节／参数。未计激活、临时参数收集、通信缓冲和显存碎片；没有执行真实训练。</p>
<noscript>当前显示 7B 参数、8 路分片的静态结果。启用 JavaScript 可修改数值。</noscript>
</div>
<link rel="stylesheet" href="/css/llm-training-budget.css">
<script src="/js/llm-training-budget.js" defer></script>

### 4.4 激活、LoRA 与 offload

ZeRO 主要处理模型状态；激活占用仍随 batch、长度和网络结构变化。激活检查点通过反向时重算部分前向结果，减少保存的激活，用额外计算换显存。

LoRA 冻结基座权重，只训练低秩增量。对列向量约定下的权重 $W\in\mathbb R^{d_{\mathrm{out}}\times d_{\mathrm{in}}}$：

$$
W'=W+\frac{\alpha}{r}BA,\qquad
A\in\mathbb R^{r\times d_{\mathrm{in}}},\quad B\in\mathbb R^{d_{\mathrm{out}}\times r}.
$$

新增可训练参数为 $r(d_{\mathrm{in}}+d_{\mathrm{out}})$。这减少了需要保存梯度和优化器状态的参数量，冻结的基座仍需参与前向及相关梯度传播，因此激活和基座存储仍需计算。[LoRA](https://arxiv.org/abs/2106.09685)

Offload 把部分状态放到 CPU 或其他存储，代价是数据传输。选择方法时先看峰值由哪一部分主导：状态太大考虑分片或减少可训练参数，激活太大考虑长度、micro-batch 和重计算。不能把全参数训练的 $16N$ 公式直接套到 LoRA 上。

## 5. SFT：把任务要求变成监督位置

### 5.1 目标仍是回答的条件概率

设 $x$ 为指令和上下文，$y$ 为期望回答：

$$
\mathcal L_{\mathrm{SFT}}=-\frac1{|y|}\sum_{t=1}^{|y|}\log p_\theta(y_t\mid x,y_{<t}).
$$

这是仅监督回答的一种常见目标。模型通过正确回答前缀预测后续 token，学习任务内容、风格、格式和结束方式。SFT 数据应包含部署时真正需要的行为，而不是只收集语句流畅的回答。

例如工具任务至少要区分：信息充分时产生正确参数；信息不足时请求补充；执行失败后根据错误继续处理。只用成功调用的数据，难以评估模型是否能处理缺参数、无结果和工具错误。

### 5.2 消息格式不是展示层细节

```json
{
  "messages": [
    {"role": "user", "content": "把‘需要检查网线’翻译成英文，只输出译文。"},
    {"role": "assistant", "content": "The network cable needs to be checked."}
  ]
}
```

这个 JSON 是数据结构，不是模型最终看到的 token。还要用目标 checkpoint 对应的聊天模板序列化角色、边界和结束标记，再由 tokenizer 编码。工具调用字段和特殊 token 也由模型协议决定，不能跨模型照搬模板。

下面用示意片段说明监督范围，省略真实特殊 token：

| 原序列片段 | 用户标记 | 问题文本 | 助手标记 | 回答文本 | 回答结束 |
| --- | --- | --- | --- | --- | --- |
| 进入模型输入 | 是 | 是 | 是 | 是 | 是 |
| 作为目标计入 loss | 否 | 否 | 按协议约定 | 是 | 通常是 |

被忽略的标签一般使用 `-100` 等约定值，它不是输入中的 `[MASK]`。计算 loss 时再按接口对齐 logits 和下一 token 标签；首个回答 token 由前一个位置的 logits 预测。监督是否覆盖角色标记，要与训练目标和推理入口一致。

截断还可能把整段回答切掉，留下“有输入、无有效标签”的样本。预处理后应检查有效回答 token 数、EOS／结束标记，以及 tokenizer 与模板版本，具体移位见第三章。

### 5.3 多轮对话怎样构造

| 构造方式 | 监督哪些回答 | 适用取舍 |
| --- | --- | --- |
| 整段历史＋最后一轮 | 只监督最后回答 | 适合只有最后一轮经过标注或需要纠正的样本 |
| 按轮展开多个样本 | 每个样本监督该轮回答 | 易于单独采样、加权，前缀计算重复 |
| 一条完整多轮样本 | 监督所有选定助手轮次 | 复用前缀计算，需保证被监督回答质量 |

因果 mask 保证早期回答看不到后续轮次。只监督最后一轮仍能读取前面的历史；监督所有轮次也不意味着所有历史回答都值得模仿。应按标注质量与训练目标选择，而非认定只有一种格式正确。

多轮能力来自模型的上下文建模、训练数据和消息格式共同作用。应用还必须把必要历史提供给模型，或通过持久化会话、摘要和检索恢复历史；普通推理不会自动把上一轮内容写入模型权重。

## 6. 偏好优化：从标准回答到回答比较

### 6.1 奖励模型学的是什么

同一输入 $x$ 可能有多个合理回答，逐 token 模仿一个答案未必能表达“更有依据”“少遗漏步骤”等偏好。偏好样本通常包含 $(x,y^+,y^-)$，分别表示输入、较优回答和较差回答。

以资料问答为例：较优回答引用给定资料并指出缺失信息；较差回答补出了资料中没有的参数。比较应控制无关差异，避免模型只学到“更长的回答总是更好”。

奖励模型 $r_\phi(x,y)$ 输出标量，可用成对损失训练：

$$
\mathcal L_{\mathrm{RM}}=-\mathbb E\left[\log\sigma\big(r_\phi(x,y^+)-r_\phi(x,y^-)\big)\right].
$$

$\sigma$ 为 Sigmoid。损失鼓励较优回答得分更高；奖励分数是学到的相对偏好信号，不是事实正确率，也不要求人类为每个回答标一个绝对分数。经典 RLHF 中，人类先提供比较数据，训练好 RM 后由它批量评分，不必每次参数更新都等待人工反馈。[InstructGPT](https://arxiv.org/abs/2203.02155)

### 6.2 经典 PPO-RLHF 的四种角色

| 角色 | 输出或用途 | 典型训练状态 |
| --- | --- | --- |
| Actor／policy $\pi_\theta$ | 生成回答，计算 token 概率 | 更新 |
| Reference $\pi_{\mathrm{ref}}$ | 对同一回答计算参考概率 | 冻结 |
| Reward model $r_\phi$ | 对输入与完整回答评分 | 策略优化阶段冻结 |
| Critic $V_\psi$ | 估计每个前缀的期望后续回报 | 更新 |

这是四种计算角色，不必对应四份等大的独立模型。Reference 通常对 Actor 采样的同一序列评分，<strong>不需要另生成一段回答，再比较两段文字的“KL”</strong>。

策略优化可以从下面的正则化目标理解：

$$
J(\theta)=\mathbb E_x\left[
\mathbb E_{y\sim\pi_\theta(\cdot\mid x)}r_\phi(x,y)
-\beta D_{\mathrm{KL}}\!\left(\pi_\theta(\cdot\mid x)\|\pi_{\mathrm{ref}}(\cdot\mid x)\right)
\right].
$$

第一项鼓励高奖励，第二项惩罚相对参考策略的过大偏移，$\beta>0$ 控制惩罚强度。KL 比较的是概率分布；在采样实现中，可通过同一回答上的 log 概率比估计相关项。它约束更新，但不保证完全保留原有能力，也不能纠正奖励模型自身的偏差。

PPO 用采样轨迹估计优势 $\widehat A_t$，表示某次 token 选择相对价值基线有多好，再用截断代理目标更新策略：

$$
\rho_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}{\pi_{\mathrm{old}}(a_t\mid s_t)},
$$

$$
J_{\mathrm{clip}}=\mathbb E_t\left[\min\!\left(
\rho_t\widehat A_t,\operatorname{clip}(\rho_t,1-\epsilon,1+\epsilon)\widehat A_t
\right)\right].
$$

$s_t$ 是当前前缀，$a_t$ 是采样 token，$\epsilon$ 控制概率比的截断范围。$\pi_{\mathrm{old}}$ 是收集当前训练批次的旧策略，与长期作为约束基准的 reference 含义不同。Critic 学习回报估计，用于构造优势；它不是第二个回答偏好评分器。这里仅列策略目标，完整训练还包含价值损失等项。[PPO 论文](https://arxiv.org/abs/1707.06347)

### 6.3 DPO：直接利用偏好对更新策略

标准离线 DPO 使用固定的偏好对和参考策略，构造回答的相对 log 概率差：

$$
\Delta_\theta=
\log\frac{\pi_\theta(y^+\mid x)}{\pi_{\mathrm{ref}}(y^+\mid x)}
-\log\frac{\pi_\theta(y^-\mid x)}{\pi_{\mathrm{ref}}(y^-\mid x)},
$$

$$
\mathcal L_{\mathrm{DPO}}=-\mathbb E\left[\log\sigma(\beta\Delta_\theta)\right].
$$

回答的 log 概率由有效回答 token 的 log 概率求和得到。损失推动策略相对 reference 更偏向 $y^+$；它比较的是相对变化，不能简单理解为单独最大化 chosen 的概率。[DPO 论文](https://arxiv.org/abs/2305.18290)

标准 DPO 不需要独立 RM、Critic 和训练中的在线 rollout，训练组织通常更简单；固定 reference 的 log 概率也可预计算。它仍依赖偏好数据覆盖与质量，并不保证在所有任务上优于 PPO。对长度差异、模板、回答 token mask 和独立评测的检查同样重要。

| 方法 | 直接提供的信号 | 训练时的主要工作 |
| --- | --- | --- |
| SFT | 一份期望回答 | 模仿目标回答 |
| PPO-RLHF | RM 对当前策略回答的评分 | 采样、评奖、估计优势、更新策略 |
| 离线 DPO | 预先收集的回答偏好对 | 计算两份回答相对 reference 的概率并优化 |

奖励提高后，任务成功率仍可能下降，例如模型学会迎合评分器或堆积冗长表述。应保留独立人工评估、可执行测试和旧任务回归集，而不是用训练奖励给自己验收。

## 7. 能力怎样评估，边界在哪里

### 7.1 上下文学习、指令遵循与推理

上下文学习（ICL）在输入中提供示例，让预测随当前上下文改变，常规推理不更新权重。GPT-3 对 few-shot 使用方式做了系统研究；示例顺序、格式、相似度与标签一致性都应作为实验条件记录。[GPT-3](https://arxiv.org/abs/2005.14165)

指令遵循考察是否满足任务约束，例如只输出某些字段、引用指定证据或在信息不足时提问。格式合法与任务正确应分别评估：能产生合法 JSON，不代表字段值或工具选择正确。

逐步推理提示在部分任务上能改善表现，但输出了一段解释，并不证明其过程或答案正确。代码测试、计算器、约束检查和外部证据提供的是额外验证信号；应同时记录正确率、生成长度、调用次数和延迟。[CoT 论文](https://arxiv.org/abs/2201.11903)

### 7.2 “涌现”与评测指标

某些能力在模型规模增大时表现出突变，但指标本身也可能制造突变。若只有完整答案全对才计 1 分，局部能力平滑改善也可能在最终得分上呈现陡升。[关于涌现度量的研究](https://arxiv.org/abs/2304.15004)

因此，应同时观察精确匹配、部分正确程度和连续损失，并排查样本量与数据污染。既不能仅凭一个陡升曲线断言发生了能力相变，也不能据此否认大模型的实际能力提升。

### 7.3 长上下文、多语言与多模态

支持输入多少 token，与能否稳定利用其中信息是两项指标。长文本评测应改变证据所在位置、干扰文本数量和跨段依赖；还要测 prefill 延迟与 KV cache。位置编码方案本身不能保证任意长度外推。[Lost in the Middle](https://arxiv.org/abs/2307.03172)

多语言质量取决于数据覆盖、tokenizer 和训练方式。对目标语言，应分别评估理解、生成和术语准确性；同样字符数的文本，也可能占用不同 token 预算。

多模态模型还需要把图像等输入转成可利用的表示，并用相应数据训练连接部分或语言模型。语言模型规模增大不会自动产生视觉输入通道；图像问答能力也不自动等于图像生成能力。[Visual Instruction Tuning](https://arxiv.org/abs/2304.08485)

### 7.4 幻觉与外部证据

下一 token 概率衡量当前模型下的文本可能性，并非事实真值。模型可能生成流畅却缺乏依据的陈述，尤其在资料缺失、问题前提错误或领域分布变化时。

RAG 在生成前引入检索证据，可让知识更新与引用追溯不完全依赖权重更新，但链路仍可能在召回、重排或证据使用上失败。[RAG 论文](https://arxiv.org/abs/2005.11401)

实际系统应允许“无足够证据”这一结果，并检查回答中的关键结论是否被资料支持。涉及工具执行时，还需校验参数、权限与返回值；模型描述“执行成功”不能代替真实工具结果。

## 8. 从问题出发选择改进方法

| 观察到的问题 | 优先检查或尝试 | 怎样确认有效 |
| --- | --- | --- |
| 指令理解偏差，例子能纠正 | 提示与少量示例 | 固定测试集上的任务正确率 |
| 缺少最新或私有知识 | 检索、资料接入、证据组织 | 证据召回率、引用支持率 |
| 经常违反稳定的格式或协议 | 高质量 SFT，配合结构校验 | 格式通过率与语义正确率分别提升 |
| 多个合理回答之间偏好不稳定 | 偏好数据与 DPO／RLHF | 独立偏好评估，旧能力不退化 |
| 领域语言与原语料差异较大 | 评估继续预训练，再做任务适配 | 分域验证损失及下游收益 |
| 回答正确但无法完成真实操作 | 工具接入、执行反馈、恢复策略 | 端到端执行成功率、成本和失败归因 |

这些方法可以组合，但应先有可复现的失败样本，再判断问题来自知识、行为、协议还是执行环境。少量微调样本不是逐条更新事实数据库的可靠替代，增加上下文也不能代替缺失的工具接口。

训练或上线前，固定模型、tokenizer、模板、数据版本、解码参数和评测集。把效果与资源一起记录：任务成功率、延迟、token 消耗、吞吐和显存峰值。涉及多步任务时，还要记录每一步的输入、工具结果与终止原因，才能定位失败发生在哪一环。

## 9. 常见追问

<details><summary>为什么预训练和 SFT 都是下一 token 预测，结果却不同？</summary><p>目标函数形式相同，输入分布和监督位置不同。SFT 让模型反复看到任务指令与期望响应，并把损失集中在目标回答上，从而改变特定上下文下的输出分布。</p></details>

<details><summary>能从 C ≈ 6ND 推出 D 必须是 N 的 20 倍吗？</summary><p>不能。这个式子只约束计算量。确定最优分配还需要损失随参数量和数据量变化的实验关系；具体比例依赖拟合范围、数据和优化目标。</p></details>

<details><summary>为什么 7B 模型的权重只有约 14 GB，训练却远不止这些？</summary><p>还要保存梯度、优化器状态及激活。本文固定的全参数混合精度约定下，模型状态就约为 112 GB；激活、通信和临时缓冲另计。LoRA 等训练方式需要另算。</p></details>

<details><summary>ZeRO-3 分片后，是否每个时刻都只占总状态的 1/K？</summary><p>不是。公式估算稳态分片状态；计算时的参数收集、通信缓冲和激活会形成额外峰值。是否能训练要实测峰值及吞吐。</p></details>

<details><summary>Reference、old policy 和 Critic 分别解决什么问题？</summary><p>Reference 提供偏移约束的基准，old policy 是采样当前批次的策略，Critic 估计后续回报以构造优势。三者不能相互替代。</p></details>

<details><summary>DPO 是否完全不需要参考模型？</summary><p>标准 DPO 的目标包含参考策略的概率。固定参考策略时可以预计算这些值，从而避免每步运行参考模型；这与目标中没有 reference 是两回事。</p></details>

<details><summary>只监督最后一轮，会不会丢掉前面的上下文？</summary><p>不会，只要历史仍在输入中且可被注意力读取。损失只决定哪些目标直接获得监督，不会自动删除输入；区别在于是否利用历史回答作为额外训练目标。</p></details>

<details><summary>训练奖励上升，为什么还要独立评测？</summary><p>奖励模型可能偏好冗长、固定措辞等捷径，模型也可能利用评分器的缺陷。需要用独立样本、事实核查和真实执行结果确认改进是否对应目标任务。</p></details>

上一篇：[预训练语言模型：训练目标、架构与任务适配](/2026/09/21/happy-llm-03-pretrained-language-models/)。
