---
name: talker-mcp
description: 通过 Talker MCP 驾驭本地文档视频工作台，读取能力、校验分镜、导入有许可的图片、提交与精调视频；面向 Claude Code、Codex 等外部 agent，不用于改造应用代码。
---

# 用 MCP 制作视频

工作台把结构化分镜交给本地配音和渲染。外部 agent 负责读原文、编稿和修订；不需要修改 React、运行自写脚本或向 App 提交代码。

## 连接

在已安装依赖的项目中使用 Node 运行。下面两条任选其一；路径按实际安装位置调整，路径中的空格保留引号：

```sh
claude mcp add --transport stdio talker -- node "/absolute/path/to/talkframe/scripts/mcp-server.mjs"
codex mcp add talker -- node "/absolute/path/to/talkframe/scripts/mcp-server.mjs"
```

命令语法已按本机 `claude mcp add --help`、`codex mcp add --help` 核对；执行配置由使用者决定，不改变宿主模型。命令行调试入口为 `npm run mcp`。stdio 的 stdout 只承载 MCP 消息，制作日志走 stderr。

默认工作区为安装目录。独立工作区通过 `DVS_WORKSPACE` 指定，同时为它选择独立的 `DVS_DATA` 数据目录。所有输入文件必须位于工作区；`..`、越界绝对路径、越界符号链接均拒绝。先把文档或图片复制进工作区，再传路径；不要尝试绕过边界。

任务在服务进程内排队，产物和 requestId 映射保存在磁盘。保持连接直到 done；宿主终止 stdio 子进程可能中断制作，不能声称断开后仍会完成。done 后重连可用 `get_job` 查询。排队任务取消后为 cancelled；运行中的取消仅写 cancelRequested，仍可能完成，不会杀进程。

## 一次完整制作的对话样例

以下是调用顺序示例，`原文全文` 和 `分镜对象` 指宿主手中的真实内容，不要把占位文字原样发送。

1. 用户：“把工作区里的《一分钟认识区块链钱包》做成横屏讲解，先核对引用。”
2. Agent：调用 `get_capabilities({profile:"motion",detail:"full"})` 一次，阅读 authoringGuide、当前 profile 的模板摘要、能力、schema 和预算。之后只在需要时 `get_capability({id:"motion.diagram"})` 深读节点规则。
3. Agent：从用户指定文档取得原文全文。选择适合的能力编写分镜；无依据的数字不写入。需要图片时先调用 `import_asset({filePath:"素材/钱包.png",sourceUrl:"",credit:"用户自制",license:"用户确认可用于本片"})`，只有来源确实如此才使用这段说明，再将返回的 assetId 绑定到能力声明的 slot。
4. Agent：调用 `validate_storyboard({storyboard:分镜对象,sourceText:原文全文,settings:{targetSeconds:60}})`。一次处理所有 errors；引文候选 closestMatch 仍需核对原文，不能自动当事实依据。warnings 不阻止生成，但预算超限时应缩短旁白或向用户明确预期时长。
5. Agent：确认用户要求已体现在分镜后，调用 `create_project_from_storyboard({requestId:"wallet-explainer-v1",storyboard:分镜对象,sourceText:原文全文,settings:{width:1280,height:720,targetSeconds:60,musicFile:"",brandOutro:"off"}})`，记录返回的 jobId。如果重试同一次提交，继续使用同一 requestId；同 ID 返回旧任务，修改内容要用 update 或新的 ID。
6. Agent：按约两秒间隔 `get_job({jobId})`；done 后取 `artifacts["preview.mp4"]` 和 `artifacts["evidence.md"]`，核对 report、来源与抽帧，播放检查声音。退出码与引用命中不代替语义/听感验收。
7. 用户：“把第三幕标题缩短，语速稍快。”Agent：读取已存分镜，修改指定文案，`update_storyboard({jobId,storyboard:修改后的分镜,settings:{speechRate:260}})`，再 `render_project({jobId})`；复用分镜，不重新请求 App 的 AI 编稿。

只需改设置时可省略 update_storyboard 的 storyboard。想让 App 的 Provider 自己编稿时使用 `create_project_from_document({requestId,filePath,settings})` 或 `{requestId,text,settings}`，二者互斥；这条路径可能联网。`list_jobs({})` 查看任务列表，`cancel_job({jobId})` 按上面的有限取消语义执行。

