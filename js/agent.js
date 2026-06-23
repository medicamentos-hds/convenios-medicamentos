// ─── Configuración ────────────────────────────────────────────────────────
  // La ANON KEY es pública (está diseñada para estar en el browser).
  // Permite llamar a tus Edge Functions pero NO da acceso directo a la BD.
  const SUPABASE_URL = 'https://xxxx.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJ...'  // ← sí puede estar aquí, es pública

  // URL de tu Edge Function
  const AGENT_URL = `${supabaseClient.supabaseUrl}/functions/v1/agent`

  // Historial de la conversación (se mantiene en memoria mientras dure la sesión)
  let chatHistory = []

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
    const loadingId = appendMessage('assistant', '...')

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

      const { reply } = await response.json()

      // Actualizamos el indicador con la respuesta real
      updateMessage(loadingId, reply)

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
    const id  = `msg-${Date.now()}`
    const isUser = role === 'user'
    const div = document.createElement('div')
    div.className = `message message-${role}`
    div.id = id
    div.innerHTML = `
      <div class="avatar">${isUser ? 'TU' : '🤖'}</div>
      <div>
        <div class="bubble">${text}</div>
        <div class="meta">${isUser ? 'Tú' : 'Agente'} · ${horas}:${minutos}</div>
      </div>`
    document.getElementById('messages').appendChild(div)
    div.scrollIntoView({ behavior: 'smooth' })
    return role+"-"+id
  }

  function appendTyping() {
    const id  = `msg-${Date.now()}`
    const div = document.createElement('div')
    div.className = 'message message-assistant'
    div.id = id
    div.innerHTML = `
      <div class="avatar">AI</div>
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
    if (el) { el.className = 'bubble'; el.textContent = text }
  }
  