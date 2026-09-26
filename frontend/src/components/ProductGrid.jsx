import ProductCard from './ProductCard.jsx';

export default function ProductGrid({ products, emptyMessage }) {
  if (!products || products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center text-ink-500">
        {emptyMessage ?? 'No hay productos para mostrar.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
