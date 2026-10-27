const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
export const MAX_NAME_LENGTH = 40;

export const isValidUpiId = (s) => UPI_ID.test(s);

export const normalizeName = (s) => {
  const name = s.trim().replace(/\s+/g, ' ');
  return name && name.length <= MAX_NAME_LENGTH ? name : null;
};
