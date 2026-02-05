# 新年祝福图片生成器 - 完整技能体系

## 已创建的技能文档

### 1. 智能美颜技能 (Face Beautification)
**位置**: 
- Skill文档: `~/.claude/skills/face-beautification/SKILL.md`
- 代码实现: `src/lib/Beautifier.ts`

**能力**:
- 6个年龄段精准识别 (儿童/青少年/青年/成年/中年/老年)
- 性别差异化美颜策略
- 6种肤色优化方案
- 6种脸型针对性调整
- 7类皮肤问题处理
- 特殊特征保留（眼镜、胡须、痣等）

### 2. 图片审核技能 (Image Auditor)
**位置**: `~/.claude/skills/image-auditor/SKILL.md`
**代码**: `src/lib/ImageAuditor.ts`

### 3. 特征分析技能 (Image Analyzer)
**位置**: `~/.claude/skills/image-analyzer/SKILL.md`
**代码**: `src/lib/ImageAnalyzer.ts`

### 4. 图片质量审核技能 (Image Reviewer)
**位置**: `~/.claude/skills/image-reviewer/SKILL.md`
**代码**: `src/lib/ImageReviewer.ts`

### 5. 祝福语文案技能 (Blessing Styles)
**位置**: `~/.claude/skills/blessing-styles/SKILL.md`
**代码**: `src/constants/blessingStyles.ts`

---

## 美颜策略矩阵

### 年龄段策略

| 年龄段 | 年龄范围 | 美颜强度 | 重点效果 | 保留原则 |
|--------|----------|----------|----------|----------|
| 儿童 | 0-12 | 轻微(0.3) | 柔光、红润、天真 | 保持童真 |
| 青少年 | 13-19 | 轻度(0.4) | 祛痘、提亮、活力 | 保持青春特征 |
| 青年 | 20-35 | 中度(0.7) | 大眼、瘦脸、去细纹 | 自然美颜 |
| 成年 | 36-59 | 强度(0.8) | 去皱纹、紧致、减龄 | 保持可识别性 |
| 老年 | 60+ | 温和(0.5) | 除皱、健康气色、尊严 | 尊重年龄 |

### 性别差异化

**女性**:
- 大眼睛 + 自然眼妆效果
- V脸/瓜子脸轮廓
- 细腻肤质 + 自然妆容
- 柔和女性化特征

**男性**:
- 明亮眼神（不过度放大）
- 轮廓分明的下颌线
- 健康肤色（无妆感）
- 保持阳刚气质

### 肤色优化

| 肤色类型 | 优化方向 |
|----------|----------|
| 白皙 | 增加血色，避免苍白 |
| 偏白 | 均匀肤色，自然红润 |
| 自然 | 提亮光泽，增强健康感 |
| 橄榄 | 去黄提亮，均匀色调 |
| 偏黄 | 美白提亮，去除暗沉 |
| 深色 | 增强光泽，保持自然 |

### 脸型调整

| 脸型 | 调整策略 |
|------|----------|
| 圆脸 | 微V脸，拉长线条 |
| 方脸 | 柔和轮廓，减少棱角 |
| 长脸 | 缩短中庭，增加宽度 |
| 心形脸 | 平衡额头下巴比例 |
| 菱形脸 | 平衡颧骨与下颌 |
| 鹅蛋脸 | 保持完美比例 |

---

## 使用方式

```typescript
// 完整美颜分析
import { beautify } from './Beautifier';

const analysis = "女性，大约35岁，圆脸，戴眼镜，长发，微笑";
const { context, prompt } = beautify(analysis);

console.log(context);
// {
//   ageGroup: 'adult',
//   age: 35,
//   gender: 'female',
//   skinTone: 'unknown',
//   facialFeatures: {
//     faceShape: 'round',
//     eyeSize: 'unknown',
//     skinIssues: [],
//     specialFeatures: ['glasses']
//   }
// }

console.log(prompt);
// 完整的英文美颜Prompt...
```

---

## 质量保证原则

1. **可识别性**: 亲友能认出是本人
2. **自然度**: 避免塑料感，保持真实
3. **适度性**: 根据年龄调整强度
4. **个性化**: 保留独特特征（痣、酒窝等）
5. **专业性**: 专业修图级别效果

---

## 文件变更汇总

### 新增文件
- `~/.claude/skills/face-beautification/SKILL.md` - 美颜技能文档
- `~/.claude/skills/image-auditor/SKILL.md` - 审核技能文档
- `~/.claude/skills/image-analyzer/SKILL.md` - 分析技能文档
- `~/.claude/skills/image-reviewer/SKILL.md` - 质量审核技能文档
- `~/.claude/skills/blessing-styles/SKILL.md` - 祝福语技能文档

### 修改文件
- `src/lib/Beautifier.ts` - 完整重构，添加多维度美颜策略
- `src/lib/PromptGenerator.ts` - 集成增强的美颜分析

---

## 效果预览

输入: "35岁女性，圆脸，戴眼镜，有些皱纹"

输出美颜Prompt将包含：
- 年龄策略：成年女性标准美颜（大眼、瘦脸、去皱纹）
- 性别调整：柔和女性化特征
- 脸型优化：圆脸→微V脸
- 特殊保留：保持眼镜风格，优化眼部
- 皮肤处理：减少皱纹，均匀肤色
- 质量保证：强调可识别性

生成的图片将：
✓ 看起来更年轻（减5-10岁视觉效果）
✓ 皱纹明显减少但不过度
✓ 脸型更精致但仍自然
✓ 气色更好，肤色均匀
✓ 亲友仍能认出是本人