## 契约与成本

- summary 不含完整 schema，resource 为 `talker://schema/storyboard/<profile>`；另有 `talker://guide`、`talker://catalog`、`talker://schema/settings`，以及 `author-storyboard` prompt。
- 支持 v1 和内置能力 v2。v2 场景用 role/capability/assets/sentences；完整字段按 resource，sentences 拼回完整 narration。capability 的版本可为 null，使用已安装版本；outro=null 表示关闭片尾。
- 目录里 cut/crossfade/handoff/wipe 都是 planned，尚不能作为生产参数。声明式能力包当前仅加载元数据；不可执行 agent 提供的代码。
- 软规则：总旁白按预算，主标题≤22字、幕标题≤18字、kicker≤20字、要点每条尽量≤20字。硬限制以 schema/limits 为准；严格成片时长使用 maxDurationSeconds，实际配音超过时会拒绝导出。
- 尽量传完整 sourceText。省略时只保存提交方的引用摘录，job.sourceVerification 为 provided-quotes-only，不代表完整原文已核实；给全文时为 provided-source-text。
- 本地文档抽取、素材复制、本地 TTS 和渲染不消耗 Codex token。外部 agent 编稿、修订、AI 图片等用量另计。复用 S6 等既有分镜时不能把历史编稿 token 算作本次新消耗；App 开发用量不计入视频制作。实际生产报告中的 timings 用于分阶段耗时，不虚构缺失日志。

## 错误码对照

工具调用拒绝返回 `isError:true` 和 `{ok:false,errors,warnings}`；validate_storyboard 的校验失败为正常结果 `ok:false`，仍需修正。每个错误含 sceneId/path/code/message/hint。

| code | 处理 |
| --- | --- |
| INVALID_ARGUMENT | 按工具输入 schema 补齐或修正字段 |
| PATH_OUTSIDE_WORKSPACE / FILE_NOT_FOUND | 选择工作区内真实文件，检查符号链接 |
| LICENSE_REQUIRED | 提供真实许可说明，未知许可不能杜撰 |
| INVALID_JOB_ID / JOB_BUSY | 核对任务编号，等待当前制作结束 |
| DOCUMENT_INPUT_REQUIRED | 只提供 filePath 或 text 之一 |
| CAPABILITY_NOT_FOUND / CAPABILITY_VERSION_NOT_FOUND | 读取目录并使用已安装能力和版本 |
| PROFILE_MISMATCH / PROFILE_FIELDS_INVALID / CAPABILITY_NOT_ALLOWED | 统一 profile、设置与允许的场景字段 |
| CAPABILITY_RENDER_MISMATCH | 当前编译器中 classic.flow 用 role=flow、chart.metrics 用 role=chart、classic.card 用其他角色 |
| SCHEMA_INVALID / SCENE_COUNT | 按 schema 修正结构与幕数 |
| HUB_NEEDS_3_NODES / SPLIT_MAX_3_NODES | hub 使用3～5节点，split使用2～3节点 |
| QUOTE_NOT_FOUND | 从原文复制连续文字，参考 closestMatch/similarity 后人工核对 |
| DUPLICATE_SCENE_ID / DUPLICATE_NODE_ID / EDGE_NODE_NOT_FOUND / SELF_EDGE | 修正唯一编号和本幕连线 |
| TITLE_LENGTH / BULLET_LENGTH / NARRATION_LENGTH / METRIC_INVALID | 修正硬长度限制或数值 |
| SENTENCE_TEXT_MISMATCH | 保留完整旁白，不漏掉句子文本 |
| ASSET_REQUIRED / ASSET_SLOT_NOT_ALLOWED | 先导入许可明确的图片，使用目录中的 slot |
| OUTRO_VERSION_UNAVAILABLE | 选择当前已安装的片尾版本 |
| OPERATION_FAILED | 阅读 message，核对本地依赖、文件与任务状态后重试 |
| NARRATION_BUDGET_EXCEEDED | 非阻断警告；精简旁白或调整预期时长 |
| BOARD_TITLE_SOFT_LIMIT / TITLE_SOFT_LIMIT / KICKER_SOFT_LIMIT / BULLET_SOFT_LIMIT | 非阻断警告；缩短屏显文字 |
