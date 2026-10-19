// Public operation metadata only: never accept prompts, tool arguments or model reasoning.
export function createActivity(emit = () => {}) {
  const steps = [];
  let sequence = 0, request;
  const update = (step, status, detail) => {
    if (!step) return;
    Object.assign(step, { status, detail, updatedAt: new Date().toISOString() });
    emit({ ...step });
  };
  const start = (label, kind = "model") => {
    const step = { id: String(++sequence), kind, label, status: "running", startedAt: new Date().toISOString() };
    // Four model rounds and at most three tools per round fit comfortably here.
    if (steps.length < 32) steps.push(step);
    emit({ ...step }); return step;
  };
  return {
    steps, start, update,
    model(event) {
      if (event === "request") request = start("请求模型");
      else if (event === "connected") update(request, "running", "连接已建立，等待模型返回内容");
      else if (event === "output") update(request, "running", "正在流式输出回复");
      else if (event === "tools") update(request, "done", "模型已返回工具调用，开始执行");
      else if (event === "response") update(request, "done", "本轮模型响应完成");
      else if (event === "request_error") update(request, "error", "本次模型请求未完成");
      else if (event === "retry") { const step = start("等待重试"); update(step, "warning", "模型服务限流，将自动重试"); }
      else if (event === "unsupported") { const step = start("工具兼容性检查"); update(step, "warning", "当前通道不支持原生工具，继续普通对话"); }
    },
    finish(status = "done") {
      for (const step of steps) if (step.status === "running") update(step, status, status === "cancelled" ? "用户已停止本次生成" : status === "error" ? "本次处理未完成，请重试" : "处理完成");
      return steps.map(step => ({ ...step }));
    }
  };
}
