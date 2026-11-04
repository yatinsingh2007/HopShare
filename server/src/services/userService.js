const prisma = require('../config/db');

/** Finds the rider by Clerk ID; on their first request, creates them from their Clerk profile. */
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

/** What the app is allowed to see about the signed-in rider. */
const toPublicMe = (user) => ({
  id: user.id,
  firstName: user.name,
  email: user.email,
  upiId: user.upiId,
  profileComplete: !!user.name && !!user.upiId,
});

module.exports = { findOrCreateUser, updateName, toPublicMe };
