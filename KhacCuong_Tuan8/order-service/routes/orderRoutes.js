const express = require("express");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.post("/orders", orderController.createOrder);
router.get("/orders/:id", orderController.getOrderById);
router.put("/orders/:id", orderController.updateOrder);
router.delete("/orders/:id", orderController.deleteOrder);

module.exports = router;
