import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { OSSService } from '../lib/services/oss'
import { AIService } from '../lib/services/ai'
import { Buffer } from 'node:buffer'

export type Bindings = {
    GEMINI_API_KEY: string
    OSS_ACCESS_KEY_ID: string
    OSS_ACCESS_KEY_SECRET: string
    OSS_BUCKET: string
    OSS_REGION: string
    OSS_ENDPOINT: string
    OSS_PREFIX?: string
    INVITE_CODE?: string
}

// In-memory task storage
interface Task {
    id: string
    session_id: string
    status: string
    original_image_path: string
    generated_image_path?: string
    analysis_result?: string
    created_at: number
}

const tasks = new Map<string, Task>()

// Clean up old tasks (older than 1 hour)
function cleanupOldTasks() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    for (const [id, task] of tasks) {
        if (task.created_at < oneHourAgo) {
            tasks.delete(id)
        }
    }
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.use('/*', cors())

app.get('/', (c) => {
    return c.text('Blessings API is running!')
})

app.post('/upload', async (c) => {
    try {
        cleanupOldTasks()

        const body = await c.req.parseBody()
        const image = body['image']
        const inviteCode = body['invite_code'] as string | undefined

        if (c.env.INVITE_CODE) {
            if (!inviteCode || inviteCode !== c.env.INVITE_CODE) {
                return c.json({ error: 'Invalid or missing invite code' }, 403)
            }
        }

        if (!(image instanceof File)) {
            return c.json({ error: 'Image file is required' }, 400)
        }

        const sessionId = crypto.randomUUID()
        const taskId = crypto.randomUUID()

        const oss = new OSSService(c.env)
        const imageBuffer = await image.arrayBuffer()

        const now = new Date()
        const timeStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
        const sessionDir = `${timeStr}_${sessionId}`

        const prefix = c.env.OSS_PREFIX ? c.env.OSS_PREFIX.replace(/\/+$/, '') + '/' : ''
        const imagePath = `${prefix}sessions/${sessionDir}/original.jpg`

        // Create task in memory
        const task: Task = {
            id: taskId,
            session_id: sessionId,
            status: 'PENDING',
            original_image_path: imagePath,
            created_at: Date.now()
        }
        tasks.set(taskId, task)

        c.executionCtx.waitUntil((async () => {
            try {
                await oss.putObject(imagePath, imageBuffer, image.type)
                task.status = 'ANALYZING'

                const ai = new AIService(c.env)
                const analysisResult = await ai.analyzeImage(imageBuffer, image.type)

                let analysisJson: any = {}
                try {
                    const jsonStr = analysisResult.replace(/```json/g, '').replace(/```/g, '').trim()
                    analysisJson = JSON.parse(jsonStr)
                } catch (e) {
                    console.error("Failed to parse analysis result", e)
                }

                task.analysis_result = JSON.stringify(analysisJson)

                if (analysisJson.is_feasible === false) {
                    const failureReason = analysisJson.description || analysisJson.issues?.join(', ') || 'Image analysis failed'
                    task.status = 'FAILED'
                    task.analysis_result = JSON.stringify({ error: failureReason })
                    return
                }

                task.status = 'GENERATING'

                const faceDesc = analysisJson.face_description || 'A person with natural features'
                const hairDesc = analysisJson.hair_description || 'natural hair'
                const prompt = `
Create a Chinese New Year Blessing Photo.

IMAGE TYPE: FULL BODY SHOT (头到脚的全身照)
- The entire person must be visible from head to toe
- Professional full-length portrait composition

FACE IDENTITY (MUST PRESERVE EXACTLY):
${faceDesc}
Hair: ${hairDesc}

OUTFIT (NEW - REPLACE ORIGINAL CLOTHING):
Dress the person in elegant traditional Chinese New Year attire:
- For women: beautiful red qipao/cheongsam with gold embroidery and auspicious patterns
- For men: festive red Tang suit with intricate gold embroidery
- Include matching festive accessories like jade jewelry or lucky ornaments

POSE (祝福姿势):
The person should be in a natural blessing/greeting pose:
- Hands together in front of chest (拱手礼) OR
- Holding a red envelope or auspicious item OR
- Warm welcoming gesture with a genuine happy smile
- Body posture: confident, joyful, celebratory

STYLE: Full body portrait, ${analysisJson.style_tags?.join(', ') || 'Festive, Red, Gold'}

BACKGROUND: Festive Chinese New Year scene with red lanterns, golden decorations, dragon/snake elements, plum blossoms.

RETOUCHING: Gentle skin smoothing, bright eyes, healthy glow.

CRITICAL: 
- The person's face must be EXACTLY recognizable from the original photo
- MUST show the COMPLETE body from head to feet
- The blessing pose must look natural and joyful
            `

                const { imageBuffer: generatedImageBuffer, finalReview, attempts } = await ai.generateWithReview(
                    prompt,
                    imageBuffer,
                    3,
                    async (status, attempt, review) => {
                        const statusText = status === 'REVIEWING'
                            ? `REVIEWING_ATTEMPT_${attempt}`
                            : status === 'REGENERATING'
                                ? `REGENERATING_ATTEMPT_${attempt}`
                                : `GENERATING_ATTEMPT_${attempt}`

                        const progressData = {
                            ...analysisJson,
                            current_attempt: attempt,
                            max_attempts: 3,
                            last_review: review || null,
                            last_status: status
                        }
                        task.status = statusText
                        task.analysis_result = JSON.stringify(progressData)
                    }
                )

                console.log(`Image generation completed after ${attempts} attempt(s). Approved: ${finalReview.approved}, Score: ${finalReview.overall_score}`)

                const timestamp = Date.now()
                const generatedPath = `${prefix}sessions/${sessionDir}/generated_${timestamp}.jpg`

                await oss.putObject(generatedPath, generatedImageBuffer, 'image/jpeg')

                task.status = 'COMPLETED'
                task.generated_image_path = generatedPath
                task.analysis_result = JSON.stringify({ ...analysisJson, expert_review: finalReview, generation_attempts: attempts })

            } catch (error: any) {
                console.error('Task processing failed:', error)
                const errorMessage = error instanceof Error ? error.message : String(error)
                task.status = 'FAILED'
                task.analysis_result = JSON.stringify({ error: errorMessage })
            }
        })())

        return c.json({
            task_id: taskId,
            session_id: sessionId,
            status: 'PENDING'
        })
    } catch (e: any) {
        return c.json({ error: e.message }, 500)
    }
})

