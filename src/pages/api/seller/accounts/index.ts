import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCurrentUser } from '../../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'seller' && user.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();
    const isBulk = Array.isArray(body);
    
    if (isBulk) {
      const accountsToInsert = body.map((acc: any) => ({
        seller_id: user.id,
        title: acc.title,
        category: acc.category,
        price: acc.price,
        email_account: acc.email_account,
        password_account: acc.password_account,
        thumbnail_url: acc.thumbnail_url,
        status: 'available'
      }));

      const { data, error } = await supabaseAdmin
        .from('accounts')
        .insert(accountsToInsert)
        .select();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      return new Response(JSON.stringify(data), { status: 201 });
    } else {
      const { title, category, price, email_account, password_account, thumbnail_url } = body;

      if (!title || !category || !price || !email_account || !password_account) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('accounts')
        .insert({
          seller_id: user.id,
          title,
          category,
          price,
          email_account,
          password_account,
          thumbnail_url,
          status: 'available'
        })
        .select()
        .single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      return new Response(JSON.stringify(data), { status: 201 });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
