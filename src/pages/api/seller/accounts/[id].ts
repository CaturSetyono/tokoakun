import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCurrentUser } from '../../../../lib/auth';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { title, category, price, email_account, password_account, thumbnail_url } = body;

    // Verify ownership
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('seller_id')
      .eq('id', id!)
      .single();

    if (fetchError || !account) {
       return new Response(JSON.stringify({ error: 'Account not found' }), { status: 404 });
    }

    if (account.seller_id !== user.id && user.role !== 'admin') {
       return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('accounts')
      .update({
        title, category, price, email_account, password_account, thumbnail_url
      })
      .eq('id', id!)
      .select()
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }

    return new Response(JSON.stringify(data), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { id } = params;
    if (!id) {
       return new Response(JSON.stringify({ error: 'Missing account ID' }), { status: 400 });
    }

    // Verify ownership
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('seller_id')
      .eq('id', id)
      .single();

    if (fetchError || !account) {
       return new Response(JSON.stringify({ error: 'Account not found' }), { status: 404 });
    }

    if (account.seller_id !== user.id && user.role !== 'admin') {
       return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
    }

    return new Response(null, { status: 204 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
