import db from '../models/index.js';

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'cancelled'];

const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
};

const ORDER_INCLUDE = {
  model: db.OrderItem,
  as: 'items',
  include: [
    {
      model: db.Product,
      as: 'product',
      attributes: ['id', 'name', 'slug', 'imageUrl', 'stock'],
    },
  ],
};

function toOrderJson(order) {
  const json = order.get({ plain: true });
  return {
    ...json,
    total: Number(json.total),
    items: Array.isArray(json.items)
      ? json.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) }))
      : json.items,
  };
}

export async function createOrder(req, res, next) {
  try {
    const payload = req.body?.items;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res
        .status(400)
        .json({ error: 'items debe ser una lista no vacía de { product_id, quantity }.' });
    }

    const merged = new Map();
    for (const item of payload) {
      const productId = item.product_id ?? item.productId;
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
        return res
          .status(400)
          .json({ error: `Item inválido: se esperaba { product_id, quantity } con quantity > 0.` });
      }
      merged.set(productId, (merged.get(productId) ?? 0) + quantity);
    }

    const items = [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));

    const order = await db.sequelize.transaction(async (t) => {
      const resolved = [];
      for (const { productId, quantity } of items) {
        const product = await db.Product.findByPk(productId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!product) {
          const error = new Error(`El producto #${productId} no existe.`);
          error.statusCode = 400;
          throw error;
        }
        if (product.stock < quantity) {
          const error = new Error(
            `Stock insuficiente para "${product.name}" (solicitado: ${quantity}, disponible: ${product.stock}).`,
          );
          error.statusCode = 409;
          throw error;
        }

        resolved.push({ product, quantity });
      }

      const total =
        Math.round(
          resolved.reduce((sum, r) => sum + Number(r.product.price) * r.quantity, 0) * 100,
        ) / 100;

      const created = await db.Order.create(
        { userId: req.user.id, status: 'pending', total },
        { transaction: t },
      );

      await db.OrderItem.bulkCreate(
        resolved.map((r) => ({
          orderId: created.id,
          productId: r.product.id,
          quantity: r.quantity,
          unitPrice: r.product.price,
        })),
        { transaction: t },
      );

      for (const r of resolved) {
        await r.product.update({ stock: r.product.stock - r.quantity }, { transaction: t });
      }

      return created;
    });

    const full = await db.Order.findByPk(order.id, { include: [ORDER_INCLUDE] });
    return res.status(201).json({ order: toOrderJson(full) });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return next(error);
  }
}

export async function listMyOrders(req, res, next) {
  try {
    const orders = await db.Order.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      include: [ORDER_INCLUDE],
    });

    return res.json({ orders: orders.map(toOrderJson) });
  } catch (error) {
    return next(error);
  }
}

export async function getOrder(req, res, next) {
  try {
    const order = await db.Order.findByPk(req.params.id, {
      include: [ORDER_INCLUDE],
    });

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para ver este pedido.' });
    }

    return res.json({ order: toOrderJson(order) });
  } catch (error) {
    return next(error);
  }
}

export async function listAllOrders(req, res, next) {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const orders = await db.Order.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [ORDER_INCLUDE, { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });

    return res.json({ orders: orders.map(toOrderJson) });
  } catch (error) {
    return next(error);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { status: nextStatus } = req.body ?? {};

    if (!VALID_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        error: `status inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const order = await db.Order.findByPk(req.params.id, {
      include: [ORDER_INCLUDE],
    });
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const currentStatus = order.status;
    if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
      return res.status(400).json({
        error: `No se puede cambiar el pedido de "${currentStatus}" a "${nextStatus}".`,
      });
    }

    await db.sequelize.transaction(async (t) => {
      if (nextStatus === 'cancelled') {
        for (const item of order.items) {
          await db.Product.update(
            { stock: db.sequelize.literal(`stock + ${item.quantity}`) },
            { where: { id: item.productId }, transaction: t },
          );
        }
      }
      await order.update({ status: nextStatus }, { transaction: t });
    });

    const updated = await db.Order.findByPk(order.id, { include: [ORDER_INCLUDE] });
    return res.json({ order: toOrderJson(updated) });
  } catch (error) {
    return next(error);
  }
}
