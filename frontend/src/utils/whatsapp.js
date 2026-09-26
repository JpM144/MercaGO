export function buildWhatsAppLink(phone, storeName) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const text = encodeURIComponent(
    `Hola, vengo de la tienda ${storeName} y necesito ayuda con una consulta.`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

export function buildWhatsAppHref(phone, message) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function formatWhatsAppMoney(value) {
  const number = Math.round(Number(value));
  if (Number.isNaN(number)) return '$0';
  return `$${number.toLocaleString('es-AR')}`;
}

export function buildPurchaseMessage({ storeName, productName, quantity, unitPrice }) {
  return `Hola ${storeName}, quiero comprar: ${productName} x${quantity} - ${formatWhatsAppMoney(
    unitPrice,
  )}. Total: ${formatWhatsAppMoney(Number(unitPrice) * Number(quantity))}`;
}
