/**
 * GET /api/testimonials
 * Returns active testimonials from D1, ordered by sort_order.
 * Bound to D1 database via wrangler.toml → binding: "DB"
 */
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, client_name, business_name, quote, image_url, video_url FROM testimonials WHERE active = 1 ORDER BY sort_order ASC"
    ).all();

    return new Response(JSON.stringify(results), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
