export const upsertByClerkId = async (db, clerkUserId) => {
  const { rows } = await db.query(
    `INSERT INTO users (clerk_user_id) VALUES ($1)
     ON CONFLICT (clerk_user_id) DO UPDATE SET updated_at = users.updated_at
     RETURNING *`,
    [clerkUserId],
  );
  return rows[0];
};

export const toPublicMe = (user) => ({
  id: user.id,
  firstName: user.first_name,
  upiId: user.upi_id,
  photoUrl: user.photo_url,
  idVerified: !!user.id_verified_at,
  photoVerified: !!user.photo_verified_at,
  profileComplete: !!user.first_name && !!user.upi_id,
});

export const updateProfile = async (db, userId, { firstName, upiId }) => {
  const { rows } = await db.query(
    `UPDATE users SET
       first_name = COALESCE($2, first_name),
       upi_id     = COALESCE($3, upi_id),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [userId, firstName ?? null, upiId ?? null],
  );
  return rows[0];
};
