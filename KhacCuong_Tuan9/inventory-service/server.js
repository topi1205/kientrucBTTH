const express = require('express');
const inventoryRoutes = require('./routes/inventoryRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use('/api/inventory', inventoryRoutes);

app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});
