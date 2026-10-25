# 三个模型密钥的实际请求测试

测试时间：2026年10月25日 16:48:19 至 2026年10月25日 16:51:32（Asia/Shanghai）。

读取 Windows 已保存的 User 环境变量，缺省时读取 Machine 环境变量；没有写入或展示任何密钥值。请求逐个绑定密钥和上游模型 ID，不使用跨密钥回退。

请求参数：stream=true，max_tokens=2048，temperature=0.5，单次 60 秒超时；消息为“连接测试，请仅回复 OK。”。成功要求收到非空正文并完整结束流，成功项均实际返回 OK 或 OK。

目录条目含同一模型的不同供应通道，不能直接当作不同模型数量。除各自完整目录外，还对页面中的 Gemini 2.5 Pro 等模型和第二密钥的额外通道进行了探测。

共完成 101 次请求。

## 重要限制

主密钥 FREE_API_KEY 在测试过程中开始返回 insufficient_user_quota（HTTP 403），后续响应显示余额小于 0。因此已成功的模型代表当时可调用；当前主密钥被余额限制。33 个余额阻断项不能判定为模型不支持。额度变化的具体计费需在供应商账单中核对。

## 汇总

| 密钥变量 | 项目配置地址 | 目录条目数 | 实际探测数 | 成功 | 超时 | 余额阻断 | 无可用通道 |
|---|---|---:|---:|---:|---:|---:|---:|
| FREE_API_KEY | https://api.fuka.win/v1 | 64 | 65 | 25 | 6 | 33 | 1 |
| FREE_API_KEY_2 | https://jianzhile.vip/v1 | 0 | 15 | 0 | 0 | 0 | 15 |
| FREE_API_KEY_3 | https://api.fuka.win/v1 | 20 | 21 | 14 | 6 | 0 | 1 |

## FREE_API_KEY

目录 HTTP 状态：200；目录 64 条。

实测成功模型（去除通道前缀后）：Claude 4.5 Opus、Claude 4.5 Opus Thinking、Claude 4.6 Opus、Claude 4.6 Opus Thinking、Claude 4.8 Opus、Claude 4.8 Opus Thinking、Claude 5 Opus、Claude 5.5 Opus、DeepSeek V4 Flash、DeepSeek V4 Pro、GPT-5.4、GPT-5.5、GPT-5.6 Sol、GPT-5.6 Terra、Gemini 3.5 Flash、Gemini 3.7 Flash、Gemini 4 Argon。

