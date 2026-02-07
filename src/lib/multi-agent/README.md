# Multi-Expert Image Generation System

## Overview

A sophisticated multi-agent workflow system that orchestrates 7 expert professionals to collaboratively generate, review, and perfect Chinese New Year blessing photos.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT ORCHESTRATION SYSTEM                    │
└─────────────────────────────────────────────────────────────────────────┘

                            ┌────────────────────┐
                            │   User Input       │
                            │  (Original Image)  │
                            └─────────┬──────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: IMAGE ANALYSIS                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Expert: ImageAnalyzer                                                 │
│  Output: Character analysis (age, gender, ethnicity, features)         │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: INDIVIDUAL EXPERT ANALYSIS (Parallel)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │ Portrait Photographer   │  │ Story Director                        │ │
│  │ • Lighting quality      │  │ • Narrative coherence                  │ │
│  │ • Realism check         │  │ • Emotional resonance                  │ │
│  │ • Camera settings       │  │ • Mood & atmosphere                    │ │
│  └─────────────────────────┘  └───────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │ Senior Makeup Artist   │  │ Senior Costume Designer                │ │
│  │ • Skin perfection      │  │ • Traditional attire                  │ │
│  │ • Eye enhancement      │  │ • Color coordination                  │ │
│  │ • Contouring          │  │ • Cultural authenticity                │ │
│  └─────────────────────────┘  └───────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │ Senior Retoucher       │  │ Beauty Expert                         │ │
│  │ • Quality control     │  │ • Face slimming (V-line)              │ │
│  │ • Detail enhancement  │  │ • Wrinkle removal                     │ │
│  │ • Artifact detection  │  │ • Youth enhancement                   │ │
│  └─────────────────────────┘  └───────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: GROUP DISCUSSION & CONSENSUS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Discussion Topics                             │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  • Lighting requirements (multi-light setup)                    │   │
│  │  • Makeup/beautification approach (natural vs enhanced)         │   │
│  │  • Costume recommendations (traditional vs modern)             │   │
│  │  • Pose and expression guidance                                  │   │
│  │  • Background elements (festive decorations)                     │   │
│  │  • Technical specifications (iPhone realism)                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Output: Agreed Requirements with Expert Consensus                      │
│                                                                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: UNIFIED PROMPT GENERATION                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   Prompt Master                                 │   │
│  │                                                                  │   │
│  │  Inputs:                                                        │   │
│  │  • Original character analysis                                   │   │
│  │  • Expert individual analyses                                    │   │
│  │  • Group consensus requirements                                 │   │
│  │                                                                  │   │
│  │  Output:                                                        │   │
│  │  • Unified high-quality prompt incorporating ALL expert inputs  │   │
│  │  • Optimized for iPhone 16 Pro Max realism                     │   │
│  │  • Chinese New Year theme integration                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: IMAGE GENERATION                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Model: Gemini Image Generation                                         │
│  Input: Unified expert prompt                                           │
│  Output: Generated blessing photo                                        │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 6: FINAL QUALITY REVIEW                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   Chief Editor (Final Reviewer)                  │   │
│  │                                                                  │   │
│  │  Quality Dimensions (1-10 scale):                               │   │
│  │  ├─ Realism:             iPhone photo authenticity              │   │
│  │  ├─ Skin Quality:        Smoothness, pore-free                  │   │
│  │  ├─ Face Slimming:      V-line effect                          │   │
│  │  ├─ Wrinkle Removal:    Complete wrinkle erasure               │   │
│  │  ├─ Eye Enhancement:     Size, brightness                       │   │
│  │  ├─ Brightness:         Even illumination                       │   │
│  │  ├─ Identity Preservation: Recognizable as same person        │   │
│  │  ├─ Composition:         Scene arrangement                     │   │
│  │  ├─ Lighting:           Professional studio setup              │   │
│  │  └─ OVERALL:            Weighted composite score                │   │
│  │                                                                  │   │
│  │  Decision: APPROVED / REJECTED / NEEDS_REVISION                │   │
│  │  Passing Threshold: 8.0/10                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              ✅ PASSED                       ❌ FAILED
                    │                             │
                    ▼                             ▼
┌───────────────────────────┐      ┌───────────────────────────────────┐
│  PHASE 7: OUTPUT         │      │  PHASE 7: PROMPT OPTIMIZATION    │
│  • Final image           │      │  • Analyze review issues          │
│  • Final prompt          │      │  • Generate improvement tips      │
│  • Quality report        │      │  • Regenerate prompt             │
│  • Audit trail           │      │  └── Back to Phase 5             │
│                           │      │      (Max 3 iterations)          │
└───────────────────────────┘      └───────────────────────────────────┘
```

## Expert Profiles

| Expert | Role | Key Contributions |
|--------|------|-------------------|
| **Alex Chen** | Portrait Photography Director | Lighting mastery, iPhone realism, depth of field |
| **Ming Zhang** | Story Director | Narrative, mood, cultural authenticity |
| **Li Wei** | Senior Makeup Artist | Skin perfection, eye enhancement |
| **Fiona Wang** | Senior Costume Designer | Traditional attire, red/gold theme |
| **David Liu** | Senior Retoucher | Quality control, detail perfection |
| **Dr. Sarah Kim** | Beauty Expert | Face slimming, wrinkle removal, youth enhancement |
| **Chief Editor** | Final Reviewer | Final approval, brand standards |

## Key Features

1. **Parallel Expert Analysis**: All experts analyze simultaneously
2. **Consensus Building**: Structured discussion to align requirements
3. **Iterative Improvement**: Up to 3 generations with feedback optimization
4. **Comprehensive Audit Trail**: Full history of decisions and reasoning
5. **Quality Thresholds**: 8.0/10 passing score ensures high standards
6. **Multi-dimensional Scoring**: 10 quality dimensions evaluated

## Usage

```typescript
import { MultiAgentWorkflow } from './multi-agent';

const workflow = new MultiAgentWorkflow(client, imageAnalyzer, {
  maxIterations: 3,
  passingScore: 8.0
});

const result = await workflow.process(imageBase64, async (prompt) => {
  return await generateImage(prompt);
});

console.log(workflow.generateReport(result));
```

## Output

- Final generated image URL
- Optimized prompt used
- Quality scores (1-10) for all dimensions
- Expert opinions and recommendations
- Full audit trail
- Final decision with reasoning
