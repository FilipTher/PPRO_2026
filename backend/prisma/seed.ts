import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

interface SeedProduct {
  code: string;
  name: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  minStockLimit: number;
  categories: string[];
  stock: { hk: number; trb: number };
  variantOf?: string;
}

async function main() {
  console.log('🌱 Spouštím seedování databáze pro Dřevěnku s.r.o....');

  // 1. Sklady dle zadání (Hradec Králové + garáž Třebechovice)
  const skladHradec = await prisma.warehouse.upsert({
    where: { code: 'WH-HK' },
    update: {},
    create: {
      code: 'WH-HK',
      name: 'Centrální sklad Hradec Králové',
      address: 'Pospíšilova 312, Hradec Králové',
      isSeasonal: false
    }
  });

  const skladTrebechovice = await prisma.warehouse.upsert({
    where: { code: 'WH-TRB' },
    update: {},
    create: {
      code: 'WH-TRB',
      name: 'Sezónní sklad (Garáž) Třebechovice',
      address: 'Pod Rybníkem 88, Třebechovice pod Orebem',
      isSeasonal: true
    }
  });

  console.log(`📦 Sklady: ${skladHradec.name}, ${skladTrebechovice.name}`);

  // 2. Kategorie (produkt patří do více kategorií naráz – vazba M:N)
  const categoriesData = [
    { name: 'Pro batolata', description: 'Bezpečné zaoblené hračky z přírodního dřeva pro nejmenší' },
    { name: 'Dárky do 500 Kč', description: 'Cenově dostupné dárkové předměty' },
    { name: 'Dřevěné hlavolamy', description: 'Tradiční české rébusy pro bystré hlavičky' }
  ];

  const categoryIds: Record<string, number> = {};
  for (const category of categoriesData) {
    const saved = await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category
    });
    categoryIds[category.name] = saved.id;
  }

  // 3. Produkty včetně variant káči a jednoho kusu pod minimem
  const productsData: SeedProduct[] = [
    {
      code: 'KACA-BUK-01',
      name: 'Tradiční točivá káča buk',
      description: 'Ručně soustružená káča z bukového dřeva, ošetřená přírodním včelím voskem.',
      purchasePrice: 65,
      sellingPrice: 149,
      minStockLimit: 10,
      categories: ['Pro batolata', 'Dárky do 500 Kč'],
      stock: { hk: 15, trb: 5 }
    },
    {
      code: 'KACA-CERVENA',
      name: 'Točivá káča červená',
      description: 'Barevná varianta oblíbené káči, mořená přírodním pigmentem.',
      purchasePrice: 70,
      sellingPrice: 159,
      minStockLimit: 10,
      categories: ['Pro batolata', 'Dárky do 500 Kč'],
      stock: { hk: 10, trb: 2 },
      variantOf: 'KACA-BUK-01'
    },
    {
      code: 'KACA-MODRA',
      name: 'Točivá káča modrá',
      description: 'Modrá varianta káči – poslední kusy, čeká na doobjednání.',
      purchasePrice: 70,
      sellingPrice: 159,
      minStockLimit: 10,
      categories: ['Pro batolata', 'Dárky do 500 Kč'],
      stock: { hk: 2, trb: 0 },
      variantOf: 'KACA-BUK-01'
    },
    {
      code: 'VLACEK-DUBOVY',
      name: 'Dřevěný vláček s vagónky',
      description: 'Modulární souprava mašinky se dvěma odpojitelnými vagónky a nákladem dřeva.',
      purchasePrice: 210,
      sellingPrice: 489,
      minStockLimit: 5,
      categories: ['Pro batolata', 'Dárky do 500 Kč'],
      stock: { hk: 15, trb: 5 }
    },
    {
      code: 'KACER-TAHACI',
      name: 'Klapající tahací kačer',
      description: 'Oblíbená retro tahací hračka s klapajícími křidélky při jízdě na provázku.',
      purchasePrice: 130,
      sellingPrice: 299,
      minStockLimit: 8,
      categories: ['Pro batolata', 'Dárky do 500 Kč'],
      stock: { hk: 15, trb: 5 }
    },
    {
      code: 'KOSTKY-LES-50',
      name: 'Stavebnice Lesní svět (50 dílů)',
      description: 'Nelakované stavební kostky z českého javoru a smrku v plátěném pytlíku.',
      purchasePrice: 310,
      sellingPrice: 699,
      minStockLimit: 4,
      categories: ['Pro batolata'],
      stock: { hk: 15, trb: 5 }
    },
    {
      code: 'JEZEK-KLEC-DREV',
      name: 'Dřevěný ježek v kleci',
      description: 'Klasický hlavolam z ušlechtilého ořechového dřeva.',
      purchasePrice: 180,
      sellingPrice: 390,
      minStockLimit: 6,
      categories: ['Dřevěné hlavolamy', 'Dárky do 500 Kč'],
      stock: { hk: 15, trb: 5 }
    }
  ];

  const productIds: Record<string, number> = {};

  for (const item of productsData) {
    const { categories, stock, variantOf, ...fields } = item;
    const parentId = variantOf ? productIds[variantOf] : null;

    const product = await prisma.product.upsert({
      where: { code: fields.code },
      update: {},
      create: { ...fields, isVariantOfId: parentId ?? null }
    });
    productIds[fields.code] = product.id;

    for (const categoryName of categories) {
      await prisma.productCategory.upsert({
        where: {
          productId_categoryId: {
            productId: product.id,
            categoryId: categoryIds[categoryName]
          }
        },
        update: {},
        create: {
          productId: product.id,
          categoryId: categoryIds[categoryName]
        }
      });
    }

    await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: { warehouseId: skladHradec.id, productId: product.id }
      },
      update: {},
      create: {
        warehouseId: skladHradec.id,
        productId: product.id,
        physicalQuantity: stock.hk,
        reservedQuantity: 0
      }
    });

    await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: { warehouseId: skladTrebechovice.id, productId: product.id }
      },
      update: {},
      create: {
        warehouseId: skladTrebechovice.id,
        productId: product.id,
        physicalQuantity: stock.trb,
        reservedQuantity: 0
      }
    });

    console.log(`🧸 Produkt: [${product.code}] ${product.name}`);
  }

  // 4. Demo historie (zákazníci, objednávky, pohyby) – jen při prvním seedu
  await seedDemoHistory();

  console.log('✅ Seedování databáze úspěšně dokončeno!');
}

