/**
 * Auth middleware stub.
 * TODO: implement JWT verification once EKITHAB_JWT_SECRET is available.
 * For now, use a hardcoded mock user ID.
 */
export function authMiddleware(req, res, next) {
  req.user = { id: '00000000-0000-0000-0000-000000000001' };
  next();
}
