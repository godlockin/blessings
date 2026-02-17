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

/**
 * Standard security headers for all API responses
 */
const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'"
};

/**
 * Constant-time string comparison to prevent timing attacks.
 * This ensures the comparison takes the same amount of time regardless of where
 * the first mismatch occurs, making it harder for attackers to guess valid codes.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export const onRequestPost = async (context: CloudflareContext) => {
  const { request, env } = context;

  try {
    const body = await request.json() as { inviteCode: string };

    if (!body.inviteCode) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Invite code is required' }),
        {
          headers: SECURITY_HEADERS,
          status: 400
        }
      );
    }

    // Fixed: Use constant-time comparison to prevent timing attacks
    const isValid = constantTimeCompare(body.inviteCode, env.INVITE_CODE);
    if (isValid) {
      return new Response(
        JSON.stringify({ valid: true }),
        {
          headers: SECURITY_HEADERS,
          status: 200
        }
      );
    }

    return new Response(
      JSON.stringify({ valid: false, message: 'Invalid invite code' }),
      {
        headers: SECURITY_HEADERS,
        status: 200
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ valid: false, message: 'Server error' }),
      {
        headers: SECURITY_HEADERS,
        status: 500
      }
    );
  }
}
