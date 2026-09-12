import torch
from torch import nn

class CausalSelfAttention(nn.Module):
    def __init__(self, dim=32, heads=4):
        super().__init__()
        if heads <= 0 or dim <= 0 or dim % heads:
            raise ValueError("dim 必须是 heads 的正整数倍")
        self.heads = heads
        self.head_dim = dim // heads
        self.qkv = nn.Linear(dim, 3 * dim, bias=False)
        self.out = nn.Linear(dim, dim, bias=False)

    def forward(self, x):
        b, t, d = x.shape
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        q, k, v = [z.reshape(b, t, self.heads, self.head_dim)
                    .transpose(1, 2) for z in (q, k, v)]
        scores = q @ k.transpose(-2, -1) / self.head_dim ** 0.5
        blocked = torch.ones(t, t, device=x.device,
                             dtype=torch.bool).triu(1)
        scores = scores.masked_fill(blocked, float("-inf"))
        weights = scores.softmax(dim=-1)
        y = (weights @ v).transpose(1, 2).contiguous().view(b, t, d)
        return self.out(y)

torch.manual_seed(7)
model = CausalSelfAttention().eval()
x = torch.randn(2, 5, 32)
with torch.no_grad():
    y = model(x)
    altered = x.clone()
    altered[:, 3:] += torch.randn_like(altered[:, 3:]) * 10
    y_altered = model(altered)
assert y.shape == (2, 5, 32)
# 修改未来输入，不应影响前 3 个位置的输出。
torch.testing.assert_close(y[:, :3], y_altered[:, :3])
print("shape and causal isolation: passed")
