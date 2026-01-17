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
    TASKS: KVNamespace  // Cloudflare KV for persistent task storage
    // AI Configuration
    MAX_RETRIES?: string  // Max generation+review cycles (default: 1)
    ENABLE_REVIEW?: string  // Enable expert review step (default: true)
}

// Task interface stored in KV
interface Task {
    id: string
    session_id: string
    status: string
    original_image_path: string
    generated_image_path?: string
    analysis_result?: string
    error_message?: string
    created_at: number
}

// Helper functions for KV operations
async function getTask(kv: KVNamespace, taskId: string): Promise<Task | null> {
    const data = await kv.get(taskId, 'json')
    return data as Task | null
}

async function setTask(kv: KVNamespace, task: Task): Promise<void> {
    // Store with 1 hour TTL (auto cleanup)
    await kv.put(task.id, JSON.stringify(task), { expirationTtl: 3600 })
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.use('/*', cors())

app.onError((err, c) => {
    console.error(`[Global Error] ${err.name}: ${err.message}`, err.stack)
    return c.json({
        error: 'Internal Server Error',
        message: err.message,
        details: err.stack?.split('\n')[0]
    }, 500)
})

app.notFound((c) => {
    return c.json({ error: 'Not Found', path: c.req.path }, 404)
})

app.get('/', (c) => {
    return c.text('Blessings API is running!')
})

app.get('', (c) => {
    return c.text('Blessings API is running!')
})

// Upload endpoint - returns taskId immediately
app.post('/upload', async (c) => {
    try {
        const body = await c.req.parseBody()
        const image = body['image']
        const inviteCode = body['invite_code'] as string | undefined

        if (c.env.INVITE_CODE) {
            if (!inviteCode || inviteCode !== c.env.INVITE_CODE) {
                return c.json({ error: 'Invalid or missing invite code', code: 'INVALID_INVITE_CODE' }, 403)
            }
        }

        if (!(image instanceof File)) {
            return c.json({ error: 'Image file is required', code: 'NO_IMAGE' }, 400)
        }

        // Check file size (max 10MB)
        if (image.size > 10 * 1024 * 1024) {
            return c.json({ error: 'Image too large (max 10MB)', code: 'IMAGE_TOO_LARGE' }, 400)
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

        // Upload original image
        await oss.putObject(imagePath, imageBuffer, image.type)
        console.log('Original image uploaded:', imagePath)

        // Create task in KV
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
                const updateStatus = async (status: string, extra?: Partial<Task>) => {
                    const currentTask = await getTask(c.env.TASKS, taskId)
                    if (currentTask) {
                        await setTask(c.env.TASKS, { ...currentTask, status, ...extra })
                    }
                }

                await updateStatus('ANALYZING')
                console.log('Starting AI analysis...')

                // AI Analysis
                const analysisResult = await ai.analyzeImage(imageBuffer, image.type)
                let analysisJson: any = {}
                try {
                    const jsonStr = analysisResult.replace(/```json/g, '').replace(/```/g, '').trim()
                    analysisJson = JSON.parse(jsonStr)
                } catch (e) {
                    analysisJson = { raw_analysis: analysisResult }
                }
                console.log('Analysis complete')

                // Build generation prompt
                const prompt = `Generate a Chinese New Year blessing photo based on this analysis: ${JSON.stringify(analysisJson)}`

                await updateStatus('GENERATING')
                console.log('Starting image generation...')

                // Get configuration from environment
                const maxRetries = parseInt(c.env.MAX_RETRIES || '1', 10)
                const enableReview = c.env.ENABLE_REVIEW !== 'false'
                console.log(`Config: maxRetries=${maxRetries}, enableReview=${enableReview}`)

                // Generate with expert review
                const { imageBuffer: generatedImageBuffer, finalReview, attempts } = await ai.generateWithReview(
                    prompt,
                    imageBuffer,
                    maxRetries,
                    enableReview ? async (status, attempt) => {
                        await updateStatus(`${status}_ATTEMPT_${attempt}`)
                    } : undefined
                )
                console.log(`Generation complete after ${attempts} attempts`)

                // Upload generated image
                const generatedPath = `${prefix}sessions/${sessionDir}/generated.jpg`
                await oss.putObject(generatedPath, generatedImageBuffer, 'image/jpeg')
                console.log('Generated image uploaded:', generatedPath)

                // Update to completed
                await updateStatus('COMPLETED', {
                    generated_image_path: generatedPath,
                    analysis_result: JSON.stringify({
                        ...analysisJson,
                        expert_review: finalReview,
                        generation_attempts: attempts
                    })
                })
            } catch (error: any) {
                console.error('Processing failed:', error)
                const failedTask = await getTask(c.env.TASKS, taskId)
                if (failedTask) {
                    await setTask(c.env.TASKS, {
                        ...failedTask,
                        status: 'FAILED',
                        error_message: error.message || 'Unknown error'
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
        return c.json({
            error: error.message || 'Upload failed',
            code: 'UPLOAD_ERROR',
            details: error.stack?.split('\n')[0]
        }, 500)
    }
})

// Status endpoint - poll this to check progress
app.get('/status/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await getTask(c.env.TASKS, taskId)

    if (!task) {
        return c.json({
            error: 'Task not found',
            code: 'TASK_NOT_FOUND',
            hint: 'Task may have expired (1 hour TTL)'
        }, 404)
    }

    return c.json({
        taskId: task.id,
        status: task.status,
        errorMessage: task.error_message
    })
})

// Result endpoint - get the generated image
app.get('/result/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await getTask(c.env.TASKS, taskId)

    if (!task) {
        return c.json({
            error: 'Task not found',
            code: 'TASK_NOT_FOUND'
        }, 404)
    }

    if (task.status !== 'COMPLETED') {
        return c.json({
            error: 'Task not completed',
            status: task.status,
            errorMessage: task.error_message
        }, 400)
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

// Debug endpoint - check egress IP
app.get('/debug/egress-ip', async (c) => {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json() as { ip: string }
    return c.json({
        egress_ip: data.ip,
        message: 'This IP should be a Cloudflare IP'
    })
})

export const onRequest = handle(app)
