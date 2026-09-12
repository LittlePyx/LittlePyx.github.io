from pathlib import Path
import runpy
import torch
import numpy as np

root = Path(__file__).resolve().parent
scope = runpy.run_path(str(root / 'attention_demo.py'))
Attention = scope['CausalSelfAttention']
torch.manual_seed(17)
for b, t, dim, heads in [(1,1,8,1),(2,5,32,4),(3,7,32,8)]:
    model = Attention(dim,heads).eval()
    x = torch.randn(b,t,dim,requires_grad=True)
    y = model(x)
    q,k,v = [z.reshape(b,t,heads,dim//heads).transpose(1,2)
             for z in model.qkv(x).chunk(3,dim=-1)]
    qn,kn,vn=[z.detach().numpy() for z in (q,k,v)]
    ref=np.zeros_like(qn)
    for batch in range(b):
        for head in range(heads):
            for position in range(t):
                scores=np.array([np.dot(qn[batch,head,position],kn[batch,head,j])
                                 / (dim//heads)**0.5 for j in range(position+1)])
                weights=np.exp(scores-scores.max()); weights/=weights.sum()
                ref[batch,head,position]=sum(w*vn[batch,head,j] for j,w in enumerate(weights))
    ref=ref.transpose(0,2,1,3).reshape(b,t,dim) @ model.out.weight.detach().numpy().T
    torch.testing.assert_close(y,torch.from_numpy(ref),atol=1e-6,rtol=1e-5)
    y.square().mean().backward()
    assert torch.isfinite(x.grad).all()
    assert all(p.grad is not None and torch.isfinite(p.grad).all() for p in model.parameters())
print(f'PASS: NumPy reference (3 shapes), causal isolation and finite gradients. PyTorch {torch.__version__}.')
