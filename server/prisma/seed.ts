import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const roles = [
    { name: 'CONVENER', description: 'Overall event leadership' },
    { name: 'MEDIA_HEAD', description: 'Media operations lead' },
    { name: 'SPORTS_COORDINATOR', description: 'Sport operations lead' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
