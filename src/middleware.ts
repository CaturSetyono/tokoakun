import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './lib/database.types';

// Routes that require authentication (prefix match)
const PROTECTED_PREFIXES = ['/dashboard'];

// Routes only accessible when NOT logged in
const AUTH_ONLY_ROUTES = ['/login', '/register'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect } = context;
  const pathname = url.pathname;

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_ROUTES.includes(pathname);

  if (!isProtected && !isAuthOnly) {
    return next();
  }

  // Build a server-side Supabase client using the request cookie header
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL!;
  const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: {
      headers: { cookie: context.request.headers.get('cookie') ?? '' },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → redirect to login
  if (isProtected && !user) {
    return redirect(`/login?redirectTo=${encodeURIComponent(pathname)}`);
  }

  // Already logged in → redirect away from login/register
  if (isAuthOnly && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ?? 'buyer';
    return redirect(
      role === 'admin' ? '/dashboard/admin'
      : role === 'seller' ? '/dashboard/seller'
      : '/dashboard/buyer'
    );
  }

  // Role-based dashboard guard: /dashboard/seller only for sellers, etc.
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ?? 'buyer';

    // Expose user info to pages via locals
    context.locals.userId = user.id;
    context.locals.userRole = role;

    if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
      return redirect('/dashboard/' + role);
    }
    if (pathname.startsWith('/dashboard/seller') && role !== 'seller' && role !== 'admin') {
      return redirect('/dashboard/buyer');
    }
    if (pathname.startsWith('/dashboard/buyer') && role !== 'buyer' && role !== 'admin') {
      return redirect('/dashboard/seller');
    }
  }

  return next();
});
