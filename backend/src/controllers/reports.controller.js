import { Op } from 'sequelize';
import db from '../models/index.js';

const PERIODS = ['daily', 'weekly', 'monthly'];
const FULFILLED_STATUSES = ['confirmed', 'shipped'];

// Colombia no observa horario de verano: America/Bogota es UTC-5 todo el año.
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

// Descompone un instante (ms) en las componentes de calendario de America/Bogota.
function bogotaParts(ms) {
  const shifted = new Date(ms + BOGOTA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

// Construye el instante que en America/Bogota corresponde a esas componentes
// (fecha/hora de "pared"). month es 0-based, igual que Date.
function bogotaDate(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute, second, millisecond) - BOGOTA_OFFSET_MS);
}

function partsKey({ year, month, day }) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function dateKey(date) {
  return partsKey(bogotaParts(date.getTime()));
}

function addDays({ year, month, day }, delta) {
  const instant = bogotaDate(year, month, day, 12);
  const shifted = new Date(instant.getTime() + BOGOTA_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  const parts = bogotaParts(shifted.getTime() - BOGOTA_OFFSET_MS);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function parseDateParam(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = bogotaParts(bogotaDate(year, month - 1, day, 12).getTime());
  if (probe.year !== year || probe.month + 1 !== month || probe.day !== day) return null;
  return { year, month: month - 1, day };
}

function parseDateTimeParam(value, endOfDay) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const day = parseDateParam(value);
  if (day) {
    return endOfDay
      ? bogotaDate(day.year, day.month, day.day, 23, 59, 59, 999)
      : bogotaDate(day.year, day.month, day.day, 0, 0, 0, 0);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function computeRange(period, { year, month, day }) {
  if (period === 'daily') {
    return {
      start: bogotaDate(year, month, day, 0, 0, 0, 0),
      end: bogotaDate(year, month, day, 23, 59, 59, 999),
    };
  }
  if (period === 'weekly') {
    const weekday = (bogotaDate(year, month, day, 12).getUTCDay() + 6) % 7;
    const monday = addDays({ year, month, day }, -weekday);
    return {
      start: bogotaDate(monday.year, monday.month, monday.day, 0, 0, 0, 0),
      end: bogotaDate(monday.year, monday.month, monday.day + 6, 23, 59, 59, 999),
    };
  }
  return {
    start: bogotaDate(year, month, 1, 0, 0, 0, 0),
    end: bogotaDate(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function storeSaleQuery(storeId, orderWhere) {
  return {
    include: [
      {
        model: db.Order,
        as: 'order',
        attributes: ['id', 'createdAt'],
        where: {
          ...orderWhere,
          status: { [Op.in]: FULFILLED_STATUSES },
        },
        required: true,
      },
      {
        model: db.Product,
        as: 'product',
        attributes: ['id', 'name'],
        where: { storeId },
        required: true,
      },
    ],
  };
}

function aggregateProfit(items) {
  const byProduct = new Map();
  const orderIds = new Set();
  let itemsCount = 0;

  for (const item of items) {
    orderIds.add(item.order.id);
    itemsCount += 1;
    const price = Number(item.unitPrice);
    const cost = Number(item.unitCost ?? 0);
    const quantity = item.quantity;

    const entry = byProduct.get(item.productId) ?? {
      productId: item.productId,
      name: item.product.name,
      quantity: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
    };
    entry.quantity += quantity;
    entry.revenue += price * quantity;
    entry.cost += cost * quantity;
    entry.profit += (price - cost) * quantity;
    byProduct.set(item.productId, entry);
  }

  const products = [...byProduct.values()].map((entry) => ({
    productId: entry.productId,
    name: entry.name,
    quantity: entry.quantity,
    revenue: round2(entry.revenue),
    cost: round2(entry.cost),
    profit: round2(entry.profit),
  }));
  products.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

  const totals = {
    orders: orderIds.size,
    items: itemsCount,
    quantity: products.reduce((sum, product) => sum + product.quantity, 0),
    revenue: round2(products.reduce((sum, product) => sum + product.revenue, 0)),
    cost: round2(products.reduce((sum, product) => sum + product.cost, 0)),
    profit: round2(products.reduce((sum, product) => sum + product.profit, 0)),
  };

  return { products, totals };
}

export async function getStoreReport(req, res, next) {
  try {
    const { period, date: dateParam } = req.query;

    if (!PERIODS.includes(period)) {
      return res.status(400).json({ error: 'period debe ser daily, weekly o monthly.' });
    }
    const date = parseDateParam(dateParam);
    if (!date) {
      return res.status(400).json({ error: 'date debe tener formato YYYY-MM-DD.' });
    }

    const range = computeRange(period, date);
    const items = await db.OrderItem.findAll(
      storeSaleQuery(req.store.id, {
        createdAt: { [Op.between]: [range.start, range.end] },
      }),
    );

    const { products, totals } = aggregateProfit(items);

    return res.json({
      period,
      date: dateParam,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      totals,
      products,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getReportTimeseries(req, res, next) {
  try {
    const { from: fromParam, to: toParam } = req.query;

    const from = parseDateTimeParam(fromParam, false);
    const to = parseDateTimeParam(toParam, true);
    if (!from || !to) {
      return res
        .status(400)
        .json({ error: 'from y to deben ser fechas válidas (YYYY-MM-DD u otra fecha ISO).' });
    }
    if (from.getTime() > to.getTime()) {
      return res.status(400).json({ error: 'from no puede ser posterior a to.' });
    }

    const items = await db.OrderItem.findAll(
      storeSaleQuery(req.store.id, {
        createdAt: { [Op.between]: [from, to] },
      }),
    );

    const quantityByDay = new Map();
    for (const item of items) {
      const key = dateKey(item.order.createdAt);
      quantityByDay.set(key, (quantityByDay.get(key) ?? 0) + item.quantity);
    }

    const fromParts = bogotaParts(from.getTime());
    const endKey = partsKey(bogotaParts(to.getTime()));
    const points = [];
    let cursor = { year: fromParts.year, month: fromParts.month, day: fromParts.day };
    while (partsKey(cursor) <= endKey) {
      const key = partsKey(cursor);
      points.push({ date: key, quantity: quantityByDay.get(key) ?? 0 });
      cursor = addDays(cursor, 1);
    }

    return res.json({
      from: fromParam,
      to: toParam,
      range: { start: from.toISOString(), end: to.toISOString() },
      points,
    });
  } catch (error) {
    return next(error);
  }
}

export function getTopProductsWindow(months, now = new Date()) {
  const today = bogotaParts(now.getTime());
  return {
    from: bogotaDate(today.year, today.month - (months - 1), 1, 0, 0, 0, 0),
    to: bogotaDate(today.year, today.month + 1, 0, 23, 59, 59, 999),
  };
}

export async function getTopProducts(req, res, next) {
  try {
    const monthsNum = Number(req.query.months ?? 6);
    if (!Number.isInteger(monthsNum) || monthsNum < 1 || monthsNum > 24) {
      return res.status(400).json({ error: 'months debe ser un entero entre 1 y 24.' });
    }

    const { from, to } = getTopProductsWindow(monthsNum);
    const items = await db.OrderItem.findAll(
      storeSaleQuery(req.store.id, {
        createdAt: { [Op.between]: [from, to] },
      }),
    );

    const totalsByProduct = new Map();
    for (const item of items) {
      const entry = totalsByProduct.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        quantity: 0,
      };
      entry.quantity += item.quantity;
      totalsByProduct.set(item.productId, entry);
    }

    const products = [...totalsByProduct.values()].map((entry) => ({
      productId: entry.productId,
      name: entry.name,
      totalQuantity: entry.quantity,
      averageMonthlyQuantity: round2(entry.quantity / monthsNum),
    }));
    products.sort(
      (a, b) => b.averageMonthlyQuantity - a.averageMonthlyQuantity || a.name.localeCompare(b.name),
    );

    return res.json({
      months: monthsNum,
      range: { start: from.toISOString(), end: to.toISOString() },
      products,
    });
  } catch (error) {
    return next(error);
  }
}
