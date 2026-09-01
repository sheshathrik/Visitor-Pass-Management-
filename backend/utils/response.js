// Standard response envelope so every endpoint returns the same shape:
// success responses -> { success: true, message, data }
// error responses   -> { success: false, message, error }
const ok = (res, data, message = "Success", code = 200) =>
    res.status(code).json({ success: true, message, data });
  
  const fail = (res, message = "Something went wrong", code = 500, error = null) =>
    res.status(code).json({ success: false, message, error });
  
  module.exports = { ok, fail };