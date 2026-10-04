import db from '../models/index.js';
import {
  getAgentClient,
  setClientFactoryForTests,
  NVIDIA_MODEL,
} from '../services/nvidia.client.js';

export function __setClientFactoryForTests(factory) {
  setClientFactoryForTests(factory);
}

const MAX_OUTPUT_TOKENS = 700;

async function loadCategoryNames() {
  const rows = await db.Category.findAll({
    attributes: ['name'],
    group: ['name'],
    order: [['name', 'ASC']],
  });
  return rows.map((row) => row.name);
}

function buildSystemPrompt(categoryNames) {
  const categories =
    categoryNames.length > 0
      ? categoryNames.map((name) => `- ${name}`).join('\n')
      : '(Aún no hay categorías oficiales definidas en el marketplace.)';

  return [
    'Sos el asistente del formulario de registro de tienda de TechStore, un marketplace.',
    'El usuario que va a registrar su tienda te describe, con sus palabras, a qué se dedica su negocio. Vos lo ayudás a completar el formulario.',
    '',
    'Tarea: a partir de LO QUE EL USUARIO DESCRIBE, escribí una descripción de negocio bien redactada (2 a 4 oraciones, máximo 400 caracteres, en español, neutra y profesional) y elegí la ÚNICA categoría principal que mejor encaje con su negocio.',
    '',
    'REGLAS ESTRICTAS:',
    '- NUNCA inventes datos que el usuario no mencionó: ni el nombre de la tienda, ni número de WhatsApp, ni dirección física, ni local, ni ciudad (salvo que el usuario la diga), ni precios, ni productos específicos, ni años de trayectoria.',
    '- Si el usuario no dio un dato, no lo agregues: la descripción solo debe reflejar lo que él contó, redactándolo con claridad.',
    '- La categoría principal DEBE ser UNO DE los nombres de la lista oficial de categorías del marketplace.',
    '- Atendé TODO el historial de la conversación: si el usuario agrega información en mensajes posteriores, actualizá la descripción y/o la categoría con ese dato nuevo.',
    '',
    'FORMATO DE RESPUESTA (obligatorio):',
    '- Respondé ÚNICA Y EXCLUSIVAMENTE con el objeto JSON válido que se muestra abajo, sin texto adicional, sin razonamientos, sin explicaciones, sin rodeos y sin bloques de código:',
    '{"suggestedDescription": "descripción propuesta", "suggestedCategory": "categoría oficial"}',
    '- Aunque la conversación contenga mensajes previos (tuyos o del usuario), tu ÚNICA respuesta es ese JSON. No repitas lo que dijiste antes ni escribas pensamientos en voz alta.',
    '- La descripción va en español, en 2 a 4 oraciones, máximo 400 caracteres.',
    '',
    'Ejemplo del patrón que SIEMPRE seguís (incluso en conversaciones largas):',
    'usuario: "vendo plantas artificiales"',
    'assistant: {"suggestedDescription": "Tienda dedicada a la venta de plantas artificiales para el hogar y la oficina.", "suggestedCategory": "Accesorios"}',
    'usuario: "agregá que damos descuentos por compras al por mayor"',
    'assistant: {"suggestedDescription": "Tienda dedicada a la venta de plantas artificiales para el hogar y la oficina, con descuentos por compras al por mayor.", "suggestedCategory": "Accesorios"}',
    'Nota: el mensaje del assistant en el historial es un dato estructurado; tu próxima respuesta es SIEMPRE el JSON actualizado, nunca una explicación de ese dato.',
    '',
    'Categorías oficiales del marketplace:',
    categories,
  ].join('\n');
}

function buildStrictCorrectivePrompt(categoryNames) {
  const catList =
    categoryNames.length > 0 ? categoryNames.join(', ') : '(sin categorías, devolvé null)';
  return [
    'Tu ÚNICA respuesta es un objeto JSON válido con exactamente dos claves:',
    '"suggestedDescription" y "suggestedCategory".',
    '"suggestedDescription": descripción de negocio en español, 2 a 4 oraciones, máximo 400 caracteres, solo con datos que el usuario mencionó.',
    `"suggestedCategory": un solo elemento de la lista oficial: ${catList}.`,
    'No agregues NINGÚN texto fuera del objeto JSON: ni razonamientos, ni explicaciones, ni bloques de código.',
    'No uses puntos suspensivos ni placeholders: el texto de suggestedDescription debe ser completo y concreto.',
  ].join('\n');
}

async function complete(client, messages) {
  const response = await client.chat.completions.create({
    model: NVIDIA_MODEL,
    temperature: 0.1,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages,
  });
  return response.choices?.[0]?.message?.content ?? '';
}

