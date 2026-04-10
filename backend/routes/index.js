// backend/routes/index.js
// Mounts every API route group. server.js does: app.use("/api", require("./routes"))
const router = require("express").Router();

router.use("/teams",   require("./teams/GET"));
router.use("/teams",   require("./teams/POST"));
router.use("/teams",   require("./teams/PUT"));
router.use("/teams",   require("./teams/DELETE"));

router.use("/rules",   require("./rules/GET"));
router.use("/rules",   require("./rules/POST"));

router.use("/github",  require("./github/GET"));
router.use("/github",  require("./github/POST"));

router.use("/uploads", require("./uploads/GET"));
router.use("/uploads", require("./uploads/POST"));
router.use("/uploads", require("./uploads/DELETE"));

router.use("/export", require("./export/GET"));

router.use("/scores",  require("./scores/GET"));


module.exports = router;
