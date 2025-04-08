const express = require('express');
const router = express.Router();

// API để cập nhật số lượng sản phẩm
router.post('/update', (req, res) => {
  const { productId, quantity } = req.body;
  // Logic cập nhật tồn kho
  res.status(200).send({ message: 'Inventory updated' });
});

// API để kiểm tra số lượng tồn kho của sản phẩm
router.get('/status', (req, res) => {
  res.status(200).send({ productId: '12345', quantity: 100 });
});

module.exports = router;