| 模型名称 | 完整上游 ID | 在该密钥目录中 | 结果 | 耗时（秒） | 说明 |
|---|---|---|---|---:|---|
| Claude 4.5 Opus Thinking | `[百香果+]claude-4.5-opus-thinking⑥` | 是 | 通过 | 5.47 | 返回 OK，流式响应完整结束 |
| Claude 4.5 Opus | `[百香果+]claude-4.5-opus⑥` | 是 | 通过 | 4.85 | 返回 OK，流式响应完整结束 |
| Claude 4.6 Opus Thinking | `[百香果+]claude-4.6-opus-thinking⑥` | 是 | 通过 | 4.92 | 返回 OK，流式响应完整结束 |
| Claude 4.6 Opus | `[百香果+]claude-4.6-opus⑥` | 是 | 通过 | 4.35 | 返回 OK，流式响应完整结束 |
| Claude 4.8 Opus Thinking | `[百香果+]claude-4.8-opus-thinking⑥` | 是 | 通过 | 4.14 | 返回 OK，流式响应完整结束 |
| Claude 4.8 Opus | `[百香果+]claude-4.8-opus⑥` | 是 | 通过 | 3.36 | 返回 OK，流式响应完整结束 |
| Claude 5 Opus | `[百香果+]claude-5-opus⑥` | 是 | 通过 | 3.67 | 返回 OK，流式响应完整结束 |
| Claude 5.5 Opus | `[百香果+]claude-5.5-opus⑥` | 是 | 通过 | 4.26 | 返回 OK，流式响应完整结束 |
| GLM-5.1 | `[采桑子]glm-5.1①` | 是 | 余额阻断 | 0.38 | 余额不足；本次无法判断该通道是否可用 |
| GLM-5.2 | `[采桑子]glm-5.2②` | 是 | 余额阻断 | 0.37 | 余额不足；本次无法判断该通道是否可用 |
| GLM-5.3 | `[采桑子]glm-5.3②` | 是 | 余额阻断 | 0.36 | 余额不足；本次无法判断该通道是否可用 |
| DeepSeek V4 Flash | `[蝶恋花]deepseek-v4-flash①` | 是 | 通过 | 5.73 | 返回 OK，流式响应完整结束 |
| DeepSeek V4 Pro | `[蝶恋花]deepseek-v4-pro①` | 是 | 通过 | 16.33 | 返回 OK，流式响应完整结束 |
| DeepSeek V4.1 Flash | `[蝶恋花]deepseek-v4.1-flash①` | 是 | 余额阻断 | 0.39 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 4 Argon | `[芙蓉浦]gemini-4-argon` | 是 | 通过 | 3.24 | 返回 OK，流式响应完整结束 |
| Claude 4.5 Opus Thinking | `[覆盆子]claude-4.5-opus-thinking⑧` | 是 | 余额阻断 | 0.39 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.5 Opus | `[覆盆子]claude-4.5-opus⑧` | 是 | 余额阻断 | 0.36 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus Thinking | `[覆盆子]claude-4.6-opus-thinking⑧` | 是 | 余额阻断 | 0.36 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus | `[覆盆子]claude-4.6-opus⑧` | 是 | 余额阻断 | 0.38 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.5 Opus | `[孤生竹]claude-4.5-opus` | 是 | 通过 | 3.58 | 返回 OK，流式响应完整结束 |
| Claude 4.5 Opus Thinking | `[孤生竹]claude-4.5-opus-thinking` | 是 | 通过 | 3.84 | 返回 OK，流式响应完整结束 |
| Claude 4.6 Opus | `[孤生竹]claude-4.6-opus` | 是 | 通过 | 3.13 | 返回 OK，流式响应完整结束 |
| Claude 4.6 Opus Thinking | `[孤生竹]claude-4.6-opus-thinking` | 是 | 通过 | 2.96 | 返回 OK，流式响应完整结束 |
| Gemini 2.5 Pro | `[故人情]gemini-2.5-pro` | 否 | 失败 | 0.8 | 上游返回无可用模型通道 |
| Gemini 3 Pro Preview | `[故人情]gemini-3-pro-preview` | 是 | 超时 | 60 | 60秒超时 |
| Gemini 3.1 Pro Preview | `[故人情]gemini-3.1-pro-preview` | 是 | 超时 | 60.01 | 60秒超时 |
| Gemini 3.5 Flash | `[故人情]gemini-3.5-flash` | 是 | 通过 | 3.32 | 返回 OK，流式响应完整结束 |
| Gemini 3.6 Flash | `[故人情]gemini-3.6-flash` | 是 | 超时 | 60.01 | 60秒超时 |
| Gemini 3.7 Flash | `[故人情]gemini-3.7-flash` | 是 | 通过 | 5.43 | 返回 OK，流式响应完整结束 |
| Gemini 3.8 Flash | `[故人情]gemini-3.8-flash` | 是 | 超时 | 60.01 | 60秒超时 |
| Gemini 4 Argon | `[故人情]gemini-4-argon` | 是 | 通过 | 6.05 | 返回 OK，流式响应完整结束 |
| GPT-5.4 | `[浣溪沙]gpt-5.4①` | 是 | 通过 | 6.26 | 返回 OK，流式响应完整结束 |
| GPT-5.5 | `[浣溪沙]gpt-5.5①` | 是 | 通过 | 10.18 | 返回 OK，流式响应完整结束 |
| GPT-5.6 Sol | `[浣溪沙]gpt-5.6-sol③` | 是 | 通过 | 2.59 | 返回 OK，流式响应完整结束 |
| GPT-5.6 Terra | `[浣溪沙]gpt-5.6-terra②` | 是 | 通过 | 3.1 | 返回 OK，流式响应完整结束 |
| Claude 4.5 Opus | `[金缕衣]claude-4.5-opus` | 是 | 余额阻断 | 0.37 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.5 Opus Thinking | `[金缕衣]claude-4.5-opus-thinking` | 是 | 余额阻断 | 0.35 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus | `[金缕衣]claude-4.6-opus` | 是 | 余额阻断 | 0.38 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus Thinking | `[金缕衣]claude-4.6-opus-thinking` | 是 | 余额阻断 | 0.39 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3.1 Pro Preview | `[龙舌兰]gemini-3.1-pro-preview①` | 是 | 余额阻断 | 0.35 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.5 Opus Thinking | `[蔓越莓]claude-4.5-opus-thinking⑭` | 是 | 通过 | 4.21 | 返回 OK，流式响应完整结束 |
| Claude 4.5 Opus | `[蔓越莓]claude-4.5-opus⑭` | 是 | 余额阻断 | 1.66 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus Thinking | `[蔓越莓]claude-4.6-opus-thinking⑭` | 是 | 余额阻断 | 0.42 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus | `[蔓越莓]claude-4.6-opus⑭` | 是 | 余额阻断 | 0.8 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.5 Opus | `[霓裳曲]claude-4.5-opus` | 是 | 余额阻断 | 0.36 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus | `[霓裳曲]claude-4.6-opus` | 是 | 余额阻断 | 0.67 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.7 Opus | `[霓裳曲]claude-4.7-opus` | 是 | 余额阻断 | 0.37 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.8 Opus | `[霓裳曲]claude-4.8-opus` | 是 | 余额阻断 | 0.35 | 余额不足；本次无法判断该通道是否可用 |
| Claude 5 Opus | `[霓裳曲]claude-5-opus` | 是 | 余额阻断 | 0.36 | 余额不足；本次无法判断该通道是否可用 |
| Claude 5.5 Opus | `[霓裳曲]claude-5.5-opus` | 是 | 余额阻断 | 0.38 | 余额不足；本次无法判断该通道是否可用 |
| Claude Fable 5 | `[霓裳曲]claude-fable-5` | 是 | 余额阻断 | 1.16 | 余额不足；本次无法判断该通道是否可用 |
| Claude Fable 5.1 | `[霓裳曲]claude-fable-5.1` | 是 | 余额阻断 | 0.37 | 余额不足；本次无法判断该通道是否可用 |
| Claude 4.6 Opus Thinking | `[奇异果]claude-4.6-opus-thinking㉗` | 是 | 通过 | 9.7 | 返回 OK，流式响应完整结束 |
| Claude 5 Opus | `[奇异果]claude-5-opus㉗` | 是 | 通过 | 3.95 | 返回 OK，流式响应完整结束 |
| Gemini 3.1 Pro Preview | `[游子意]gemini-3.1-pro-preview` | 是 | 超时 | 60.02 | 60秒超时 |
| Gemini 3.5 Flash | `[游子意]gemini-3.5-flash` | 是 | 超时 | 60 | 60秒超时 |
| Gemini 4 Argon | `[郁金香]gemini-4-argon⑲` | 是 | 余额阻断 | 0.37 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3 Pro Preview Search | `[鸢尾花]gemini-3-pro-preview-search②` | 是 | 余额阻断 | 1.06 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3 Pro Preview | `[鸢尾花]gemini-3-pro-preview②` | 是 | 余额阻断 | 0.65 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3.1 Pro Preview Search | `[鸢尾花]gemini-3.1-pro-preview-search②` | 是 | 余额阻断 | 1.07 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3.1 Pro Preview | `[鸢尾花]gemini-3.1-pro-preview②` | 是 | 余额阻断 | 0.38 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3.6 Flash | `[鸢尾花]gemini-3.6-flash①` | 是 | 余额阻断 | 0.39 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3.7 Flash | `[鸢尾花]gemini-3.7-flash①` | 是 | 余额阻断 | 0.37 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 3.8 Flash | `[鸢尾花]gemini-3.8-flash①` | 是 | 余额阻断 | 0.36 | 余额不足；本次无法判断该通道是否可用 |
| Gemini 4 Argon | `[鸢尾花]gemini-4-argon③` | 是 | 余额阻断 | 0.39 | 余额不足；本次无法判断该通道是否可用 |

