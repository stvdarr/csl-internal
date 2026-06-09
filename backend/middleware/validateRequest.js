export const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    return res.status(400).json({
      error: "Input tidak valid",
      details: result.error.flatten(),
    });
  }

  // MEMPERBAIKI CARA ASSIGNMENT AGAR TIDAK CRASH:

  // 1. req.body aman untuk ditimpa langsung
  req.body = result.data.body ?? req.body;

  // 2. req.params aman untuk ditimpa langsung
  req.params = result.data.params ?? req.params;

  // 3. KHUSUS req.query, kita modifikasi isinya tanpa menimpa objek utamanya
  if (result.data.query) {
    Object.keys(req.query).forEach((key) => delete req.query[key]); // Bersihkan query lama
    Object.assign(req.query, result.data.query); // Masukkan query hasil validasi Zod
  }

  next();
};
