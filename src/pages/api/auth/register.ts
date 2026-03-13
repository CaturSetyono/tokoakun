import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { hashPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }

    // Security: Only allow 'buyer' or 'seller' via public registration
    if (role !== 'buyer' && role !== 'seller') {
       return new Response(
        JSON.stringify({ error: 'Invalid role for registration' }),
        { status: 400 }
      );
    }

    // 1. Check if user already exists in public.users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 400 }
      );
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Insert into public.users
    const { data, error } = await (supabaseAdmin
      .from('users') as any)
      .insert({
        email,
        password_hash: passwordHash,
        name,
        role
      })
      .select()
      .single();

    if (error) {
       return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(
      JSON.stringify({ 
        message: 'Registration successful', 
        user: { id: data.id, email: data.email, name: data.name, role: data.role } 
      }),
      { status: 201 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};


