# -*- coding: utf-8 -*-
"""Pure-Python example: aligned logits, labels and loss masking."""
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