/**
 * Naplní ukázkovou historii pro obhajobu: zákazníky, objednávky ve třech stavech,
 * auditní pohyby všech typů a káču pod minimem („co hoří“).
 * Chráněno existencí demo objednávky, takže opakovaný seed nic neduplikuje.
 */
async function seedDemoHistory(): Promise<void> {
  const existing = await prisma.order.findUnique({ where: { orderNumber: 'ORD-SEED-0002' } });
  if (existing) {
    console.log('🎬 Demo historie už existuje – přeskakuji.');
    return;
  }

  const [kaca, cervena, modra, jezek] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { code: 'KACA-BUK-01' } }),
    prisma.product.findUniqueOrThrow({ where: { code: 'KACA-CERVENA' } }),
    prisma.product.findUniqueOrThrow({ where: { code: 'KACA-MODRA' } }),
    prisma.product.findUniqueOrThrow({ where: { code: 'JEZEK-KLEC-DREV' } })
  ]);

  const hk = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-HK' } });
  const trb = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'WH-TRB' } });

  const customersData = [
    {
      name: 'Jan Novák',
      email: 'jan.novak@example.com',
      phone: '+420 601 111 222',
      street: 'Dlouhá 14',
      city: 'Hradec Králové',
      zip: '500 03'
    },
    {
      name: 'Eva Svobodová',
      email: 'eva.svobodova@example.com',
      phone: '+420 602 333 444',
      street: 'Zahradní 8',
      city: 'Třebechovice pod Orebem',
      zip: '503 46'
    },
    {
      name: 'Petr Dvořák',
      email: 'petr.dvorak@example.com',
      phone: '+420 603 555 666',
      street: 'Nádražní 2',
      city: 'Pardubice',
      zip: '530 02'
    }
  ];

  const customers = [];
  for (const data of customersData) {
    customers.push(
      await prisma.customer.upsert({
        where: { email: data.email },
        update: {},
        create: data
      })
    );
  }
  const [jan, eva, petr] = customers;

  // Objednávka k expedici – drží rezervaci 2 ks káči v Hradci
  const reservedOrder = await prisma.order.create({
    data: {
      orderNumber: 'ORD-SEED-0001',
      customerId: jan.id,
      status: 'RESERVED',
      createdAt: daysAgo(1),
      items: {
        create: [
          {
            productId: kaca.id,
            warehouseId: hk.id,
            quantity: 2,
            unitPrice: kaca.sellingPrice
          }
        ]
      }
    }
  });

  // Historická expedovaná objednávka – vstupuje do měsíčního obratu
  const shippedOrder = await prisma.order.create({
    data: {
      orderNumber: 'ORD-SEED-0002',
      customerId: eva.id,
      status: 'SHIPPED',
      createdAt: daysAgo(3),
      shippedAt: daysAgo(2),
      items: {
        create: [
          {
            productId: cervena.id,
            warehouseId: hk.id,
            quantity: 2,
            unitPrice: cervena.sellingPrice
          }
        ]
      }
    }
  });

  // Stornovaná objednávka – rezervace už je uvolněná
  await prisma.order.create({
    data: {
      orderNumber: 'ORD-SEED-0003',
      customerId: petr.id,
      status: 'CANCELLED',
      createdAt: daysAgo(5),
      items: {
        create: [
          {
            productId: jezek.id,
            warehouseId: trb.id,
            quantity: 1,
            unitPrice: jezek.sellingPrice
          }
        ]
      }
    }
  });

  // Sladění stavů s historií pohybů
  await prisma.warehouseStock.update({
    where: { warehouseId_productId: { warehouseId: hk.id, productId: kaca.id } },
    data: { reservedQuantity: 2 }
  });

  await prisma.warehouseStock.update({
    where: { warehouseId_productId: { warehouseId: hk.id, productId: cervena.id } },
    data: { physicalQuantity: 8 }
  });

  await prisma.warehouseStock.update({
    where: { warehouseId_productId: { warehouseId: trb.id, productId: cervena.id } },
    data: { physicalQuantity: 1 }
  });

  await prisma.warehouseStock.update({
    where: { warehouseId_productId: { warehouseId: hk.id, productId: modra.id } },
    data: { physicalQuantity: 1 }
  });

  await prisma.warehouseStock.update({
    where: { warehouseId_productId: { warehouseId: trb.id, productId: modra.id } },
    data: { physicalQuantity: 1 }
  });

  // Auditní historie: příjmy, expedice, inventura i přesun mezi sklady
  const transferNumber = 'PREV-SEED-0001';
  await prisma.stockMovement.createMany({
    data: [
      {
        productId: kaca.id,
        warehouseId: hk.id,
        movementType: 'RECEIPT',
        quantityChange: 15,
        quantityAfter: 15,
        reason: 'Počáteční naskladnění (seed)',
        createdAt: daysAgo(20)
      },
      {
        productId: cervena.id,
        warehouseId: hk.id,
        movementType: 'RECEIPT',
        quantityChange: 10,
        quantityAfter: 10,
        reason: 'Počáteční naskladnění (seed)',
        createdAt: daysAgo(14)
      },
      {
        productId: cervena.id,
        warehouseId: trb.id,
        movementType: 'RECEIPT',
        quantityChange: 2,
        quantityAfter: 2,
        reason: 'Naskladnění do garáže (seed)',
        createdAt: daysAgo(14)
      },
      {
        productId: modra.id,
        warehouseId: hk.id,
        movementType: 'RECEIPT',
        quantityChange: 2,
        quantityAfter: 2,
        reason: 'Počáteční naskladnění (seed)',
        createdAt: daysAgo(10)
      },
      {
        productId: cervena.id,
        warehouseId: hk.id,
        orderId: shippedOrder.id,
        movementType: 'DISPATCH',
        quantityChange: -2,
        quantityAfter: 8,
        reason: `Expedice objednávky ${shippedOrder.orderNumber}`,
        createdAt: daysAgo(2)
      },
      {
        productId: cervena.id,
        warehouseId: trb.id,
        movementType: 'INVENTORY_ADJUSTMENT',
        quantityChange: -1,
        quantityAfter: 1,
        reason: 'Manko při inventuře garáže (seed)',
        createdAt: daysAgo(6)
      },
      {
        productId: modra.id,
        warehouseId: hk.id,
        movementType: 'TRANSFER_OUT',
        quantityChange: -1,
        quantityAfter: 1,
        reason: `Převod ${transferNumber} do skladu ${trb.code}`,
        createdAt: daysAgo(4)
      },
      {
        productId: modra.id,
        warehouseId: trb.id,
        movementType: 'TRANSFER_IN',
        quantityChange: 1,
        quantityAfter: 1,
        reason: `Převod ${transferNumber} ze skladu ${hk.code}`,
        createdAt: daysAgo(4)
      }
    ]
  });

  console.log(
    `🎬 Demo historie: 3 zákazníci, objednávky ${reservedOrder.orderNumber} (k expedici), ` +
      `${shippedOrder.orderNumber} (odesláno), ORD-SEED-0003 (storno), 8 pohybů`
  );
}

main()
  .catch((e) => {
    console.error('❌ Chyba při seedování:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
