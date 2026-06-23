// Archivo: supabase/functions/chat-agent/index.ts
// Se despliega con: supabase functions deploy chat-agent

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24'

// ─── Clientes ────────────────────────────────────────────────────────────────

// Cliente de Supabase con SERVICE_ROLE_KEY → puede leer/escribir sin restricciones RLS
// Esta clave viene de las variables de entorno del servidor, nunca del browser
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Cliente de Anthropic con tu API key (también solo en el servidor)
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!
})

// ─── Descripción de tus tablas (ajústala a tu esquema real) ──────────────────
const DB_SCHEMA = `
Tablas disponibles:
- medicamento(id, created_at, nombre_med, codigo_med, consumo_ant_1, consumo_ant_2, anio_ant_1, anio_ant_2, fecha_actual, consumo_actual, prom_repo, consumo_proy, observaciones)
- convenio_act(id, created_at, id_convenio, cantidad, precio_unit_neto, duracion_meses, precio_total_conv, precio_anual_conv, id_medicamento, id_proveedor)
- convenio_nuevo(id, created_at, id_convenio, cantidad, precio_unit_neto, duracion_meses, precio_total_conv, precio_anual_conv, id_medicamento, id_proveedor)
- proveedor(id, created_at, nombre_proveedor)
`

// ─── Definición de la "tool" que Claude puede usar ───────────────────────────
// Claude no ejecuta SQL directamente; solo nos DICE qué query quiere hacer.
// Nosotros somos los que la ejecutamos (punto de seguridad clave).
const tools: Anthropic.Tool[] = [
  {
    name: 'query_database',
    description: 'Ejecuta una consulta SQL de solo lectura sobre la base de datos de convenios de medicamentos.',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Query SQL válido. Solo SELECT, sin DROP/DELETE/UPDATE.'
        },
        explanation: {
          type: 'string',
          description: 'Explica en una frase qué datos vas a buscar y por qué.'
        }
      },
      required: ['sql', 'explanation']
    }
  }
]

// ─── Handler principal ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {

  // Manejo de CORS para que GitHub Pages pueda llamar a esta función
   const corsHeaders = {
    'Access-Control-Allow-Origin': '*',   // en producción cambia * por tu dominio exacto
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // ── Preflight (el browser pregunta antes de hacer el POST real) ──
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // El frontend envía: { message: "...", history: [...mensajes previos] }
  const { message, history = [] } = await req.json()

  // ─── Construimos el historial de mensajes ────────────────────────────────
  // Claude no tiene memoria entre llamadas; siempre enviamos toda la conversación.
  const messages: Anthropic.MessageParam[] = [
    ...history,          // ← mensajes anteriores del chat (rol user/assistant)
    { role: 'user', content: message }  // ← el mensaje nuevo del usuario
  ]

  // ─── Primera llamada a Claude ────────────────────────────────────────────
  // Claude lee el mensaje y decide si necesita consultar la BD o puede responder directo.
  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `Eres un analista de datos experto. Tienes acceso a una base de datos con esta estructura: ${DB_SCHEMA}
Cuando necesites datos para responder, usa la tool query_database.
Responde siempre en español, con análisis claros y concisos.
Si detectas tendencias o anomalías interesantes en los datos, menciónalas.
A modo explicativo, en la tabla medicamento,la fecha actual indica el año de consumo actual, por ejemplo si la fecha es en junio del 2026, el consumo actual corresponde al mes indicado y el proyectado al año 2026.`,
    tools,
    messages
  })

  // ─── Bucle de tool use ───────────────────────────────────────────────────
  // Claude puede necesitar hacer VARIAS consultas antes de dar su respuesta final.
  // Por eso es un bucle, no un if simple.
  while (response.stop_reason === 'tool_use') {

    // Extraemos todos los bloques tool_use que Claude quiere ejecutar
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    // Preparamos la respuesta que le devolveremos a Claude con los resultados
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      const { sql, explanation } = toolUse.input as { sql: string; explanation: string }

      // Seguridad básica: bloqueamos queries que modifiquen datos
      const isSafe = /^\s*SELECT/i.test(sql) &&
                     !/DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER/i.test(sql)

      let result: string

      if (!isSafe) {
        result = 'Error: solo se permiten queries SELECT.'
      } else {
        // Ejecutamos la query usando el cliente de Supabase con service role
        const { data, error } = await supabase.rpc('execute_readonly_query', { query: sql })

        if (error) {
          result = `Error en la base de datos: ${error.message}`
        } else {
          // Convertimos el resultado a string JSON para pasárselo a Claude
          result = JSON.stringify(data, null, 2)
        }
      }

      // Guardamos el resultado para enviárselo a Claude en la próxima vuelta
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,  // ← Supabase necesita este ID para saber a qué tool_use responde
        content: result
      })
    }

    // Agregamos al historial: lo que Claude respondió + los resultados de las tools
    messages.push(
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults }
    )

    // Segunda (o tercera...) llamada a Claude con los datos de la BD
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
    system: `Eres un analista de datos experto. Tienes acceso a una base de datos con esta estructura: ${DB_SCHEMA}
Cuando necesites datos para responder, usa la tool query_database.
Responde siempre en español, con análisis claros y concisos.
Si detectas tendencias o anomalías interesantes en los datos, menciónalas.
A modo explicativo, en la tabla medicamento,la fecha actual indica el año de consumo actual, por ejemplo si la fecha es en junio del 2026, el consumo actual corresponde al mes indicado y el proyectado al año 2026.`,
    tools,
      messages
    })
  }

  // ─── Respuesta final ─────────────────────────────────────────────────────
  // Cuando stop_reason === 'end_turn', Claude ya tiene todo y da su respuesta en texto
  const finalText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')

    // ← usage viene directo de la respuesta de Anthropic
    const usage = {
      input_tokens:  response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens:  response.usage.input_tokens + response.usage.output_tokens
    }

  return new Response(
    JSON.stringify({ reply: finalText, usage }),
    {
      headers: {
        'Content-Type': 'application/json',
        //'Access-Control-Allow-Origin': 'https://medicamentos-hds.github.io'
		    'Access-Control-Allow-Origin': '*'
      }
    }
  )
})