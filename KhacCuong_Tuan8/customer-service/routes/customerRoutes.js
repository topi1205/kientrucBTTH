const express = require("express");
const customerController = require("../controllers/customerController");

const router = express.Router();

router.post("/customers", customerController.createCustomer);
router.get("/customers/:id", customerController.getCustomerById);
router.put("/customers/:id", customerController.updateCustomer);
router.delete("/customers/:id", customerController.deleteCustomer);

module.exports = router;
