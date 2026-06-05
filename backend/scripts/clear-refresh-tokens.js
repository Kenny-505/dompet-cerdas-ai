require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.refreshToken.deleteMany({});
  console.log(`✅ Cleared ${result.count} refresh tokens (plaintext tokens invalidated).`);
  console.log('   Users will need to login again — ini expected behavior setelah security upgrade.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
