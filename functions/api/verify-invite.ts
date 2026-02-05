interface CloudflareContext {
  request: {
    json: () => Promise<unknown>;
    cf?: Record<string, unknown>;
  };
  env: {
    INVITE_CODE: string;
  };
  params: Record<string, string>;
  waitUntil: (promise: Promise<void>) => void;
  passThroughOnException: () => void;
}

export const onRequestPost = async (context: CloudflareContext) => {
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
      status: 200
    });
  } catch {
    return new Response(JSON.stringify({ valid: false, message: 'Server error' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
