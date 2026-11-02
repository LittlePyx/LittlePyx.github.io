"""Offline teaching checks. No model calls, tool execution, or training."""
from math import comb, isclose, isfinite, sqrt


def group_advantages(rewards, normalize=True, epsilon=1e-8):
    if len(rewards) < 2 or not all(isfinite(r) for r in rewards):
        raise ValueError("need at least two finite rewards")
    if not isfinite(epsilon) or epsilon <= 0:
        raise ValueError("epsilon must be positive and finite")
    mean = sum(rewards) / len(rewards)
    std = sqrt(sum((r - mean) ** 2 for r in rewards) / len(rewards))
    return [(r - mean) / (std + epsilon) if normalize else r - mean for r in rewards]


def align_targets(tokens, owners):
    if len(tokens) != len(owners) or len(tokens) < 2:
        raise ValueError("tokens and owners must have equal length >= 2")
    allowed = {"prompt", "action", "observation"}
    if any(owner not in allowed for owner in owners):
        raise ValueError("unknown token owner")
    return tokens[:-1], tokens[1:], [int(owner == "action") for owner in owners[1:]]


def pass_at_k(n, c, k):
    if not all(isinstance(x, int) for x in (n, c, k)) or not (0 <= c <= n and 1 <= k <= n):
        raise ValueError("require integers with 0 <= c <= n and 1 <= k <= n")
    return 1.0 if n - c < k else 1.0 - comb(n - c, k) / comb(n, k)


def checks():
    assert group_advantages([1, 0, 0, 1], False) == [0.5, -0.5, -0.5, 0.5]
    assert all(isclose(a, b, abs_tol=1e-7) for a, b in zip(group_advantages([1, 0, 0, 1]), [1, -1, -1, 1]))
    assert group_advantages([0, 0, 0, 0]) == [0, 0, 0, 0]
    assert group_advantages([1, 1, 1, 1]) == [0, 0, 0, 0]
    seq = [11, 12, 21, 31, 32, 22]
    owners = ["prompt", "prompt", "action", "observation", "observation", "action"]
    inputs, targets, mask = align_targets(seq, owners)
    assert inputs == [11, 12, 21, 31, 32]
    assert targets == [12, 21, 31, 32, 22] and mask == [0, 1, 0, 0, 1]
    assert pass_at_k(4, 2, 1) == 0.5
    assert isclose(pass_at_k(4, 2, 2), 5 / 6)
    assert pass_at_k(4, 0, 4) == 0 and pass_at_k(4, 4, 1) == 1
    for fn, args in [(group_advantages, ([1],)), (group_advantages, ([1, float('nan')],)), (align_targets, ([1, 2], ['prompt'],)), (pass_at_k, (4, 2, 5))]:
        try:
            fn(*args)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid input accepted")
    print("PASS: group advantages, degenerate groups, target-aligned observation mask, Pass@k, input checks")


if __name__ == "__main__":
    checks()
