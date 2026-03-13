import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { verifyPassword, createSessionToken } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400 }
      );
    }

    // 1. Find user in public.users
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401 }
      );
    }

    // 2. Verify password (hashed)
    const isValid = await verifyPassword(password, (user as any).password_hash);

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401 }
      );
    }

    // 3. Create session token (JWT)
    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    // 4. Set httpOnly cookie
    cookies.set('session', token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return new Response(
      JSON.stringify({ 
        message: 'Login successful', 
        user: { id: user.id, email: user.email, name: user.name, role: user.role } 
      }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};