## FREE_API_KEY_2

目录 HTTP 状态：200；目录 0 条。

本次没有实测成功模型。

| 模型名称 | 完整上游 ID | 在该密钥目录中 | 结果 | 耗时（秒） | 说明 |
|---|---|---|---|---:|---|
| GLM-5.1 | `[采桑子]glm-5.1①` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| GLM-5.2 | `[采桑子]glm-5.2②` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| GLM-5.3 | `[采桑子]glm-5.3②` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| DeepSeek V4 Flash | `[蝶恋花]deepseek-v4-flash①` | 否 | 失败 | 0.6 | 上游返回无可用模型通道 |
| DeepSeek V4 Pro | `[蝶恋花]deepseek-v4-pro①` | 否 | 失败 | 1.8 | 上游返回无可用模型通道 |
| DeepSeek V4.1 Flash | `[蝶恋花]deepseek-v4.1-flash①` | 否 | 失败 | 0.7 | 上游返回无可用模型通道 |
| Gemini 2.5 Pro | `[故人情]gemini-2.5-pro` | 否 | 失败 | 0.73 | 上游返回无可用模型通道 |
| Gemini 3.1 Pro Preview | `[故人情]gemini-3.1-pro-preview` | 否 | 失败 | 0.74 | 上游返回无可用模型通道 |
| Gemini 3.8 Flash | `[故人情]gemini-3.8-flash` | 否 | 失败 | 0.53 | 上游返回无可用模型通道 |
| GPT-5.4 | `[浣溪沙]gpt-5.4①` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| GPT-5.5 | `[浣溪沙]gpt-5.5①` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| GPT-5.6 Sol | `[浣溪沙]gpt-5.6-sol③` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| GPT-5.6 Terra | `[浣溪沙]gpt-5.6-terra②` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| Claude Fable 5 | `[霓裳曲]claude-fable-5` | 否 | 失败 | 0.2 | 上游返回无可用模型通道 |
| Claude 5 Opus | `[奇异果]claude-5-opus㉗` | 否 | 失败 | 0.8 | 上游返回无可用模型通道 |

