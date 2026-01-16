import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/cloudflare-pages'
import { Buffer } from 'node:buffer'
import { OSSService } from '../lib/services/oss'
import { AIService } from '../lib/services/ai'

export type Bindings = {
    GEMINI_API_KEY: string
    OSS_ACCESS_KEY_ID: string
    OSS_ACCESS_KEY_SECRET: string
    OSS_BUCKET: string
    OSS_REGION: string
    OSS_ENDPOINT: string
    OSS_PREFIX?: string
    INVITE_CODE?: string
    TASKS: KVNamespace
}

// Task interface stored in KV
interface Task {
    id: string
    session_id: string
    status: string
    original_image_path: string
    generated_image_path?: string
    analysis_result?: string
    created_at: number
}

// Helper functions for KV operations
async function getTask(kv: KVNamespace, taskId: string): Promise<Task | null> {
    const data = await kv.get(taskId, 'json')
    return data as Task | null
}

async function setTask(kv: KVNamespace, task: Task): Promise<void> {
    // Store with 1 hour TTL
    await kv.put(task.id, JSON.stringify(task), { expirationTtl: 3600 })
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.use('/*', cors())

app.onError((err, c) => {
    console.error(`[Global Error] ${err.name}: ${err.message}`, err.stack)
    return c.json({
        error: 'Internal Server Error',
        message: err.message
    }, 500)
})

app.notFound((c) => {
    return c.json({ error: 'Not Found', path: c.req.path }, 404)
})

app.get('/', (c) => {
    return c.text('Blessings API is running!')
})

// Also match without trailing slash
app.get('', (c) => {
    return c.text('Blessings API is running!')
})

app.post('/upload', async (c) => {
    try {
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

        await oss.putObject(imagePath, imageBuffer, image.type)

        // Store task in KV
        const task: Task = {
            id: taskId,
            session_id: sessionId,
            status: 'ANALYZING',
            original_image_path: imagePath,
            created_at: Date.now()
        }
        await setTask(c.env.TASKS, task)

        // Async processing
        c.executionCtx.waitUntil((async () => {
            try {
                const ai = new AIService(c.env)

                // Update status helper
                const updateStatus = async (status: string) => {
                    const currentTask = await getTask(c.env.TASKS, taskId)
                    if (currentTask) {
                        await setTask(c.env.TASKS, { ...currentTask, status })
                    }
                }

                await updateStatus('ANALYZING')

                // AI Analysis
                const analysisResult = await ai.analyzeImage(imageBuffer, image.type)
                let analysisJson: any = {}
                try {
                    const jsonStr = analysisResult.replace(/```json/g, '').replace(/```/g, '').trim()
                    analysisJson = JSON.parse(jsonStr)
                } catch (e) {
                    analysisJson = { raw_analysis: analysisResult }
                }

                // Build generation prompt
                const prompt = `Generate a Chinese New Year blessing photo based on this analysis: ${JSON.stringify(analysisJson)}`

                // Generate with expert review
                const { imageBuffer: generatedImageBuffer, finalReview, attempts } = await ai.generateWithReview(
                    prompt,
                    imageBuffer,
                    3,
                    async (status, attempt, review) => {
                        await updateStatus(`${status} (Attempt ${attempt}/3)`)
                    }
                )

                // Upload generated image
                const generatedPath = `${prefix}sessions/${sessionDir}/generated.jpg`
                await oss.putObject(generatedPath, generatedImageBuffer, 'image/jpeg')

                // Update to completed
                const completedTask = await getTask(c.env.TASKS, taskId)
                if (completedTask) {
                    await setTask(c.env.TASKS, {
                        ...completedTask,
                        status: 'COMPLETED',
                        generated_image_path: generatedPath,
                        analysis_result: JSON.stringify({
                            ...analysisJson,
                            expert_review: finalReview,
                            generation_attempts: attempts
                        })
                    })
                }
            } catch (error: any) {
                console.error('Processing failed:', error)
                const failedTask = await getTask(c.env.TASKS, taskId)
                if (failedTask) {
                    await setTask(c.env.TASKS, {
                        ...failedTask,
                        status: 'FAILED',
                        analysis_result: JSON.stringify({ error: error.message })
                    })
                }
            }
        })())

        return c.json({
            taskId,
            status: 'ANALYZING',
            message: 'Image uploaded and processing started'
        })
    } catch (error: any) {
        console.error('Upload error:', error)
        return c.json({ error: error.message }, 500)
    }
})

app.get('/status/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await getTask(c.env.TASKS, taskId)

    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    return c.json({
        taskId: task.id,
        status: task.status,
        originalImagePath: task.original_image_path,
        generatedImagePath: task.generated_image_path
    })
})

app.get('/result/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await getTask(c.env.TASKS, taskId)

    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    if (task.status !== 'COMPLETED') {
        return c.json({ error: 'Task not completed', status: task.status }, 400)
    }

    if (!task.generated_image_path) {
        return c.json({ error: 'No generated image available' }, 404)
    }

    const oss = new OSSService(c.env)
    const imageData = await oss.getObject(task.generated_image_path)

    if (!imageData) {
        return c.json({ error: 'Failed to fetch generated image' }, 500)
    }

    let analysisResult = {}
    try {
        if (task.analysis_result) {
            analysisResult = JSON.parse(task.analysis_result)
        }
    } catch (e) { }

    return c.json({
        taskId: task.id,
        status: task.status,
        imageUrl: `data:image/jpeg;base64,${Buffer.from(imageData).toString('base64')}`,
        analysis: analysisResult
    })
})

export const onRequest = handle(app)
