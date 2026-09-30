import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Spouštím seedování databáze pro Dřevěnku s.r.o....');

  // 1. Založení skladů (Hradec Králové + garáž Třebechovice dle zadání)
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

  console.log(`📦 Sklady vytvořeny: ${skladHradec.name}, ${skladTrebechovice.name}`);

  // 2. Založení kategorií dle zadání (hračka může patřit do více kategorií naráz)
  const catBatolata = await prisma.category.upsert({
    where: { name: 'Pro batolata' },
    update: {},
    create: { name: 'Pro batolata', description: 'Bezpečné zaoblené hračky z přírodního dřeva pro nejmenší' }
  });

  const catDarky = await prisma.category.upsert({
    where: { name: 'Dárky do 500 Kč' },
    update: {},
    create: { name: 'Dárky do 500 Kč', description: 'Cenově dostupné dárkové předměty' }
  });

  const catHlavolamy = await prisma.category.upsert({
    where: { name: 'Dřevěné hlavolamy' },
    update: {},
    create: { name: 'Dřevěné hlavolamy', description: 'Tradiční české rébusy pro bystré hlavičky' }
  });

  // 3. Založení ukázkových dřevěných hraček (produktů)
  const productsData = [
    {
      code: 'KACA-BUK-01',
      name: 'Tradiční točivá káča buk',
      description: 'Ručně soustružená káča z bukového dřeva, ošetřená přírodním včelím voskem.',
      purchasePrice: 65,
      sellingPrice: 149,
      minStockLimit: 10,
      categories: [catBatolata.id, catDarky.id]
    },
    {
      code: 'VLACEK-DUBOVY',
      name: 'Dřevěný vláček s vagónky',
      description: 'Modulární souprava mašinky se dvěma odpojitelnými vagónky a nákladem dřeva.',
      purchasePrice: 210,
      sellingPrice: 489,
      minStockLimit: 5,
      categories: [catBatolata.id, catDarky.id]
    },
    {
      code: 'KACER-TAHACI',
      name: 'Klapající tahací kačer',
      description: 'Oblíbená retro tahací hračka s klapajícími křidélky při jízdě na provázku.',
      purchasePrice: 130,
      sellingPrice: 299,
      minStockLimit: 8,
      categories: [catBatolata.id, catDarky.id]
    },
    {
      code: 'KOSTKY-LES-50',
      name: 'Stavebnice Lesní svět (50 dílů)',
      description: 'Nelakované stavební kostky z českého javoru a smrku v plátěném pytlíku.',
      purchasePrice: 310,
      sellingPrice: 699,
      minStockLimit: 4,
      categories: [catBatolata.id]
    },
    {
      code: 'JEZEK-KLEC-DREV',
      name: 'Dřevěný ježek v kleci',
      description: 'Klasický hlavolam z ušlechtilého ořechového dřeva.',
      purchasePrice: 180,
      sellingPrice: 390,
      minStockLimit: 6,
      categories: [catHlavolamy.id, catDarky.id]
    }
  ];

  for (const item of productsData) {
    const { categories, ...prodFields } = item;
    const product = await prisma.product.upsert({
      where: { code: prodFields.code },
      update: {},
      create: prodFields
    });

    // Propojení M:N s kategoriemi
    for (const catId of categories) {
      await prisma.productCategory.upsert({
        where: {
          productId_categoryId: {
            productId: product.id,
            categoryId: catId
          }
        },
        update: {},
        create: {
          productId: product.id,
          categoryId: catId
        }
      });
    }

    // Inicializace skladových karet na skladech
    await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: skladHradec.id,
          productId: product.id
        }
      },
      update: {},
      create: {
        warehouseId: skladHradec.id,
        productId: product.id,
        physicalQuantity: 15,
        reservedQuantity: 0
      }
    });

    await prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: skladTrebechovice.id,
          productId: product.id
        }
      },
      update: {},
      create: {
        warehouseId: skladTrebechovice.id,
        productId: product.id,
        physicalQuantity: 5,
        reservedQuantity: 0
      }
    });

    console.log(`🧸 Produkt vytvořen: [${product.code}] ${product.name}`);
  }

  console.log('✅ Seedování databáze úspěšně dokončeno!');
}

main()
  .catch((e) => {
    console.error('❌ Chyba při seedování:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
