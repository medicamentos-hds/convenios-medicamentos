// Archivo: supabase/functions/tipoCambio/index.ts
// Se despliega con: supabase functions deploy tipoCambio

// Fuera del handler, como función auxiliar
async function getDolarCLP(): Promise<number> {
  const res  = await fetch('https://mindicador.cl/api/dolar')
  const data = await res.json()
  return data.serie[0].valor  // ej: 921.5
}

// ─── Handler principal ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {

  // Manejo de CORS para que GitHub Pages pueda llamar a esta función
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',   // en producción cambia * por tu dominio exacto
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }

  // ── Preflight (el browser pregunta antes de hacer el GET real) ──
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const valor = await getDolarCLP()

    return new Response(
      JSON.stringify({ valor }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'No se pudo obtener el tipo de cambio.' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
})