app.get('/status/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = tasks.get(taskId)

    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    return c.json(task)
})

app.get('/result/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = tasks.get(taskId)

    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    if (task.status !== 'COMPLETED') {
        return c.json({ error: 'Task not completed yet' }, 400)
    }

    const oss = new OSSService(c.env)

    const generatedBuffer = await oss.getObject(task.generated_image_path as string)
    const generatedBase64 = Buffer.from(generatedBuffer).toString('base64')
    const url = `data:image/jpeg;base64,${generatedBase64}`

    const originalBuffer = await oss.getObject(task.original_image_path)
    const originalBase64 = Buffer.from(originalBuffer).toString('base64')
    const originalUrl = `data:image/jpeg;base64,${originalBase64}`

    let analysisJson: any = {}
    try {
        if (task.analysis_result) {
            analysisJson = JSON.parse(task.analysis_result)
        }
    } catch (e) {
        console.error("Failed to parse analysis result", e)
    }

    const prompt = `
Create a Chinese New Year Blessing Photo.

IMAGE TYPE: FULL BODY SHOT (全身照)

FACE IDENTITY (MUST PRESERVE EXACTLY):
${analysisJson.face_description || 'A person with natural features'}
Hair: ${analysisJson.hair_description || 'natural hair'}

OUTFIT: Traditional Chinese New Year attire (qipao/Tang suit) with red and gold elements.

POSE: Blessing gesture (拱手礼) with joyful expression.

STYLE: Full body portrait, ${analysisJson.style_tags?.join(', ') || 'Festive, Red, Gold'}
`.trim()

    return c.json({
        url,
        originalUrl,
        prompt,
        task
    })
})

export const onRequest = app.fetch
