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
                console.log(`==== BEFORE generateWithReview ====`)
                console.log(`Input imageBuffer size: ${imageBuffer?.byteLength || 0} bytes`)
                console.log(`Prompt length: ${prompt.length} chars`)

                // Generate with expert review
                const skipReview = !enableReview
                let generatedImageBuffer: ArrayBuffer | null = null
                let finalReview: any
                let attempts: number

                try {
                    const result = await ai.generateWithReview(
                        prompt,
                        imageBuffer,
                        maxRetries,
                        async (status, attempt) => {
                            await updateStatus(`${status}_ATTEMPT_${attempt}`)
                        },
                        skipReview
                    )
                    generatedImageBuffer = result.imageBuffer
                    finalReview = result.finalReview
                    attempts = result.attempts
                } catch (genError: any) {
                    console.error('==== generateWithReview THREW ERROR ====')
                    console.error('Error message:', genError?.message)
                    console.error('Error stack:', genError?.stack?.split('\n').slice(0, 3).join('\n'))
                    throw genError
                }

                console.log(`==== AFTER generateWithReview ====`)
                console.log(`Output buffer: ${generatedImageBuffer ? `${generatedImageBuffer.byteLength} bytes` : 'NULL'}`)
                console.log(`Generation complete after ${attempts} attempts`)

                // Validate generated image first
                if (!generatedImageBuffer) {
                    throw new Error('Generated image buffer is null')
                }
                if (generatedImageBuffer.byteLength === 0) {
                    throw new Error('Generated image buffer is empty (0 bytes)')
                }

                console.log(`Generated image buffer size: ${generatedImageBuffer.byteLength} bytes`)

                // Upload generated image
                const generatedPath = `${prefix}sessions/${sessionDir}/generated.jpg`
                await oss.putObject(generatedPath, generatedImageBuffer, 'image/jpeg')
                console.log('Generated image uploaded:', generatedPath, `(${generatedImageBuffer.byteLength} bytes)`)

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
    console.log('Fetching generated image:', task.generated_image_path)
    const imageData = await oss.getObject(task.generated_image_path)

    if (!imageData) {
        console.error('Image data is null/undefined')
        return c.json({ error: 'Failed to fetch generated image' }, 500)
    }

    console.log(`Fetched image size: ${imageData.byteLength} bytes`)

    let analysisResult = {}
    try {
        if (task.analysis_result) {
            analysisResult = JSON.parse(task.analysis_result)
        }
    } catch (e) { }

    const base64Data = Buffer.from(imageData).toString('base64')
    console.log(`Base64 encoded length: ${base64Data.length} chars`)

    return c.json({
        taskId: task.id,
        status: task.status,
        imageUrl: `data:image/jpeg;base64,${base64Data}`,
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

// Debug endpoint - test Pollinations.ai directly
app.get('/debug/test-pollinations', async (c) => {
    try {
        const prompt = encodeURIComponent('A simple red circle on white background')
        const url = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&width=256&height=256`
        console.log('Testing Pollinations.ai at:', url)

        const response = await fetch(url)
        console.log('Pollinations response status:', response.status)
        console.log('Pollinations response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())))

        if (!response.ok) {
            return c.json({
                success: false,
                status: response.status,
                statusText: response.statusText
            })
        }

        const buffer = await response.arrayBuffer()
        console.log('Pollinations buffer size:', buffer.byteLength)

        return c.json({
            success: true,
            status: response.status,
            bufferSize: buffer.byteLength,
            contentType: response.headers.get('content-type')
        })
    } catch (e: any) {
        console.error('Pollinations test error:', e)
        return c.json({
            success: false,
            error: e.message
        }, 500)
    }
})

// Debug endpoint - test full generateImage flow
app.get('/debug/test-generate', async (c) => {
    try {
        const ai = new AIService(c.env)
        const testPrompt = 'A simple portrait of a person wearing red Chinese clothes, festive background'

        console.log('=== DEBUG TEST GENERATE START ===')
        console.log('GEMINI_API_KEY length:', c.env.GEMINI_API_KEY?.length || 0)

        const result = await ai.generateImage(testPrompt)

        console.log('=== DEBUG TEST GENERATE END ===')
        console.log('Result type:', typeof result)
        console.log('Result byteLength:', result?.byteLength)

        return c.json({
            success: true,
            bufferSize: result?.byteLength || 0
        })
    } catch (e: any) {
        console.error('Test generate error:', e)
        return c.json({
            success: false,
            error: e.message,
            stack: e.stack
        }, 500)
    }
})

// Debug endpoint - test full generateImage flow with original image
app.get('/debug/test-generate-with-image', async (c) => {
    try {
        const ai = new AIService(c.env)
        const testPrompt = 'A simple portrait of a person wearing red Chinese clothes, festive background'

        // Create a simple PNG as test original image (100x100 blue square)
        // PNG header + minimal IHDR + IDAT + IEND chunks
        const pngData = new Uint8Array([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // Width=1, Height=1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // Bit depth, color type, CRC
            0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT length + type
            0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, 0x01, // Compressed data
            0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, // CRC
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND
            0xAE, 0x42, 0x60, 0x82 // CRC
        ])

        console.log('=== DEBUG TEST GENERATE WITH IMAGE START ===')
        console.log('GEMINI_API_KEY length:', c.env.GEMINI_API_KEY?.length || 0)
        console.log('Test image size:', pngData.length, 'bytes')

        const result = await ai.generateImage(testPrompt, pngData.buffer as ArrayBuffer)

        console.log('=== DEBUG TEST GENERATE WITH IMAGE END ===')
        console.log('Result type:', typeof result)
        console.log('Result byteLength:', result?.byteLength)

        return c.json({
            success: true,
            bufferSize: result?.byteLength || 0
        })
    } catch (e: any) {
        console.error('Test generate with image error:', e)
        return c.json({
            success: false,
            error: e.message,
            stack: e.stack?.split('\n').slice(0, 5).join('\n') // first 5 lines of stack
        }, 500)
    }
})

// Debug endpoint - test full generateWithReview flow
app.get('/debug/test-generate-with-review', async (c) => {
    try {
        const ai = new AIService(c.env)
        const testPrompt = 'Generate a Chinese New Year blessing photo'

        // Create a simple test image (200x200 pink square - person face-like)
        const pngData = new Uint8Array([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
            0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
            0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, 0x01,
            0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
            0xAE, 0x42, 0x60, 0x82
        ])

        console.log('=== DEBUG TEST GENERATE WITH REVIEW START ===')
        console.log('GEMINI_API_KEY length:', c.env.GEMINI_API_KEY?.length || 0)
        console.log('Test image size:', pngData.length, 'bytes')
        console.log('ENABLE_REVIEW env:', c.env.ENABLE_REVIEW)

        const skipReview = c.env.ENABLE_REVIEW === 'false'
        const result = await ai.generateWithReview(
            testPrompt,
            pngData.buffer as ArrayBuffer,
            1, // maxRetries
            async (status, attempt) => {
                console.log(`Status update: ${status}, attempt ${attempt}`)
            },
            skipReview
        )

        console.log('=== DEBUG TEST GENERATE WITH REVIEW END ===')
        console.log('Result imageBuffer:', result.imageBuffer ? `${result.imageBuffer.byteLength} bytes` : 'null')
        console.log('Result attempts:', result.attempts)
        console.log('Result approved:', result.finalReview?.approved)

        return c.json({
            success: true,
            bufferSize: result.imageBuffer?.byteLength || 0,
            attempts: result.attempts,
            approved: result.finalReview?.approved,
            score: result.finalReview?.overall_score
        })
    } catch (e: any) {
        console.error('Test generateWithReview error:', e)
        return c.json({
            success: false,
            error: e.message,
            stack: e.stack?.split('\n').slice(0, 5).join('\n')
        }, 500)
    }
})

export const onRequest = handle(app)
