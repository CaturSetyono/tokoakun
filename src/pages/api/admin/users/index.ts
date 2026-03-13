import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin, hashPassword } from '../../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: err.message.includes('Forbidden') ? 403 : 401 
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await (supabaseAdmin
      .from('users') as any)
      .insert({
        name,
        email,
        password_hash: passwordHash,
        role
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify(data), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: err.message.includes('Forbidden') ? 403 : 401 
    });
  }
};
