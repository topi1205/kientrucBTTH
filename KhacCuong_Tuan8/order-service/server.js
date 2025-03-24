const express = require("express");
const mongoose = require("mongoose");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
app.use(express.json());

mongoose.connect("mongodb://order-db:27017/order-db", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use("/api", orderRoutes);

app.listen(3002, () => {
  console.log("Order Service running on port 3002");
});
