import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { v4 as uuidv4 } from 'uuid'
import { OSSService } from './services/oss'
import { AIService } from './services/ai'

export type Bindings = {
    DB: D1Database
    GEMINI_API_KEY: string
    OSS_ACCESS_KEY_ID: string
    OSS_ACCESS_KEY_SECRET: string
    OSS_BUCKET: string
    OSS_REGION: string
    OSS_ENDPOINT: string
    OSS_PREFIX?: string
    INVITE_CODE?: string  // Optional invite code for access control
}

import { Buffer } from 'node:buffer'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

app.get('/', (c) => {
    return c.text('Blessings API is running!')
})

app.post('/api/upload', async (c) => {
    try {
        const body = await c.req.parseBody()
        const image = body['image']
        const inviteCode = body['invite_code'] as string | undefined

        // Validate invite code if configured
        if (c.env.INVITE_CODE) {
            if (!inviteCode || inviteCode !== c.env.INVITE_CODE) {
                return c.json({ error: 'Invalid or missing invite code' }, 403)
            }
        }

        if (!(image instanceof File)) {
            return c.json({ error: 'Image file is required' }, 400)
        }

        const sessionId = uuidv4()
        const taskId = uuidv4()
        const userId = 'anonymous' // Or from auth

        const oss = new OSSService(c.env)

        // Convert File to ArrayBuffer
        const imageBuffer = await image.arrayBuffer()

        // Construct OSS Path with Prefix
        const prefix = c.env.OSS_PREFIX ? c.env.OSS_PREFIX.replace(/\/+$/, '') + '/' : ''
        const imagePath = `${prefix}sessions/${sessionId}/original.jpg`

        // Create Task in DB
        try {
            await c.env.DB.prepare(
                `INSERT INTO tasks (id, session_id, user_id, original_image_path, status) VALUES (?, ?, ?, ?, 'PENDING')`
            ).bind(taskId, sessionId, userId, imagePath).run()
        } catch (e) {
            console.error("DB Error:", e)
            return c.json({ error: 'Failed to create task in DB' }, 500)
        }

        // Async processing
        c.executionCtx.waitUntil((async () => {
            try {
                // 1. Upload Original Image
                await oss.putObject(imagePath, imageBuffer, image.type)

                // 2. Update Status to ANALYZING
                await c.env.DB.prepare(`UPDATE tasks SET status = 'ANALYZING' WHERE id = ?`).bind(taskId).run()

                // 3. AI Analysis
                const ai = new AIService(c.env)
                const analysisResult = await ai.analyzeImage(imageBuffer, image.type)

                // Check if feasible (parsing JSON from analysisResult)
                let analysisJson: any = {}
                try {
                    // Basic cleanup of code blocks if Gemini returns markdown
                    const jsonStr = analysisResult.replace(/```json/g, '').replace(/```/g, '').trim()
                    analysisJson = JSON.parse(jsonStr)
                } catch (e) {
                    console.error("Failed to parse analysis result", e)
                }

                await c.env.DB.prepare(`UPDATE tasks SET analysis_result = ? WHERE id = ?`).bind(JSON.stringify(analysisJson), taskId).run()

                if (analysisJson.is_feasible === false) {
                    // Return detailed reason for failure
                    const failureReason = analysisJson.description || analysisJson.issues?.join(', ') || 'Image analysis failed'
                    await c.env.DB.prepare(`UPDATE tasks SET status = 'FAILED', analysis_result = ? WHERE id = ?`)
                        .bind(JSON.stringify({ error: failureReason }), taskId).run()
                    return
                }

                // 4. Update Status to GENERATING
                await c.env.DB.prepare(`UPDATE tasks SET status = 'GENERATING' WHERE id = ?`).bind(taskId).run()

                // 5. Generate Full Body Blessing Photo with Expert Review Loop
                // Construct Prompt based on facial analysis only (no clothing)
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

                // Generate with expert review loop (max 3 attempts)
                const { imageBuffer: generatedImageBuffer, finalReview, attempts } = await ai.generateWithReview(
                    prompt,
                    imageBuffer,
                    3,
                    async (status, attempt, review) => {
                        // Update status in DB for each stage
                        const statusText = status === 'REVIEWING'
                            ? `REVIEWING_ATTEMPT_${attempt}`
                            : status === 'REGENERATING'
                                ? `REGENERATING_ATTEMPT_${attempt}`
                                : `GENERATING_ATTEMPT_${attempt}`
                        await c.env.DB.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).bind(statusText, taskId).run()
                    }
                )

                console.log(`Image generation completed after ${attempts} attempt(s). Approved: ${finalReview.approved}, Score: ${finalReview.overall_score}`)

                // Append timestamp to filename to avoid overwriting and provide unique ID effect if needed
                const timestamp = Date.now()
                const generatedPath = `${prefix}sessions/${sessionId}/generated_${timestamp}.jpg`

                // 6. Upload Generated Image
                await oss.putObject(generatedPath, generatedImageBuffer, 'image/jpeg')

                // 7. Update Status to COMPLETED with review results
                await c.env.DB.prepare(`UPDATE tasks SET status = 'COMPLETED', generated_image_path = ?, analysis_result = ? WHERE id = ?`)
                    .bind(generatedPath, JSON.stringify({ ...analysisJson, expert_review: finalReview, generation_attempts: attempts }), taskId).run()

            } catch (error: any) {
                console.error('Task processing failed:', error)
                const errorMessage = error instanceof Error ? error.message : String(error)
                await c.env.DB.prepare(`UPDATE tasks SET status = 'FAILED', analysis_result = ? WHERE id = ?`)
                    .bind(JSON.stringify({ error: errorMessage }), taskId).run()
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

app.get('/api/status/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await c.env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first()

    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    return c.json(task)
})

app.get('/api/result/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await c.env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first()

    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    if (task.status !== 'COMPLETED') {
        return c.json({ error: 'Task not completed yet' }, 400)
    }

    const oss = new OSSService(c.env)

    // Fetch image data and convert to Base64
    const generatedBuffer = await oss.getObject(task.generated_image_path as string)
    const generatedBase64 = Buffer.from(generatedBuffer).toString('base64')
    const url = `data:image/jpeg;base64,${generatedBase64}`

    const originalBuffer = await oss.getObject(task.original_image_path as string)
    const originalBase64 = Buffer.from(originalBuffer).toString('base64')
    const originalUrl = `data:image/jpeg;base64,${originalBase64}`

    // Parse analysis result to return prompt
    let analysisJson: any = {}
    try {
        if (task.analysis_result) {
            analysisJson = JSON.parse(task.analysis_result as string)
        }
    } catch (e) {
        console.error("Failed to parse analysis result from DB", e)
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

export default app
