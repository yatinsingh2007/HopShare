const prisma = require('../config/db');

const findOrCreateUser = async (clerkId, loadClerkUser) => {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await loadClerkUser();
  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      name: clerkUser.firstName ?? null,
    },
  });
};

const updateName = (id, name) => prisma.user.update({ where: { id }, data: { name } });

const toPublicMe = (user) => ({
  id: user.id,
  firstName: user.name,
  email: user.email,
  upiId: user.upiId,
  profileComplete: !!user.name && !!user.upiId,
});

module.exports = { findOrCreateUser, updateName, toPublicMe };