function parseStructuredSuggestion(content) {
  if (!content || typeof content !== 'string') return null;

  const tryParse = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
    return null;
  };

  const noCodeFences = content
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const direct = tryParse(noCodeFences);
  if (direct) return direct;

  const firstBrace = noCodeFences.indexOf('{');
  const lastBrace = noCodeFences.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = tryParse(noCodeFences.slice(firstBrace, lastBrace + 1));
    if (extracted) return extracted;
  }

  const newline = noCodeFences.indexOf('\n');
  if (newline !== -1) {
    const firstLine = tryParse(noCodeFences.slice(0, newline));
    if (firstLine) return firstLine;
  }

  return null;
}

export function sanitizeSuggestion(parsed, categoryNames) {
  const description =
    typeof parsed?.suggestedDescription === 'string' &&
    parsed.suggestedDescription.trim().length > 0
      ? parsed.suggestedDescription.trim()
      : null;

  const rawCategory =
    typeof parsed?.suggestedCategory === 'string' ? parsed.suggestedCategory.trim() : '';

  const normalized = categoryNames.find((name) => name.toLowerCase() === rawCategory.toLowerCase());

  return {
    suggestedDescription: description,
    suggestedCategory: normalized ?? null,
  };
}

function buildDigest(messages) {
  const lines = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object' || typeof m.content !== 'string') continue;
    if (m.role === 'user') {
      lines.push(`- ${m.content}`);
    } else if (m.role === 'assistant') {
      const structured = parseStructuredSuggestion(m.content);
      if (
        structured &&
        typeof structured.suggestedDescription === 'string' &&
        structured.suggestedDescription.trim()
      ) {
        lines.push(
          `- (Sugerencia actual del asistente) descripción: "${structured.suggestedDescription.trim()}"; categoría: "${structured.suggestedCategory ?? ''}"`,
        );
      }
    }
  }

  if (lines.length <= 1 && messages.filter((m) => m?.role === 'user').length <= 1) {
    const onlyUser = messages.find((m) => m?.role === 'user');
    return String(onlyUser?.content ?? '');
  }

  return [
    'Mensajes de la conversación hasta ahora (el último es el más reciente). Tomá en cuenta TODO para acumular la información: si aparece una sugerencia actual del asistente, actualizala manteniendo lo esencial y agregando lo nuevo; no la reemplaces por completo ni descartes información previa:',
    ...lines,
  ].join('\n');
}

function isAcceptableSuggestion(parsed) {
  const description = parsed?.suggestedDescription?.trim() ?? '';
  return description.length >= 20 && !/\.{3}/.test(description);
}

export async function storeApplicationAssistantChat(req, res, next) {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ error: 'messages debe ser una lista no vacía de mensajes de conversación.' });
    }

    const categoryNames = await loadCategoryNames();

    const userMessages = messages.filter((m) => m && typeof m === 'object' && m.role === 'user');
    if (userMessages.length === 0) {
      return res
        .status(400)
        .json({ error: 'La conversación debe incluir al menos un mensaje del usuario.' });
    }

    const digest = buildDigest(messages);
    const convo = [
      { role: 'system', content: buildSystemPrompt(categoryNames) },
      { role: 'user', content: digest },
    ];

    const client = getAgentClient();
    let content = await complete(client, convo);
    let parsed = parseStructuredSuggestion(content);
    const fallbackText = content;

    if (!isAcceptableSuggestion(parsed)) {
      const lastUserContent = userMessages[userMessages.length - 1]?.content ?? '';
      const correctiveUser = lastUserContent
        ? `${lastUserContent}\n\n(Recordá: respondé SOLO el objeto JSON, sin texto adicional.)`
        : 'Respondé solo el objeto JSON.';
      content = await complete(client, [
        { role: 'system', content: buildStrictCorrectivePrompt(categoryNames) },
        { role: 'user', content: correctiveUser },
      ]);
      parsed = parseStructuredSuggestion(content);
    }

    const suggestions = sanitizeSuggestion(
      isAcceptableSuggestion(parsed) ? parsed : null,
      categoryNames,
    );

    const reply = isAcceptableSuggestion(parsed)
      ? '¡Listo! Escribí una descripción propuesta para tu tienda y la categoría principal que mejor encaja. Revisalas y ajustá lo que necesites.'
      : fallbackText;

    return res.json({ reply, ...suggestions });
  } catch (error) {
    if (error.message?.includes('NVIDIA_API_KEY')) {
      return res.status(503).json({ error: error.message });
    }
    return next(error);
  }
}
