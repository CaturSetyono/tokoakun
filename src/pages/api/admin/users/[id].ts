import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin, hashPassword } from '../../../../lib/auth';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    await requireAdmin(request);
    const { id } = params;
    const { name, role, password } = await request.json();

    if (!id) {
       return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
    }

    const updates: any = { name, role };
    if (password) {
      updates.password_hash = await hashPassword(password);
    }

    const { data, error } = await (supabaseAdmin
      .from('users') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: err.message.includes('Forbidden') ? 403 : 401 
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    await requireAdmin(request);
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ message: 'User deleted successfully' }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: err.message.includes('Forbidden') ? 403 : 401 
    });
  }
};
