// ─── Configuración ────────────────────────────────────────────────────────
  // La ANON KEY es pública (está diseñada para estar en el browser).
  // Permite llamar a tus Edge Functions pero NO da acceso directo a la BD.
  const SUPABASE_URL = 'https://xxxx.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJ...'  // ← sí puede estar aquí, es pública

  // URL de tu Edge Function
  const AGENT_URL = `${supabaseClient.supabaseUrl}/functions/v1/agent`
  const TIPO_CAMBIO_URL = `${supabaseClient.supabaseUrl}/functions/v1/tipoCambio`

  // Clave para cachear el valor del dólar en la sesión del browser
  const CLAVE_DOLAR = 'convenios_medicamentos_dolar'

  // Historial de la conversación (se mantiene en memoria mientras dure la sesión)
  let chatHistory = []

  // ─── Mostrar/ocultar el panel de chat ───────────────────────────────────
  const chatPanel = document.getElementById('chat-panel')
  const chatToggleBtn = document.getElementById('chat-toggle-btn')
  const chatCloseBtn = document.getElementById('chat-close-btn')

  chatToggleBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('oculto')
  })

  chatCloseBtn.addEventListener('click', () => {
    chatPanel.classList.add('oculto')
  })

  // ─── Captura de ENTER ────────────────────────────────────────────────────
  const input = document.getElementById('user-input');

  input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Evita que la página se recargue (si está dentro de un formulario)
            document.getElementById('send-btn').click(); // Simula el clic del botón
        }
    });


  // ─── Función principal ────────────────────────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById('user-input')
    const message = input.value.trim()
    if (!message) return

    // Mostramos el mensaje del usuario en el chat
    const loadingIdUser = appendMessage('user', message)
    input.value = ''

    // Indicador de carga
    const loadingId = appendTyping('assistant', '...')

    try {
      const response = await fetch(AGENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // La anon key autentica la llamada a la Edge Function
          'Authorization': `Bearer ${supabaseClient.supabaseKey}`
        },
        body: JSON.stringify({
          message,
          history: chatHistory  // ← enviamos toda la historia para que Claude tenga contexto
        })
      })

      const { reply, usage } = await response.json()

      // Actualizamos el indicador con la respuesta real
      updateMessage(loadingId, reply)

      // Muestra los tokens de esta consulta
      if (usage) {
       appendTokenInfo(usage)
      }

      // Acumula el total de la sesión
      sessionTokens.input  += usage.input_tokens
      sessionTokens.output += usage.output_tokens
      updateSessionCounter()

      // Guardamos el intercambio en el historial local
      chatHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: reply }
      )

    } catch (error) {
      updateMessage(loadingId, 'Error al conectar con el agente.')
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  function appendMessage(role, text) {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const id  = `${role}-msg-${Date.now()}`
    const isUser = role === 'user'
    const div = document.createElement('div')
    div.className = `message message-${role}`
    div.id = id
    div.innerHTML = `
      <div class="avatar">${isUser ? 'TU' : 'C'}</div>
      <div>
        <div class="bubble">${text}</div>
        <div class="meta">${isUser ? 'Tú' : 'Agente'} · ${horas}:${minutos}</div>
      </div>`
    document.getElementById('messages').appendChild(div)
    div.scrollIntoView({ behavior: 'smooth' })
    return id
  }

  function appendTyping() {
    const id  = `assistant-msg-${Date.now()}`
    const div = document.createElement('div')
    div.className = 'message message-assistant'
    div.id = id
    div.innerHTML = `
      <div class="avatar">C</div>
      <div>
        <div class="bubble typing">
          <span></span><span></span><span></span>
        </div>
      </div>`
    document.getElementById('messages').appendChild(div)
    div.scrollIntoView({ behavior: 'smooth' })
    return id
  }

  function updateMessage(id, text) {
    const el = document.querySelector(`#${id} .bubble`)
    if (el) { 
      el.className = 'bubble'; 
      el.innerHTML =  marked.parse(text) 
    }
  }


  // Contador acumulado de la sesión
let sessionTokens = { input: 0, output: 0 }

function appendTokenInfo(usage) {
  const div = document.createElement('div')
  div.style.cssText = `
    font-size: 11px;
    color: #aaa;
    text-align: right;
    padding: 0 4px 8px;
  `
  div.textContent = `↑ ${usage.input_tokens} · ↓ ${usage.output_tokens} tokens`
  document.getElementById('messages').appendChild(div)
}

async function updateSessionCounter() {
  const el = document.getElementById('session-tokens')
  if (!el) return
  const total = sessionTokens.input + sessionTokens.output
  // Precio aproximado con Claude Sonnet 4.6
  const cost = ((sessionTokens.input * 3 + sessionTokens.output * 15) / 1_000_000)
  const dolarHoy = await getDolarHoy()
  const costClp = cost * dolarHoy
  el.textContent = `Sesión: ${total.toLocaleString()} tokens · ~$${cost.toFixed(4)} USD · ~$${costClp.toFixed(0)} CLP`
}

// Consulta el valor del dólar y lo cachea en sessionStorage para no volver
// a llamar a la Edge Function mientras dure la sesión del usuario.
async function getDolarHoy() {
  const cacheado = sessionStorage.getItem(CLAVE_DOLAR)
  if (cacheado !== null) {
    return Number(cacheado)
  }

  try {
    const response = await fetch(TIPO_CAMBIO_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseClient.supabaseKey}`
      }
    })
    const data = await response.json()
    sessionStorage.setItem(CLAVE_DOLAR, data.valor)
    return data.valor
  }
  catch (error) {
    console.error('Error al obtener el tipo de cambio:', error)
    return 0
  }
}