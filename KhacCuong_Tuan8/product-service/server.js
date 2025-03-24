const express = require("express");
const mongoose = require("mongoose");
const productRoutes = require("./routes/productRoutes");

const app = express();
app.use(express.json());

mongoose.connect("mongodb://product-db:27017/product-db", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use("/api", productRoutes);

app.listen(3001, () => {
  console.log("Product Service running on port 3001");
});
