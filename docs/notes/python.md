# Python 笔记

## 常用内置技巧

### 列表推导式

```python
# 普通写法
result = []
for x in range(10):
    if x % 2 == 0:
        result.append(x ** 2)

# 推导式
result = [x ** 2 for x in range(10) if x % 2 == 0]
```

### 解包赋值

```python
first, *rest = [1, 2, 3, 4, 5]
# first = 1, rest = [2, 3, 4, 5]

a, b = b, a  # 交换变量，无需临时变量
```

### 字典合并（Python 3.9+）

```python
d1 = {'a': 1}
d2 = {'b': 2}
merged = d1 | d2  # {'a': 1, 'b': 2}
```

## 常用标准库

| 库 | 用途 |
|----|------|
| `pathlib` | 文件路径操作（替代 os.path） |
| `dataclasses` | 数据类，减少样板代码 |
| `contextlib` | 上下文管理器工具 |
| `itertools` | 高效迭代工具 |

## 虚拟环境

```bash
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
.venv\Scripts\activate      # Windows

pip install -r requirements.txt
```
