import { Op } from 'sequelize';
import db from '../models/index.js';
import {
  getAgentClient,
  setClientFactoryForTests,
  NVIDIA_MODEL,
} from '../services/nvidia.client.js';
import { ORDER_INCLUDE, toOrderJson } from './order.controller.js';

const MAX_TOOL_ROUNDS = 4;

export function __setClientFactoryForTests(factory) {
  setClientFactoryForTests(factory);
}

const REGISTER_SALE_TOOL = {
  type: 'function',
  function: {
    name: 'register_sale',
    description:
      'Registra una venta confirmada por WhatsApp de productos del catálogo de la tienda del vendedor. Solo usala cuando ya tengas confirmados los productos y cantidades.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description:
            'Ítems vendidos. En product_name_or_id puede ir el id numérico o el nombre exacto del producto en el catálogo de la tienda.',
          items: {
            type: 'object',
            properties: {
              product_name_or_id: {
                description:
                  'Nombre exacto del producto o su id numérico en el catálogo de la tienda.',
                oneOf: [{ type: 'string' }, { type: 'integer' }],
              },
              quantity: {
                type: 'integer',
                minimum: 1,
                description: 'Cantidad vendida del producto.',
              },
            },
            required: ['product_name_or_id', 'quantity'],
            additionalProperties: false,
          },
        },
        customer_name: {
          type: 'string',
          description: 'Nombre del cliente, si el vendedor lo indicó. Opcional.',
        },
        customer_contact: {
          type: 'string',
          description:
            'Email o teléfono de contacto del cliente, si el vendedor lo indicó. Opcional. Si coincide con una cuenta existente, se vincula.',
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(store, products) {
  const lines =
    products.length > 0
      ? products
          .map((p) => `- #${p.id} "${p.name}" — $${Number(p.price)} (stock: ${p.stock})`)
          .join('\n')
      : '(El catálogo de esta tienda está vacío.)';

  return [
    `Sos el asistente de ventas por WhatsApp de la tienda "${store.name}" de TechStore.`,
    'El vendedor (store_admin) te describe por chat qué vendió. Vos armás el pedido, pero NUNCA lo registrás sin su confirmación explícita.',
    '',
    'FLUJO OBLIGATORIO EN DOS PASOS:',
    '1) PRIMER TURNO, SOLO PROPUESTA (texto plano, sin herramientas): cuando ya tengas toda la información (productos, cantidades y cliente si lo dio), NO llames a register_sale. Respondé en texto plano con un resumen claro: cada producto con su cantidad y su precio, el total, y el cliente si lo mencionó. Terminá SIEMPRE con una pregunta de confirmación explícita (ej.: "¿Confirmás que aplique el descuento de stock?").',
    '2) SEGUNDO TURNO, EJECUCIÓN: solo si el vendedor responde afirmativamente a tu resumen ("sí", "confirmo", "dale", "adelante", "dale, confirmo"), llamás a register_sale con EXACTAMENTE los mismos datos que mostraste en el resumen.',
    '',
    'REGLAS ESTRICTAS:',
    '- NUNCA llames a register_sale en el mismo turno en que el vendedor describe o resumís la venta: la primera respuesta es siempre de texto.',
    '- NUNCA ejecutes una venta si el vendedor corrige el resumen, cambia una cantidad o un producto, o dice que no: en ese caso no llames a ninguna herramienta y pedile los datos correctos de nuevo.',
    '- No registres dos veces el mismo pedido: si ya lo registraste, confirmá que quedó hecho sin volver a llamar la herramienta.',
    '- Solo podés vender productos del catálogo de esta tienda que se detalla abajo. NUNCA inventes productos ni precios.',
    '- Si un producto no existe en el catálogo o su nombre es ambiguo, NO registres la venta: pedí al vendedor que lo confirme o lo corrija y esperá su respuesta.',
    '- Preguntá la cantidad si no está clara y no la asumas.',
    '- customer_name y customer_contact son opcionales: usalos solo si el vendedor los brindó.',
    '- Cuando la venta quede registrada, confirmá al vendedor con el número de pedido y el total.',
    '',
    `Catálogo actual de ${store.name}:`,
    lines,
  ].join('\n');
}

function resolveItem(raw, catalog) {
  const key = raw?.product_name_or_id;
  const quantity = Number(raw?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: 'Cada ítem debe tener una cantidad entera mayor a cero.' };
  }
  if (key === undefined || key === null || (typeof key === 'string' && key.trim() === '')) {
    return { ok: false, error: 'Cada ítem debe indicar product_name_or_id.' };
  }

  if (typeof key === 'number' || /^\d+$/.test(String(key).trim())) {
    const id = Number(String(key).trim());
    const found = catalog.filter((p) => p.id === id);
    if (found.length === 0) {
      return {
        ok: false,
        error: `No existe un producto con id #${id} en el catálogo de esta tienda.`,
      };
    }
    return { ok: true, product: found[0], quantity };
  }

  const needle = String(key).trim().toLowerCase();
  const candidates = catalog.filter((p) => p.name.toLowerCase() === needle);
  if (candidates.length === 0) {
    return { ok: false, error: `"${String(key).trim()}" no está en el catálogo de esta tienda.` };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      error: `"${String(key).trim()}" es ambiguo: coincide con ${candidates
        .map((p) => `#${p.id} "${p.name}"`)
        .join(', ')}. Pedí al vendedor que confirme cuál es.`,
    };
  }
  return { ok: true, product: candidates[0], quantity };
}

async function handleRegisterSale(args, storeId) {
  const items = Array.isArray(args.items) ? args.items : [];
  const errors = [];
  if (items.length === 0) {
    errors.push('No se especificaron ítems de venta.');
  }

  const catalog = await db.Product.findAll({
    where: { storeId },
    attributes: ['id', 'name', 'price', 'cost', 'stock'],
    order: [['id', 'ASC']],
  });

  const resolved = [];
  for (const raw of items) {
    const res = resolveItem(raw, catalog);
    if (!res.ok) {
      errors.push(res.error);
      continue;
    }
    const existing = resolved.find((r) => r.product.id === res.product.id);
    if (existing) {
      existing.quantity += res.quantity;
    } else {
      resolved.push({ product: res.product, quantity: res.quantity });
    }
  }

  if (errors.length === 0) {
    for (const r of resolved) {
      if (r.product.stock < r.quantity) {
        errors.push(
          `Stock insuficiente para "${r.product.name}": solicitado ${r.quantity}, disponible ${r.product.stock}.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      toolPayload: {
        success: false,
        order: null,
        errors,
        message: errors.join(' '),
        hint: 'No se ejecutó ningún cambio. Pedí confirmación o corregí el pedido antes de volver a llamar register_sale.',
      },
    };
  }

  const customerContact =
    typeof args.customer_contact === 'string' && args.customer_contact.trim()
      ? args.customer_contact.trim()
      : null;
  const customerName =
    typeof args.customer_name === 'string' && args.customer_name.trim()
      ? args.customer_name.trim()
      : null;

  let userId = null;
  if (customerContact) {
    const user = await db.User.findOne({ where: { email: { [Op.eq]: customerContact } } });
    if (user) userId = user.id;
  }

  let order;
  try {
    order = await db.sequelize.transaction(async (t) => {
      const locked = [];
      for (const r of resolved) {
        const product = await db.Product.findByPk(r.product.id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
          attributes: ['id', 'name', 'price', 'cost', 'stock'],
        });
        if (!product || product.stock < r.quantity) {
          throw new Error(`Stock insuficiente para "${r.product.name}".`);
        }
        locked.push({ product, quantity: r.quantity });
      }

      const total =
        Math.round(locked.reduce((sum, r) => sum + Number(r.product.price) * r.quantity, 0) * 100) /
        100;

      const created = await db.Order.create(
        { userId, status: 'confirmed', total, customerName, customerContact },
        { transaction: t },
      );

      await db.OrderItem.bulkCreate(
        locked.map((r) => ({
          orderId: created.id,
          productId: r.product.id,
          quantity: r.quantity,
          unitPrice: r.product.price,
          unitCost: r.product.cost,
        })),
        { transaction: t },
      );

      for (const r of locked) {
        await r.product.update({ stock: r.product.stock - r.quantity }, { transaction: t });
      }

      return created;
    });
  } catch (error) {
    return {
      success: false,
      toolPayload: {
        success: false,
        order: null,
        errors: [error.message],
        message: error.message,
        hint: 'No se ejecutó el pedido. Corregí lo indicado antes de volver a intentar.',
      },
    };
  }

  const full = await db.Order.findByPk(order.id, { include: [ORDER_INCLUDE] });
  const json = toOrderJson(full);

  return {
    success: true,
    orderInstance: full,
    order: json,
    toolPayload: {
      success: true,
      order: {
        id: json.id,
        status: json.status,
        total: json.total,
        customerName: json.customerName,
        customerContact: json.customerContact,
        userId: json.userId,
        items: json.items.map((item) => ({
          productId: item.productId,
          name: item.product?.name ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
      message: `Pedido #${json.id} registrado y stock actualizado.`,
    },
  };
}

const AFFIRMATIVE_TOKENS = new Set([
  'si',
  'dale',
  'dales',
  'adelante',
  'confirmo',
  'confirma',
  'confirmado',
  'confirmada',
  'ok',
  'okey',
  'va',
  'hecho',
  'listo',
  'lista',
  'aplica',
  'aplicar',
  'aplicalo',
  'procede',
  'autorizo',
  'autorizado',
  'autorizada',
  'correcto',
  'correcta',
  'exacto',
  'exacta',
  'perfecto',
  'perfecta',
  'yes',
  'yep',
]);

const DENIAL_TOKENS = new Set([
  'no',
  'nel',
  'nunca',
  'nada',
  'cancela',
  'cancelalo',
  'cancelar',
  'deja',
  'dejalo',
  'para',
  'espera',
  'esperalo',
  'todavia',
  'incorrecto',
  'incorrecta',
  'mal',
  'nah',
  'nope',
  'blur',
]);

const CORRECTION_TOKENS = new Set([
  'pero',
  'realmente',
  'mejor',
  'cambia',
  'cambiar',
  'cambio',
  'corrijo',
  'corregi',
  'error',
  'equivoco',
  'equivoque',
  'quito',
  'quita',
  'reemplaza',
  'saco',
]);

function normalizeForMatch(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:"']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function isExplicitConfirmation(text) {
  const tokens = normalizeForMatch(text);
  if (tokens.length === 0) return false;
  if (tokens.some((token) => DENIAL_TOKENS.has(token))) return false;
  if (tokens.some((token) => CORRECTION_TOKENS.has(token))) return false;
  return tokens.some((token) => AFFIRMATIVE_TOKENS.has(token));
}

function hasProposalBeforeLastUser(messages) {
  const lastUserIndex = messages.map((m) => m?.role).lastIndexOf('user');
  if (lastUserIndex <= 0) return false;
  return messages
    .slice(0, lastUserIndex)
    .some(
      (m) =>
        m?.role === 'assistant' && typeof m.content === 'string' && m.content.trim().length > 0,
    );
}

export async function salesAssistantChat(req, res, next) {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ error: 'messages debe ser una lista no vacía de mensajes de conversación.' });
    }

    const products = await db.Product.findAll({
      where: { storeId: req.store.id },
      attributes: ['id', 'name', 'price', 'stock'],
      order: [['name', 'ASC']],
    });

    const convo = [
      { role: 'system', content: buildSystemPrompt(req.store, products) },
      ...messages
        .filter((m) => m && typeof m === 'object' && typeof m.role === 'string')
        .map((m) => ({ role: m.role, content: m.content ?? '' })),
    ];

    const lastUserMessage = [...messages].reverse().find((m) => m?.role === 'user');
    const confirmationGiven =
      hasProposalBeforeLastUser(messages) && isExplicitConfirmation(lastUserMessage?.content);
    if (!confirmationGiven) {
      console.log(
        '[sales-assistant] register_sale bloqueado: sin confirmación explícita del store_admin en este turno.',
      );
    }

    const client = getAgentClient();
    let createdOrder = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: NVIDIA_MODEL,
        temperature: 0.1,
        max_tokens: 1024,
        messages: convo,
        tools: [REGISTER_SALE_TOOL],
      });

      const message = response.choices[0]?.message;
      const toolCalls = message?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        return res.json({
          reply: message?.content ?? '',
          order: createdOrder ? toOrderJson(createdOrder) : null,
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
        if (tc.function?.name !== 'register_sale') {
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
          args = { parseError: true };
        }

        if (!confirmationGiven) {
          convo.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({
              success: false,
              order: null,
              errors: [
                'No se registró nada: falta la confirmación explícita del vendedor para este resumen.',
              ],
              message: 'Falta la confirmación explícita del vendedor: no se ejecutó ningún cambio.',
              hint: 'Mostrale el resumen al vendedor en texto plano y pedile confirmación ("¿Confirmás que aplique el descuento de stock?"). Solo si responde afirmativamente en un mensaje siguiente, llamá register_sale.',
            }),
          });
          continue;
        }

        if (createdOrder) {
          convo.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({
              success: false,
              order: null,
              errors: ['Esta venta ya quedó registrada en este mismo turno.'],
              message: 'No se registró de nuevo: la venta ya estaba registrada.',
              hint: 'No dupliques el pedido. Confirmá al vendedor el número de pedido.',
            }),
          });
          continue;
        }

        const outcome = await handleRegisterSale(args, req.store.id);
        if (outcome.success) {
          createdOrder = outcome.orderInstance;
        }
        convo.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(outcome.toolPayload),
        });
      }
    }

    return res.json({
      reply: 'No llegué a cerrar el pedido. Contame de nuevo con más detalle.',
      order: createdOrder ? toOrderJson(createdOrder) : null,
    });
  } catch (error) {
    if (error.message?.includes('NVIDIA_API_KEY')) {
      return res.status(503).json({ error: error.message });
    }
    return next(error);
  }
}
