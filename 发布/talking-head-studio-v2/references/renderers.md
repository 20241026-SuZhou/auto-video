# 工具与渲染路线

本包是可复用 skill，不是已剪好的视频。`.video-toolchain` 是当前电脑的本地运行环境；传给另一台电脑时使用 preflight 重新检测/安装，不需要打包 node_modules。

## 前置检测

```powershell
node .\talking-head-studio-v2\scripts\preflight.mjs --toolchain .\.video-toolchain --report .\environment.json
node .\talking-head-studio-v2\scripts\preflight.mjs --toolchain .\.video-toolchain --install --report .\environment.json
```

脚本检测 Node >=22、npm、FFmpeg/FFprobe、两套 npm 包与 CLI、浏览器和 HyperFrames doctor。报告区分包已安装、CLI 能运行、浏览器可用、doctor 结果；不能用 npm 安装成功代替渲染检查。Windows npm 命令使用 npm.cmd 避免执行策略问题。Remotion 浏览器安装完成后，可在本轮进程内通过 HYPERFRAMES_BROWSER_PATH 共用该 Chromium，减少重复下载；已有用户指定的变量优先。实际 HyperFrames 项目也应设置报告中的浏览器路径或自己的已验证路径。

工具链使用一个独立 package.json 与 lockfile。新建时固定到本包制作时版本：Remotion 4.0.535、HyperFrames 0.8.151、React 19.2.0；这些是复现基线，不表示永远最新。新项目可显式检测并选择兼容的新版本，所有 @remotion 包和 remotion 必须同版本。已有锁文件优先使用 npm ci，安装失败不能覆盖已有工程或反复无界重试。

`--install` 可安装缺失 npm 依赖和下载两套渲染器需要的浏览器。系统级 Node/FFmpeg 不由脚本静默替换；需要时使用当前系统可用包管理器并验证。HyperFrames doctor 通常还报告 Docker 状态；本地路线未使用 Docker 时记录相关警告，不谎称云/Docker 路线可用。

环境中已有 HYPERFRAMES_BROWSER_PATH 但它指向失效/版本探测超时的系统 Chrome 时，可给脚本 `--browser <已验证可执行文件>` 显式覆盖本轮变量，不修改全局设置。Windows 本包已安装的官方浏览器相对工具链路径是 `node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe`。doctor 的 Memory/Disk 等资源失败仍记录为警告，实际项目应减少并发并执行 check/短段渲染，不把依赖就绪当作大项目一定成功。

## Remotion（默认）

项目工程带 package.json、锁文件、React composition 和本地素材；复制素材到 public 或使用可移植的资源约定。用 Composition 为每个画幅注册单独 id 和 dimensions/fps，按各自布局配置重排。

动画从 useCurrentFrame / fps 计算，任意 seek 确定同一状态，不用墙上时钟、无种子随机数或不可重放副作用。媒体、字幕和语义点使用同一最终时间轴。音视频预处理与最终测量可用 FFmpeg；具体 API 以安装版本文档为准。

先运行 composition 列表验证编译和元数据，再检查关键帧与短段渲染，最终按已确认交付范围渲染。不需要为了每次渲染重新请求确认；若用户明确需要预览审批则等其接受后导出。

工具链可通过 `.video-toolchain/node_modules/.bin/remotion.cmd` 使用；新视频项目应安装自己的锁定依赖，避免偷偷依赖不可移植的绝对 node_modules 路径。

## HyperFrames（可选）

实际创作前读取环境中的 hyperframes 入口、hyperframes-core、hyperframes-cli 与对应命令参考。已确认参数写入 BRIEF.md，沿用现有授权，不重复访谈。纯字幕、设计叠加、重剪分别遵循其匹配的工作流；缺失的工作流按入口安装，不能从记忆重建。

HTML composition 遵循 data-* timing、框架托管媒体、可 seek 的确定时间轴。按 core/CLI 规范 check 并检查关键帧与子场景。本次用户已要求完成交付时按该授权完成；仅预览任务或 `preview_approval: true` 时在预览等待确认。

检测命令：`hyperframes browser path`、必要时 `browser ensure`、`doctor --json`。doctor 的退出码通常恒为零，必须解析 `ok` 并保留全量结果；本地渲染按 Node.js/FFmpeg/FFprobe/Chrome 分项判断，可选模块缺失必须照实记录，需要相关模块的任务另行安装。生成工程之前的环境检测不需要空造一个视频。实际工程的 check/render 检查与环境报告分开记录。

## 失败与路线切换

发现缺依赖先安装/修复；失败报告具体原因并保留可编辑工程。切换渲染器会影响编辑工程，先说明方案并按既有授权执行，不把浏览器不可用伪装成已完成渲染。云、发布和外部上传不因本地安装授权自动获得许可。
