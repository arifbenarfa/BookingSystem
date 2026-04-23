import jwt from "jsonwebtoken";

function readTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieHeader = req.headers.cookie || "";
  const tokenCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("token="));

  if (!tokenCookie) return null;
  return decodeURIComponent(tokenCookie.substring("token=".length));
}

export function requireAuth(req, res, next) {
  const token = readTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: "Invalid or expired token",
    });
  }
}

export function requirePageAuth(req, res, next) {
  const token = readTokenFromRequest(req);
  if (!token) {
    return res.redirect("/login");
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_err) {
    return res.redirect("/login");
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        error: "Forbidden",
      });
    }

    next();
  };
}