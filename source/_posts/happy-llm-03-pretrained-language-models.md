---
title: 预训练语言模型：训练目标、架构与任务适配
date: 2026-09-21 10:00:00
updated: 2026-10-09 10:00:00
top_img: /img/happy-llm-plm-natgeo-cover.jpg
cover: /img/happy-llm-plm-natgeo-cover.jpg
cover_credit: "Ramiro Torrents · National Geographic Your Shot"
cover_source: "https://www.nationalgeographic.com/photo-of-the-day/photo/iceland-mountains-reflection"
description: Happy-LLM 第三章笔记：从监督信号和注意力可见范围理解 BERT、T5、GPT 与 LLaMA，比较预训练目标、参数效率、标签对齐和实际任务适配。
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

<p class="llm-cover-credit">封面：冰岛群山与潮水中的倒影 · 摄影 Ramiro Torrents / <a href="https://www.nationalgeographic.com/photo-of-the-day/photo/iceland-mountains-reflection" target="_blank" rel="noopener noreferrer">National Geographic Your Shot</a></p>

第二章解释了 Transformer 怎样计算一个位置的表示。使用同样的注意力和前馈层，模型却可以做不同的事：根据左右文补词、根据前缀续写，或读取一段文本后生成另一段文本。差别来自<strong>位置之间能否互相读取、训练时要求预测什么，以及最后使用哪一种输出</strong>。

