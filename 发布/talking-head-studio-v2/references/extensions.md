# 扩展接口

共享边界是 `project.json`（意图）、`timeline.json`（最终时序）、本地资产（来源）与 `qa.md`（证据）。渲染器不决定用户目标，封面比例不继承视频比例。

## 配置与时间轴

schema_version 的主版本变化表示不兼容迁移；迁移先备份配置再转换，不改历史项目素材。新字段优先给可解释默认值，保留 extensions 中未知命名空间。

每路 video.outputs 包含 id、width、height、fps、fit 与 safe_area（top/right/bottom/left 像素），可加单路布局覆盖。每路 cover.outputs 独立定义。输出 id 用作 composition 与文件名键，不能互相覆盖。

timeline.json 建议包含 clips（source、source_in/out、timeline_in/out）、captions（start/end、text）、semantic_beats（start/end、meaning、kind、asset_refs）和 chapters。时间以最终秒为跨渲染器格式，入具体渲染器时依单路 fps 量化，保持原始秒值可回溯。源文件时间戳与最终时间不可混用。

## 添加能力

| 扩展 | 放置位置与约束 |
| --- | --- |
| 新平台/比例 | 在项目 outputs 增加配置与布局，按该平台实际 UI 定安全区；既有模板不全局改比例 |
| 新渲染器 | 新 references/renderer-*.md，明确依赖检测、时间轴映射、字幕/音频/素材约定、验证和可编辑工程；入口按需加载 |
| 新封面风格 | 新 references/cover-*.md 或用户风格参考，保留身份和真实内容约束；不写死姿态 |
| 新生图接口 | cover.generation 覆盖 base_url/model/quality/key_env，敏感值仍在环境；兼容性实测后记录 |
| 新模块 | 明确输入、输出、依赖模块与检查方法，只运行本次所需模块；在 extensions.<namespace> 保存参数 |

部分修改按依赖失效：改剪点会影响字幕、动效和音频时序；改字幕字体影响各画幅布局；换身份图仅使封面人物与相关合成失效；仅改文案不应触发重新剪辑。默认串行实施，不要求多代理或额外服务。
