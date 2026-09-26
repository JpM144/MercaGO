'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const categories = [
      { name: 'Celulares', slug: 'celulares', created_at: now, updated_at: now },
      { name: 'Accesorios', slug: 'accesorios', created_at: now, updated_at: now },
      { name: 'Audio', slug: 'audio', created_at: now, updated_at: now },
      { name: 'Cargadores', slug: 'cargadores', created_at: now, updated_at: now },
      { name: 'Smartwatches', slug: 'smartwatches', created_at: now, updated_at: now },
    ];

    await queryInterface.bulkInsert('categories', categories);

    const rows = await queryInterface.sequelize.query('SELECT id, slug FROM categories;', {
      type: Sequelize.QueryTypes.SELECT,
    });
    const categoryIdBySlug = Object.fromEntries(rows.map((row) => [row.slug, row.id]));

    const products = [
      // Celulares
      {
        name: 'iPhone 15',
        slug: 'iphone-15',
        description: 'Smartphone Apple con chip A16 Bionic, cámara de 48 MP y Dynamic Island.',
        price: 1299.99,
        stock: 25,
        image_url: 'https://picsum.photos/seed/phone-iphone-15/600/600',
        category_id: categoryIdBySlug.celulares,
      },
      {
        name: 'Samsung Galaxy S24',
        slug: 'samsung-galaxy-s24',
        description: 'Flagship Samsung con Galaxy AI, pantalla AMOLED 120 Hz y cámara de 50 MP.',
        price: 1099.99,
        stock: 30,
        image_url: 'https://picsum.photos/seed/phone-galaxy-s24/600/600',
        category_id: categoryIdBySlug.celulares,
      },
      {
        name: 'Xiaomi Redmi Note 13',
        slug: 'xiaomi-redmi-note-13',
        description: 'Gama media con pantalla AMOLED 6.67", batería de 5000 mAh y 108 MP.',
        price: 349.99,
        stock: 40,
        image_url: 'https://picsum.photos/seed/phone-redmi-note-13/600/600',
        category_id: categoryIdBySlug.celulares,
      },
      {
        name: 'Google Pixel 8',
        slug: 'google-pixel-8',
        description: 'Pixel con chip Tensor G3, cámara de 50 MP y 7 años de actualizaciones.',
        price: 799.99,
        stock: 20,
        image_url: 'https://picsum.photos/seed/phone-pixel-8/600/600',
        category_id: categoryIdBySlug.celulares,
      },
      {
        name: 'Motorola Edge 40',
        slug: 'motorola-edge-40',
        description: 'Móvil con pantalla pOLED 144 Hz, carga rápida de 68 W y certificación IP68.',
        price: 599.99,
        stock: 18,
        image_url: 'https://picsum.photos/seed/phone-edge-40/600/600',
        category_id: categoryIdBySlug.celulares,
      },
      // Accesorios
      {
        name: 'Funda de silicona iPhone 15',
        slug: 'funda-silicona-iphone-15',
        description: 'Funda oficial de silicona con bordes suaves y protección MagSafe.',
        price: 19.99,
        stock: 100,
        image_url: 'https://picsum.photos/seed/case-iphone-15/600/600',
        category_id: categoryIdBySlug.accesorios,
      },
      {
        name: 'Vidrio templado Galaxy S24',
        slug: 'vidrio-templado-galaxy-s24',
        description: 'Protector de vidrio templado 9H con recubrimiento anti oleofóbico.',
        price: 12.99,
        stock: 150,
        image_url: 'https://picsum.photos/seed/glass-galaxy-s24/600/600',
        category_id: categoryIdBySlug.accesorios,
      },
      {
        name: 'Soporte magnético para auto',
        slug: 'soporte-magnetico-auto',
        description: 'Soporte para salpicadero con imán de neodimio y brazo articulado.',
        price: 29.99,
        stock: 60,
        image_url: 'https://picsum.photos/seed/holder-foto/600/600',
        category_id: categoryIdBySlug.accesorios,
      },
      {
        name: 'Kit de limpieza para pantallas',
        slug: 'kit-limpieza-pantallas',
        description: 'Solución de limpieza, microfibra y brochas para toda la familia.',
        price: 15.99,
        stock: 90,
        image_url: 'https://picsum.photos/seed/clean-kit/600/600',
        category_id: categoryIdBySlug.accesorios,
      },
      // Audio
      {
        name: 'Sony WH-1000XM5',
        slug: 'sony-wh-1000xm5',
        description: 'Auriculares inalámbricos con cancelación de ruido líder de la industria.',
        price: 399.99,
        stock: 15,
        image_url: 'https://picsum.photos/seed/audio-sony-1000xm5/600/600',
        category_id: categoryIdBySlug.audio,
      },
      {
        name: 'Parlante JBL Go 4',
        slug: 'parlante-jbl-go-4',
        description: 'Parlante Bluetooth portátil, resistente al agua IP67 y 7 h de batería.',
        price: 49.99,
        stock: 35,
        image_url: 'https://picsum.photos/seed/audio-jbl-go4/600/600',
        category_id: categoryIdBySlug.audio,
      },
      {
        name: 'AirPods Pro 2',
        slug: 'airpods-pro-2',
        description: 'Auriculares con cancelación activa de ruido, audio adaptativo y USB-C.',
        price: 279.99,
        stock: 22,
        image_url: 'https://picsum.photos/seed/audio-airpods-pro2/600/600',
        category_id: categoryIdBySlug.audio,
      },
      {
        name: 'Xiaomi Buds 4 Pro',
        slug: 'xiaomi-buds-4-pro',
        description: 'In-ear con cancelación de ruido activa de 48 dB y hasta 38 h de batería.',
        price: 129.99,
        stock: 28,
        image_url: 'https://picsum.photos/seed/audio-buds-4-pro/600/600',
        category_id: categoryIdBySlug.audio,
      },
      {
        name: 'Cascos HyperX Cloud II',
        slug: 'cascos-hyperx-cloud-ii',
        description:
          'Auriculares gaming con sonido 7.1, micrófono desmontable y diadema de aluminio.',
        price: 99.99,
        stock: 32,
        image_url: 'https://picsum.photos/seed/audio-hyperx-cloud2/600/600',
        category_id: categoryIdBySlug.audio,
      },
      // Cargadores
      {
        name: 'Cargador USB-C 20W',
        slug: 'cargador-usb-c-20w',
        description: 'Cargador compacto USB-C Power Delivery 20 W compatible con iPhone y Android.',
        price: 24.99,
        stock: 120,
        image_url: 'https://picsum.photos/seed/charger-usb-c-20w/600/600',
        category_id: categoryIdBySlug.cargadores,
      },
      {
        name: 'Cable USB-C a USB-C 1m',
        slug: 'cable-usb-c-1m',
        description: 'Cable trenzado de nailon con soporte de carga rápida de hasta 100 W.',
        price: 14.99,
        stock: 200,
        image_url: 'https://picsum.photos/seed/cable-usb-c-1m/600/600',
        category_id: categoryIdBySlug.cargadores,
      },
      {
        name: 'Cargador inalámbrico 15W',
        slug: 'cargador-inalambrico-15w',
        description:
          'Base de carga Qi de 15 W con superficie anti deslizante y protección térmica.',
        price: 34.99,
        stock: 70,
        image_url: 'https://picsum.photos/seed/charger-wireless-15w/600/600',
        category_id: categoryIdBySlug.cargadores,
      },
      // Smartwatches
      {
        name: 'Apple Watch Series 9',
        slug: 'apple-watch-series-9',
        description: 'Smartwatch con chip S9, pantalla brillante y detección de doble toque.',
        price: 429.99,
        stock: 18,
        image_url: 'https://picsum.photos/seed/watch-apple-s9/600/600',
        category_id: categoryIdBySlug.smartwatches,
      },
      {
        name: 'Galaxy Watch 6',
        slug: 'galaxy-watch-6',
        description: 'Reloj inteligente con seguimiento de salud completo y Wear OS.',
        price: 329.99,
        stock: 25,
        image_url: 'https://picsum.photos/seed/watch-galaxy-6/600/600',
        category_id: categoryIdBySlug.smartwatches,
      },
      {
        name: 'Amazfit Bip 5',
        slug: 'amazfit-bip-5',
        description: 'Smartwatch económico con más de 120 modos deportivos y 10 días de batería.',
        price: 89.99,
        stock: 45,
        image_url: 'https://picsum.photos/seed/watch-amazfit-bip5/600/600',
        category_id: categoryIdBySlug.smartwatches,
      },
    ].map((product) => ({ ...product, created_at: now, updated_at: now }));

    await queryInterface.bulkInsert('products', products);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('products', null, {});
    await queryInterface.bulkDelete('categories', null, {});
  },
};