本篇对应 [Happy-LLM 第三章](https://datawhalechina.github.io/happy-llm/#/./chapter3/第三章%20预训练语言模型)。先把训练目标与网络架构分开，再看 BERT 怎样学习双向表示、T5 怎样生成目标序列、GPT 怎样续写，最后讨论这些设计如何影响训练数据、显存和任务适配。

<!-- more -->

## 1. 预训练在学习什么

### 1.1 从文本中构造监督信号

第一章已经介绍：模型把 token ID 映射成输入向量，再计算上下文表示，最终通过输出层得到预测分布。预训练要做的，是在大量样本上调整这些共享参数，使预测更准确。

例如，把“请 检查 电源”中的“电源”遮住，原来的“电源”就是标签；把“请 检查”作为前缀，“电源”就是下一个 token 的标签。两种任务都能直接从原文生成训练样本，这就是<strong>自监督学习</strong>。

对一个参与训练的位置，输出头先为词表中每个 token 计算 logit，再用 Softmax 转为概率。设该位置的上下文表示为 $h_t\in\mathbb R^{d_h}$，词表大小为 $N_V$：

$$
z_t=h_tW_{\mathrm{out}}+b,\qquad
p_t(v)=\frac{\exp(z_{t,v})}{\sum_{u=1}^{N_V}\exp(z_{t,u})},\qquad
\ell_t=-\log p_t(y_t).
$$

这里采用行向量写法，$W_{\mathrm{out}}\in\mathbb R^{d_h\times N_V}$；$y_t$ 是正确 token 的 ID，$\ell_t$ 是这个位置的交叉熵。最小化损失会提高正确 token 的预测概率，梯度同时更新输出头、上下文网络和输入 Embedding。具体输出头可能在词表投影前增加变换，例如 BERT 的 MLM 头。

几类预训练任务都可以使用交叉熵，区别主要在于<strong>模型能看到什么，以及哪个 token 是正确答案</strong>：

| 目标 | 模型实际收到什么 | 要预测什么 |
| --- | --- | --- |
| 掩码语言建模 MLM | 部分 token 被替换后的文本 | 指定位置原来的 token |
| 因果语言建模 CLM | 当前可见的前缀 | 下一个 token |
| 去噪序列建模 | 被破坏的源文本与目标前缀 | 原文或被移除片段组成的目标序列 |

下文用 $B$ 表示 batch 中的序列数，$T$ 表示序列长度，$d_h$ 表示隐藏维度，$N_V$ 表示词表大小。张量形状中的长度均指 token 数。

### 1.2 为什么预训练可以迁移到其他任务

为了预测缺失词或后续词，模型需要利用语法、指代、语义关系等信息，这些信息也能帮助分类、抽取和生成任务。迁移时复用的是已经学到的参数：可以继续更新整个网络，也可以冻结主干，只训练新的输出头。下游数据用来调整“怎样利用这些表示完成当前任务”。

| 阶段或方式 | 输入的数据 | 是否更新参数 | 得到什么 |
| --- | --- | --- | --- |
| 预训练 | 大规模文本及自动构造的标签 | 是 | 可迁移的初始模型参数 |
| 任务微调 | 分类、抽取或生成等任务样本 | 是，可能只更新部分参数 | 适配任务的模型 |
| 冻结编码器、训练输出头 | 文本与任务标签 | 只更新输出头 | 复用已有表示的预测器 |
| 提示中的 few-shot 示例 | 作为当前输入的一部分 | 通常否 | 在该上下文条件下产生预测 |

因此，预训练目标和最终任务可以不同：BERT 预训练时补词，微调后可以输出分类标签。迁移效果取决于预训练表示与任务的匹配程度，仍需在独立样本上验证。

## 2. 三种架构：先看信息从哪里来

### 2.1 Encoder、Decoder 分别保留什么

训练目标规定“预测什么”，架构规定“用哪些输入计算预测”。先固定这两层区别，后面的模型就容易比较：MLM 常与双向编码器搭配，CLM 常与因果解码器搭配，去噪生成常与编码器—解码器搭配。它们是常见组合，并非术语之间的一一对应。

| 架构 | 自注意力可见范围 | 是否有编码器—解码器交叉注意力 | 常见输出方式 |
| --- | --- | --- | --- |
| Encoder-only | 输入中的所有有效位置 | 无 | 每个位置的表示，再接任务头 |
| Decoder-only | 当前位置及此前的有效位置 | 通常无 | 由当前位置预测下一 token |
| Encoder–Decoder | 编码器双向；解码器侧因果 | 有 | 根据源文本和已知目标前缀预测下一 token |

三类结构都先计算隐藏表示，再由输出头完成任务。编码器可接分类头或词表预测头，解码器的隐藏表示也可用于分类；具体用途由架构、训练目标和输出头共同决定。

GPT 式 Decoder-only 并不是把原始 Transformer 的 Decoder 原封不动取出来：通常去掉了读取编码器输出的 cross-attention，保留因果自注意力和前馈层。

### 2.2 用可见性矩阵读懂差别

下面每一行表示发出查询的 Query 位置，每一列表示被读取的 Key 位置。深色的 1 表示允许读取，浅色的 0 表示禁止读取；数值表示<strong>可见性</strong>，不是计算出来的注意力权重。示意中没有 padding。

<figure><div style="overflow-x:auto"><img src="/img/happy-llm-plm-visibility.svg" alt="三种注意力可见性：双向自注意力是全一方阵；因果自注意力是含对角线的下三角；交叉注意力的目标查询可以读取全部有效源位置，矩阵为目标长度乘源长度。" style="min-width:680px;width:100%;margin:0"></div><figcaption>左：编码器自注意力；中：解码器自注意力；右：解码器读取编码器输出。窄屏可横向查看。</figcaption></figure>

对因果自注意力，输入位置 $i$ 已经拿到当前 token，允许读取 $j\le i$；它的输出用于预测下一 token，所以对角线可见并不泄漏标签。

对于交叉注意力，源文本长度为 $T_x$、目标长度为 $T_y$，单个头的分数矩阵形状是 $[T_y,T_x]$。Query 来自解码器，Key 和 Value 来自编码器；目标位置可以读取全部有效源文本，但解码器自身仍不能读取未来目标 token。

### 2.3 三种 mask 不要混用

| 名称 | 改变什么 | 例子 |
| --- | --- | --- |
| 输入遮蔽或噪声 | 模型收到的 token 内容 | 把“电源”替换成 `[MASK]` |
| Attention mask | Query 可以读取哪些 Key | 禁止读取未来 token、padding |
| Loss mask | 哪些预测计入损失 | MLM 只监督选中位置；对话训练可只监督回答 |

<strong>不计算某个位置的损失，不代表模型看不到该位置。</strong>例如回答训练中，问题部分可以不计入 loss，却仍是回答必须读取的条件。这一区分会直接影响数据处理代码是否正确。

## 3. BERT：双向表示怎样获得训练信号

### 3.1 输入与输出

原始 BERT 在输入端相加三类向量：token、可学习的绝对位置、句段类型。句对形式通常为 `[CLS] A [SEP] B [SEP]`。经过双向 Transformer 编码器后，得到 $H\in\mathbb R^{B\times T\times d_h}$；这是隐藏表示，尚不是任务标签。[BERT 论文](https://arxiv.org/abs/1810.04805)

输出头决定这些表示怎样使用：MLM 头把位置表示映射到词表，得到 $[B,T,N_V]$ 的 logits；分类头可读取 `[CLS]` 对应表示，输出 $[B,C]$；序列标注头则输出 $[B,T,C]$。$C$ 是任务类别数，$B$、$T$ 分别是 batch 大小和序列长度。

`[CLS]` 提供一个可被任务训练利用的汇总位置，但原始 `[CLS]` 向量不天然就是良好的检索向量。检索通常还需要匹配的训练目标、池化方式和归一化约定。

### 3.2 MLM：预测被选中位置的原 token

设原序列为 $x$，选中的监督位置为 $\mathcal M$，扰动后的输入为 $\tilde x$：

$$
\mathcal L_{\mathrm{MLM}}
=-\frac{1}{|\mathcal M|}\sum_{i\in\mathcal M}
\log p_\theta(x_i\mid\tilde x).
$$

标签始终是原来的 $x_i$。原始 BERT 选择约 15% 的 token 位置；在这些选中位置中，80% 替换为 `[MASK]`，10% 替换为随机 token，10% 保持原样。80/10/10 的分母是<strong>被选中的位置</strong>，不是整段文本。

下面假定“请”“检查”“电源”“。”各是一个 token，只演示一次遮蔽；实际切分由 tokenizer 决定：

| 位置 | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| 原文 | 请 | 检查 | 电源 | 。 |
| 模型输入 | 请 | 检查 | `[MASK]` | 。 |
| 监督目标 | 忽略 | 忽略 | 电源 | 忽略 |

编码器可读取两侧，但被遮蔽的位置收到的是 `[MASK]`，不是原词。选中位置即使保持原样也仍计入 loss；未选中的位置即使参与注意力，也不计入本次 MLM loss。输入里有多少个字面上的 `[MASK]`，不能直接当作监督位置数。

MLM 训练的是指定位置的条件预测，不像从左到右的 CLM 那样直接给出一个标准自回归句子概率。因此，不能把 MLM loss 指数化后就与 CLM 的困惑度直接比较。

### 3.3 NSP 与下游任务

原始 BERT 还使用 NSP：判断两个文本片段是否在原语料中前后相接。它预测的是<strong>句对的关系类别</strong>，不是生成下一句话，也不是逐 token 的 next-token prediction。

任务微调时，保留预训练编码器，并根据输出要求设置任务头。标签体系与预训练词表是两件事：例如三类故障分类需要三个类别 logits，而不是先生成一段文字再解析。抽取式问答可分别预测答案起止位置，还要保证子词位置能够映射回原文。

## 4. RoBERTa 与 ALBERT：训练效率和参数效率

BERT 建立了“预训练双向编码器，再适配下游任务”的方法。沿着这个方法，RoBERTa 主要研究训练是否充分，ALBERT 主要研究参数怎样分配和共享；两者优化的是不同部分。

### 4.1 RoBERTa：先检查模型有没有充分训练

RoBERTa 沿用 BERT 式双向编码器，调整了数据规模、训练长度、batch、输入组织和遮蔽方式，并去掉 NSP，使用 byte-level BPE。动态遮蔽让同一文本在不同呈现时可以选择不同监督位置。[RoBERTa 论文](https://arxiv.org/abs/1907.11692)

它说明训练方案本身就能显著影响结果。复现时，除了训练步数，还要记录每步处理的有效 token 数、语料和计算预算；同样训练一万步，batch 和序列长度不同，实际学习到的数据量也不同。

### 4.2 ALBERT：参数少不等于计算层数少

ALBERT 将词表表示维度 $d_e$ 与隐藏维度 $d_h$ 分开。原来一张 $N_V\times d_h$ 的 Embedding 表，改为 $N_V\times d_e$ 的查找表，再用 $d_e\times d_h$ 的投影：

$$
N_{\mathrm{original}}=N_Vd_h,\qquad
N_{\mathrm{factorized}}=N_Vd_e+d_ed_h.
$$

例如仅比较这部分权重，取 $N_V=30{,}000$、$d_h=768$、$d_e=128$，参数从 23,040,000 降到 3,938,304，约为原来的 17.1%。这不是整个模型的压缩比例。

它还研究跨层参数共享：多次使用同一组层参数，仍然要执行多次层计算。因而<strong>参数存储量、推理运算量和端到端延迟不能相互替代</strong>。真实收益还取决于隐藏宽度、激活、访存和算子实现。[ALBERT 论文](https://arxiv.org/abs/1909.11942)

ALBERT 的 SOP 用相邻片段作为正例，把同一对片段的顺序交换作为负例。与随机拼接负例相比，它让模型更难只靠主题差异判断，训练重点更接近片段顺序关系。

## 5. Encoder–Decoder：读取源文本，生成目标文本

BERT 在输入位置上预测标签，翻译和摘要则需要输出一个长度可变的新序列。Encoder–Decoder 将这两个过程分开：编码器读取完整源文本，解码器逐步生成目标文本。

### 5.1 条件生成与交叉注意力

设源文本为 $x$，目标文本为 $y$。编码器先计算源表示，解码器则同时使用源表示和目标前缀：

$$
p_\theta(y\mid x)=\prod_{t=1}^{T_y}p_\theta(y_t\mid y_{<t},x),\qquad
\mathcal L_{\mathrm{seq2seq}}=-\frac1{T_y}\sum_{t=1}^{T_y}\log p_\theta(y_t\mid y_{<t},x).
$$

在一层交叉注意力中，若暂时省略 batch 和头维度：

$$
Q=H_{\mathrm{dec}}W_{\mathrm Q},\quad
K=H_{\mathrm{enc}}W_{\mathrm K},\quad
V=H_{\mathrm{enc}}W_{\mathrm V}.
$$

此处 $V$ 表示 Value 矩阵，词表大小统一记为 $N_V$。解码器用当前目标表示发出 Query，从源表示中读取相关信息；源、目标长度可以不同。

### 5.2 T5：把任务写成文本到文本

T5 用同一种序列生成接口表达翻译、摘要、问答和分类等任务。比如分类可以把目标写成类别名称，但这些名称仍要经过 tokenizer，可能不止一个 token；统一接口不会自动免除标签映射、格式校验或任务评估。[T5 论文](https://arxiv.org/abs/1910.10683)

T5 的代表性预训练目标是 <strong>span corruption</strong>：移除连续片段，每个片段用不同 sentinel token 占位，解码器输出 sentinel 与被移除内容。示意如下，省略具体实现的起止 token：

```text
原文：设备 无法 联网 ， 请 检查 网线
输入：设备 <extra_id_0> ， 请 检查 <extra_id_1>
目标：<extra_id_0> 无法 联网 <extra_id_1> 网线 <extra_id_2>
```

这里没有让编码器在原位置直接输出被遮蔽词，而是让<strong>解码器生成一个较短的目标序列</strong>。目标中的 sentinel 也是需要预测的 token，用于标识片段边界。

训练时在目标序列前放入起始 token，并移除末尾 token，得到右移一位的 decoder 输入。这样，预测 $y_t$ 的位置只能读取正确目标前缀 $y_{<t}$，这称为 <strong>teacher forcing</strong>。推理时则使用模型自己生成的前缀；前面生成的错误也可能影响后续结果。

T5 的原始设计还使用相对位置偏置和不做均值中心化的归一化。相对位置机制改变位置的表达方式，并不保证任意长输入都能可靠外推。

### 5.3 与 BART 的区别

BART 也使用双向编码器与自回归解码器，但以受扰动文本为输入，重建原始文本；论文考察了文本填充、句子置乱等噪声。[BART 论文](https://arxiv.org/abs/1910.13461)

区分去噪方法时，应同时看“破坏了什么”和“要求输出什么”。T5 的片段目标与 BART 的整段重建，可能具有不同的目标长度、监督量和解码成本，不能仅凭都用了遮蔽就视为同一个任务。

## 6. Decoder-only：从续写到条件任务

条件生成也可以只用一套因果网络：把任务说明、输入文本和回答接在同一个序列里，用前面的内容预测后面的内容。与 Encoder–Decoder 相比，它不再单独编码源文本，也不需要 cross-attention。

### 6.1 CLM 与并行训练

对 token 序列 $x_1,\ldots,x_T$，因果语言模型优化：

$$
\mathcal L_{\mathrm{CLM}}=-\frac1T\sum_{t=1}^{T}\log p_\theta(x_t\mid x_{<t}).
$$

训练样本中的正确前缀都已知，因此同一层可以并行计算各位置，用因果 mask 阻止读取未来目标。推理时下一 token 尚未知，需要逐步生成。<strong>“训练能并行”与“生成要顺序进行”并不矛盾。</strong>

```text
输入：<BOS>  请    检查   网线
标签：请     检查  网线   <EOS>
```

每个输入位置对应它后面的标签。Padding 不计入损失。模型接口若已经内部完成 logits 与 labels 的错位对齐，就不能再由数据管道重复移动一次。

### 6.2 GPT 系列带来的使用方式变化

| 工作 | 这里需要掌握的变化 |
| --- | --- |
| GPT-1 | 先做生成式预训练，再适配有标签的下游任务 |
| GPT-2 | 扩大训练规模，研究直接用文本条件表达不同任务 |
| GPT-3 | 系统研究提示中提供示例的 in-context learning |

这条发展线逐渐扩大了通过文本提示使用模型的范围。具体实现仍需按版本区分，例如 GPT-1 使用可学习的位置 embedding。[GPT-1 论文](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf)、[GPT-2 报告](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf)、[GPT-3 论文](https://arxiv.org/abs/2005.14165)

Few-shot prompting 把示例放入输入，常规推理不更新权重；微调则利用样本计算梯度并更新参数。两者都可能改善任务表现，但前者消耗上下文与请求计算，后者需要训练、版本管理和回归评估。

### 6.3 基础模型与对话模型

基础模型预训练时学习续写；指令微调（SFT）再使用“指令—回答”等数据，使模型适应回答请求的输入输出分布。两者都可以使用下一 token 交叉熵，主要改变的是训练数据及参与损失的位置。后续偏好训练则进一步调整回答的选择倾向。

使用对话模型时，角色和消息边界也必须按训练时的模板编码。消息模板规定输入格式，任务训练决定模型怎样响应，两者需要配套。

例如只训练回答的方案，可以让问题和回答都进入注意力计算，但仅在回答 token 上计算 loss。输入上下文仍然存在，模型只是没有被要求复述问题。工具名称、参数格式和错误处理是否可靠，则需要专门的样本与执行评估。

## 7. LLaMA：理解结构细节与资源代价

LLaMA 延续因果 Decoder-only，但原始设计采用 Pre-Norm、RMSNorm、SwiGLU 与 RoPE 等组合。它们分别影响归一化、前馈变换和位置处理，不能只归结为参数规模变大。[LLaMA 论文](https://arxiv.org/abs/2302.13971)

### 7.1 Pre-Norm、RMSNorm 与 SwiGLU

Pre-Norm 将归一化放在子层之前。忽略实现细节，一层可以写成：

$$
u=h+\operatorname{Attention}(\operatorname{RMSNorm}(h)),\qquad
h^{\prime}=u+\operatorname{FFN}(\operatorname{RMSNorm}(u)).
$$

残差分支保留原状态，注意力负责位置之间的信息交换，FFN 对每个位置做特征变换。两处归一化通常各有自己的参数。

对 $h\in\mathbb R^{d_h}$，RMSNorm 可写为：

$$
\operatorname{RMSNorm}(h)=
\gamma\odot\frac{h}{\sqrt{\frac1{d_h}\sum_{i=1}^{d_h}h_i^2+\epsilon}}.
$$

RMSNorm 用均方根缩放激活，省去 LayerNorm 的减均值步骤；$\gamma$ 是逐特征的可学习缩放向量，$\epsilon$ 用于数值稳定。

忽略偏置，SwiGLU 前馈层可写为：

$$
\operatorname{FFN}(h)=
\left[\operatorname{SiLU}(hW_{\mathrm{gate}})\odot(hW_{\mathrm{up}})\right]W_{\mathrm{down}},
\qquad \operatorname{SiLU}(a)=a\sigma(a).
$$

其中 $\sigma$ 为 Sigmoid，$\odot$ 表示逐元素相乘。一个投影产生门控信号，另一个产生待调节的特征，两者相乘后投影回隐藏维度。

两个输入投影从 $d_h$ 到中间维度 $d_f$，输出投影再回到 $d_h$，参数量约为 $3d_hd_f$。普通两层 FFN 若取中间维度 $4d_h$，参数量约为 $8d_h^2$；要让 SwiGLU 的参数预算接近它，可取 $d_f\approx\frac83d_h$，实际实现再按硬件需求取整。

### 7.2 RoPE 与 GQA 分别解决什么

RoPE 对 Q/K 的成对通道施加位置相关旋转，使点积能够表达相对位置关系；它不是在 token embedding 上再简单加一张位置表。旋转方式、位置索引与长度扩展策略要与 checkpoint 的实现配套，原理见第二章。

GQA 让多组 Query 头共享较少的 K/V 头，减少 KV cache。LLaMA 的不同代际与规格并不完全相同：原始 LLaMA 使用 MHA，Llama 2 的 70B 引入 GQA，Llama 3 报告中的模型进一步采用 GQA。使用时应读取具体配置中的 Query 头数和 K/V 头数，而不是由名称猜测。[Llama 2 报告](https://arxiv.org/abs/2307.09288)、[Llama 3 报告](https://arxiv.org/abs/2407.21783)

一个 batch 中，每层、每个历史位置都要保存 K 和 V。等长输入下，其未压缩缓存体积约为：

$$
M_{\mathrm{KV}}=2LBT H_{\mathrm{KV}}d_{\mathrm{head}}s_{\mathrm{byte}}.
$$

$L$ 是层数，$B$ 是序列数，$T$ 是缓存长度，$H_{\mathrm{KV}}$ 是 K/V 头数，$s_{\mathrm{byte}}$ 是每元素字节数。例如教学配置取 $L=32$、$B=1$、$T=4096$、$H_{\mathrm{KV}}=8$、$d_{\mathrm{head}}=128$，每元素 2 字节，则缓存为 $536{,}870{,}912$ 字节，即 512 MiB。若 K/V 头数为 32，则为 2 GiB。这里仅计算未压缩、未分片的 K/V 张量，不含模型权重、临时激活和分配器开销。

## 8. 把训练目标落实到数据与张量

### 8.1 先写清输入、标签与损失位置

| 目标 | 输入形式 | logits 常见形状 | 哪些位置计算损失 |
| --- | --- | --- | --- |
| MLM | 受扰动的单序列 | $[B,T,N_V]$ | 被选中的监督位置 |
| CLM | 自回归输入序列 | $[B,T,N_V]$ | 对齐后的有效下一 token 目标 |
| Seq2seq | 源序列与右移的目标序列 | $[B,T_y,N_V]$ | 有效目标 token |
| 分类微调 | 文本或文本对 | $[B,C]$ | 每个有效样本 |

### 8.2 对齐标签，再归约损失

对于 CLM，设完整序列为 `[BOS, 请, 检查, 网线, EOS]`。一种常见实现把完整序列同时交给 `input_ids` 和 `labels`，在计算损失时取 `logits[:, :-1, :]` 与 `labels[:, 1:]` 配对；另一种实现由数据管道预先提供错位的输入和标签。<strong>选择其中一种约定，不能把两种位移叠加。</strong>

若只监督回答，先在原序列对应的问题位置把标签设为忽略值，再按接口约定完成对齐。第一个回答 token 仍由它前一个位置的 logits 预测；不能因为前一个位置属于问题，就把这次预测一并丢掉。

设 $y_t$ 是已经对齐的标签，$m_t\in\{0,1\}$ 表示是否参与监督，则一个样本的损失为：

$$
\mathcal L=-\frac{\sum_t m_t\log p_t(y_t)}{\sum_t m_t}.
$$

这里采用有效 token 平均。扩展到 batch 时，应把所有样本的有效损失相加，再除以有效 token 总数；先对每条样本取平均再求平均，会给长短回答相同权重，是另一种加权方式。若有效标签数为零，应报告或跳过该样本。

下面的最小实现用于检查损失数值，减去最大 logit 以稳定计算；输入标签已经对齐。

```python
from math import exp, log

def masked_cross_entropy(logits, labels, ignore_index=-100):
    if len(logits) != len(labels):
        raise ValueError("logits 与 labels 的位置数不一致")
    losses = []
    for row, target in zip(logits, labels):
        if target == ignore_index:
            continue
        if not 0 <= target < len(row):
            raise ValueError("目标 ID 超出词表")
        maximum = max(row)
        log_z = maximum + log(sum(exp(v - maximum) for v in row))
        losses.append(log_z - row[target])
    if not losses:
        raise ValueError("本样本没有有效监督位置")
    return sum(losses) / len(losses)

# 人工构造：两个位置、三个候选 token，只监督第二个位置。
logits = [[0.0, 0.0, 0.0], [0.0, log(2), 0.0]]
labels = [-100, 1]
print(round(masked_cross_entropy(logits, labels), 6))  # 0.693147
```

`-100` 在这里仅表示“该标签不计入 loss”，不是词表中的 token，也不会自动遮掉 attention。接入模型库时，需要再核对它的移位规则、ignore index 和损失归约方式。[可下载的检查脚本](/labs/happy-llm/pretraining_objectives.py)

### 8.3 最常见的实现问题

| 现象 | 先检查什么 |
| --- | --- |
| MLM loss 很低，迁移效果却差 | 是否监督了所有未扰动 token，使复制输入占据主要训练信号 |
| CLM 能“预测”未来，生成却失败 | 因果 mask 是否生效；标签是否和当前位置错误对齐 |
| Seq2seq 训练异常容易 | decoder 输入是否未经右移，直接含当前位置答案 |
| Padding 越多，loss 越低 | 分母是否误用了补齐后的总长度 |
| 单条正常，批量生成结果异常 | padding 方向、position IDs 与最后有效位置是否符合该实现约定 |
| 参数更少却没有更快 | 是否仍执行相同层数；序列长度、KV cache、算子吞吐是否成为瓶颈 |

拼接多个文档训练时，还要决定是否允许跨文档注意力，以及是否监督跨边界的下一 token。插入 EOS 只增加了一个符号，不会自动让 attention 矩阵变成分块对角；是否隔离边界应与训练目标一致。

## 9. 从模型表示到实际任务

### 9.1 输出需求比架构标签更具体

| 实际输出需求 | 可考虑的实现 | 验证重点 |
| --- | --- | --- |
| 固定类别、意图或实体跨度 | 编码器加分类／标注／跨度头 | 类别或实体级指标、批量吞吐、延迟 |
| 大规模文档召回 | 经过检索训练的文本编码器 | 召回率、向量与索引的一致性 |
| 对少量候选精排 | 联合编码 query 与文档的交叉编码器 | 排序收益与候选数带来的计算成本 |
| 根据源文本生成目标文本 | Encoder–Decoder 或条件化 Decoder-only | 目标质量、源信息利用、输出长度 |
| 对话与结构化工具参数 | 适配过该协议的生成模型 | 模板、结构合法性、参数语义、执行结果 |

双编码器可离线缓存文档向量；交叉编码器让 query 与文档在网络内共同交互，但通常要对每个候选重新计算。两者是检索系统中的使用方式，不等同于本章三类 Transformer 架构。[Sentence-BERT](https://arxiv.org/abs/1908.10084)

以检索问答为例，文档编码器先生成可建索引的向量，重排模型对查询与候选文档打分，生成模型再根据选中的证据回答。这三个输出分别是向量、相关性分数和 token 序列，对应不同训练目标。评估也要分开：召回看证据有没有进入候选，重排看证据顺序，生成看答案是否受证据支持。工具调用还需检查参数和实际执行结果。

### 9.2 复现时保存什么

实验记录至少应能还原：模型与 tokenizer 的版本、预训练或微调阶段、消息模板、最大长度与截断方向、attention 和 loss 的掩码规则、输出头、精度、batch，以及独立的评测样本。声称“某架构效果更好”之前，应先确认比较的不是不同语料、不同监督量或不同推理预算。

推理资源也应拆开记录：模型权重、KV cache、临时激活与服务开销分别受什么影响。Encoder-only 编码一次文本与生成数百个 token 的任务并不等价，仅比较参数量不能判断哪个方案更经济。

## 10. 常见追问

<details><summary>BERT 的双向注意力为什么不会总是直接看到答案？</summary><p>MLM 使用受扰动的输入，被选中且替换的位置收到的是遮蔽符号或随机 token，标签保留原 token。原始方案中也有少量选中位置保持原样，但不能据此把整个目标理解为复制输入。</p></details>

<details><summary>MLM 和 CLM 哪个更先进？</summary><p>它们提供不同监督信号：MLM 便于利用双向上下文学习表示，CLM 直接对应自回归生成。应根据需要的输出、数据和预算比较，不能把两种目标排成普遍适用的优劣顺序。</p></details>

<details><summary>为什么只把 BERT 的 mask 改成因果形式，不等于得到 GPT？</summary><p>注意力范围只是其中一项。原来的参数是在 MLM 等目标下训练的，还需要匹配的训练目标、输出使用方式和数据分布；修改 mask 不会自动完成这些适配。</p></details>

<details><summary>Encoder–Decoder 为什么还需要因果 mask？</summary><p>完整源文本可以被编码器双向读取，但未来的目标 token 是待预测答案。解码器的自注意力必须阻止读取这些位置；cross-attention 读取源文本不违反这个约束。</p></details>

<details><summary>ALBERT 层间共享参数，为什么还要保留层数？</summary><p>每次调用共享层时，输入隐藏状态已经变化，多次调用仍然组成更深的计算。共享减少独立权重的数量，不会把多次前向计算合并成一次。</p></details>

<details><summary>不更新权重的 few-shot prompting，为什么也叫“学习”？</summary><p>这里指预测行为随提示中的示例而变化，属于上下文条件化；不是优化器通过梯度修改参数。部署时示例必须随相应上下文提供，也会占用 token 预算。</p></details>

<details><summary>回答 token 才计算 loss，问题 token 是否完全没有梯度？</summary><p>不是。问题位置的输出可以没有直接监督，但回答仍会读取问题的表示，梯度可沿注意力等依赖路径传回相关计算和参数。Loss mask 与计算图的梯度路径是两回事。</p></details>

<details><summary>为什么不能直接用模型名字决定检索和生成方案？</summary><p>同一家族可以有基础版、对话版、检索微调版和不同结构配置。应检查具体 checkpoint 的训练用途、输入协议、输出形式与实测指标，再决定它在系统里承担什么任务。</p></details>

上一篇：[Transformer：注意力、网络结构与自回归推理](/2026/09/12/happy-llm-02-transformer-engineering/)。下一章将进一步讨论大语言模型的训练规模、能力与训练阶段。