## FREE_API_KEY_3

目录 HTTP 状态：200；目录 20 条。

实测成功模型（去除通道前缀后）：Gemini 3 Pro Preview、Gemini 3 Pro Preview Search、Gemini 3.1 Pro Preview、Gemini 3.5 Flash、Gemini 3.6 Flash、Gemini 3.7 Flash、Gemini 3.8 Flash、Gemini 4 Argon。

| 模型名称 | 完整上游 ID | 在该密钥目录中 | 结果 | 耗时（秒） | 说明 |
|---|---|---|---|---:|---|
| Gemini 4 Argon | `[芙蓉浦]gemini-4-argon` | 是 | 通过 | 9.34 | 返回 OK，流式响应完整结束 |
| Gemini 2.5 Pro | `[故人情]gemini-2.5-pro` | 否 | 失败 | 0.32 | 上游返回无可用模型通道 |
| Gemini 3 Pro Preview | `[故人情]gemini-3-pro-preview` | 是 | 超时 | 60.01 | 60秒超时 |
| Gemini 3.1 Pro Preview | `[故人情]gemini-3.1-pro-preview` | 是 | 超时 | 60.02 | 60秒超时 |
| Gemini 3.5 Flash | `[故人情]gemini-3.5-flash` | 是 | 通过 | 3.72 | 返回 OK，流式响应完整结束 |
| Gemini 3.6 Flash | `[故人情]gemini-3.6-flash` | 是 | 超时 | 60.01 | 60秒超时 |
| Gemini 3.7 Flash | `[故人情]gemini-3.7-flash` | 是 | 通过 | 8.39 | 返回 OK，流式响应完整结束 |
| Gemini 3.8 Flash | `[故人情]gemini-3.8-flash` | 是 | 通过 | 6.2 | 返回 OK，流式响应完整结束 |
| Gemini 4 Argon | `[故人情]gemini-4-argon` | 是 | 通过 | 8.47 | 返回 OK，流式响应完整结束 |
| Gemini 3.1 Pro Preview | `[龙舌兰]gemini-3.1-pro-preview①` | 是 | 通过 | 4.78 | 返回 OK，流式响应完整结束 |
| Gemini 3.1 Pro Preview | `[游子意]gemini-3.1-pro-preview` | 是 | 超时 | 60.01 | 60秒超时 |
| Gemini 3.5 Flash | `[游子意]gemini-3.5-flash` | 是 | 超时 | 60.02 | 60秒超时 |
| Gemini 4 Argon | `[郁金香]gemini-4-argon⑲` | 是 | 通过 | 53.09 | 返回 OK，流式响应完整结束 |
| Gemini 3 Pro Preview Search | `[鸢尾花]gemini-3-pro-preview-search②` | 是 | 通过 | 6.15 | 返回 OK，流式响应完整结束 |
| Gemini 3 Pro Preview | `[鸢尾花]gemini-3-pro-preview②` | 是 | 通过 | 7.2 | 返回 OK，流式响应完整结束 |
| Gemini 3.1 Pro Preview Search | `[鸢尾花]gemini-3.1-pro-preview-search②` | 是 | 超时 | 60.01 | 60秒超时 |
| Gemini 3.1 Pro Preview | `[鸢尾花]gemini-3.1-pro-preview②` | 是 | 通过 | 7.75 | 返回 OK，流式响应完整结束 |
| Gemini 3.6 Flash | `[鸢尾花]gemini-3.6-flash①` | 是 | 通过 | 4.38 | 返回 OK，流式响应完整结束 |
| Gemini 3.7 Flash | `[鸢尾花]gemini-3.7-flash①` | 是 | 通过 | 7.75 | 返回 OK，流式响应完整结束 |
| Gemini 3.8 Flash | `[鸢尾花]gemini-3.8-flash①` | 是 | 通过 | 25.54 | 返回 OK，流式响应完整结束 |
| Gemini 4 Argon | `[鸢尾花]gemini-4-argon③` | 是 | 通过 | 7.82 | 返回 OK，流式响应完整结束 |

## 项目配置观察

model-registry.js 当前仅为 FREE_API_KEY 预置 content.js 中的三个 Gemini 模型；自动模型目录发现仅遍历第二、第三、第四密钥。主密钥实际返回的 64 条目录没有自动加入项目选择列表，因此页面模型列表不能代表该主密钥全部可访问的模型。

本次仅测试并生成本报告，没有修改应用代码、密钥配置或重启服务。
