import { getAgentClient, setClientFactoryForTests, NVIDIA_MODEL } from '../services/nvidia.client.js';
import { querySiteProducts, toProductJson } from './product.controller.js';

const MAX_TOOL_ROUNDS = 4;
const SEARCH_LIMIT = 8;

export function __setClientFactoryForTests(factory) {
  setClientFactoryForTests(factory);
}

const SEARCH_PRODUCTS_TOOL = {
  type: 'function',
  function: {
    name: 'search_products',
    description:
      'Busca productos reales en todo el marketplace, entre todas las tiendas aprobadas. Usala para recomendar productos según lo que pide el cliente.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Términos de búsqueda descriptos por el cliente (ej. "auriculares inalámbricos").',
        },
        category: {
          type: 'string',
          description: 'Slug de la categoría, solo si el cliente la menciona (ej. "audio").',
        },
        store_slug: {
          type: 'string',
          description: 'Slug de la tienda, solo si el cliente la menciona.',
        },
        maxPrice: {
          type: 'number',
          description: 'Precio máximo, solo si el cliente lo indica.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

const GREETING =
  '¿Necesitas ayuda con tu compra? Te ayudo a encontrar tu producto ideal entre todas las tiendas 🤖';

function buildShoppingSystemPrompt() {
  return [
    'Sos el asistente de compras de TechStore, un marketplace con varias tiendas independientes.',
    'El cliente te describe lo que quiere comprar y vos lo ayudás a encontrar productos REALES en todo el marketplace.',
    '',
    'REGLAS ESTRICTAS:',
    '- Para recomendar productos SIEMPRE llamá a la herramienta search_products con los términos que menciona el cliente (query, y opcionalmente category, store_slug o maxPrice).',
    '- NUNCA inventes productos, precios, tiendas ni links: usá únicamente los resultados reales que devuelve search_products.',
    '- Si search_products no devuelve resultados, comunicáselo al cliente y ofrecé afinar la búsqueda. No inventes nada.',
    '- Respondé en español, breve y amable. Cuando haya resultados, nombrá los productos concretos con su tienda y su precio, y aclarale que debajo le quedan tarjetas clicables.',
    '',
    `Saludo inicial del asistente: "${GREETING}"`,
  ].join('\n');
}

function productSummary(product) {
  const json = toProductJson(product);
  return {
    id: json.id,
    name: json.name,
    slug: json.slug,
    price: json.price,
    imageUrl: json.imageUrl ?? null,
    store: json.store ? { name: json.store.name, slug: json.store.slug } : null,
    category: json.category ? { name: json.category.name, slug: json.category.slug } : null,
  };
}

const STOPWORDS = new Set([
  'a', 'al', 'ante', 'bien', 'con', 'de', 'del', 'el', 'en', 'es', 'la',
  'las', 'los', 'mas', 'muy', 'no', 'o', 'para', 'pero', 'por', 'que',
  'quiero', 'queria', 'sean', 'ser', 'su', 'una', 'uno', 'un', 'us', 'y',
]);

async function executeSearch(args = {}) {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    return {
      ok: false,
      products: [],
      toolPayload: {
        success: false,
        count: 0,
        products: [],
        message: 'search_products requiere un query de búsqueda no vacío.',
        hint: 'Pedí al cliente que te diga qué producto busca antes de recomendar.',
      },
    };
  }

  const filters = {
    category: args.category,
    storeSlug: args.store_slug,
    maxPrice: args.maxPrice,
    limit: SEARCH_LIMIT,
  };

  const tokens = query
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token.toLowerCase()));
  const matches = new Map();

  for (const token of tokens) {
    const { rows } = await querySiteProducts({ search: token, ...filters });
    for (const row of rows) {
      const existing = matches.get(row.id);
      matches.set(row.id, { row, score: (existing?.score ?? 0) + 1 });
    }
  }

  const products = [...matches.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, SEARCH_LIMIT)
    .map((entry) => productSummary(entry.row));

  if (products.length === 0) {
    return {
      ok: true,
      products,
      toolPayload: {
        success: true,
        count: 0,
        products,
        message:
          'No se encontraron productos para esa búsqueda. Comunicáselo al cliente y ofrecé afinar los términos.',
      },
    };
  }

  return {
    ok: true,
    products,
    toolPayload: {
      success: true,
      count: products.length,
      products,
      message:
        'Resultados reales del marketplace, ordenados por relevancia. Recomendá los que mejor se ajusten a lo que pide el cliente, con nombre, tienda y precio.',
    },
  };
}

export async function shoppingAssistantChat(req, res, next) {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ error: 'messages debe ser una lista no vacía de mensajes de conversación.' });
    }

    const convo = [
      { role: 'system', content: buildShoppingSystemPrompt() },
      ...messages
        .filter((m) => m && typeof m === 'object' && typeof m.role === 'string')
        .map((m) => ({ role: m.role, content: m.content ?? '' })),
    ];

    const client = getAgentClient();
    let suggestedProducts = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: NVIDIA_MODEL,
        temperature: 0.2,
        max_tokens: 1024,
        messages: convo,
        tools: [SEARCH_PRODUCTS_TOOL],
      });

      const message = response.choices[0]?.message;
      const toolCalls = message?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return res.json({
          reply: message?.content ?? '',
          products: suggestedProducts,
        });
      }

      convo.push({
        role: 'assistant',
        content: message?.content ?? null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: tc.type ?? 'function',
          function: { name: tc.function?.name, arguments: tc.function?.arguments },
        })),
      });

      for (const tc of toolCalls) {
        if (tc.function?.name !== 'search_products') {
          convo.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ success: false, message: 'Herramienta desconocida.' }),
          });
          continue;
        }

        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments ?? '{}');
        } catch {
          args = {};
        }
        const outcome = await executeSearch(args);
        if (outcome.products.length > 0) {
          suggestedProducts = outcome.products;
        }
        convo.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(outcome.toolPayload),
        });
      }
    }

    return res.json({
      reply: 'No llegué a buscar, probá contarme de nuevo con más detalle.',
      products: suggestedProducts,
    });
  } catch (error) {
    if (error.message?.includes('NVIDIA_API_KEY')) {
      return res.status(503).json({ error: error.message });
    }
    return next(error);
  }
}