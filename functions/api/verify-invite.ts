interface Env {
  INVITE_CODE: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  try {
    const body = await request.json() as { inviteCode: string };
    
    if (!body.inviteCode) {
      return new Response(JSON.stringify({ valid: false, message: 'Invite code is required' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (body.inviteCode === env.INVITE_CODE) {
      return new Response(JSON.stringify({ valid: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    return new Response(JSON.stringify({ valid: false, message: 'Invalid invite code' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200 // Return 200 with valid: false to handle gracefully in frontend
    });
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, message: 'Server error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
