const Order = require("../models/orderModel");

const createOrder = async (data) => {
  const order = new Order(data);
  await order.save();
  return order;
};

const getOrderById = async (id) => {
  return await Order.findById(id)
    .populate("customerId")
    .populate("products.productId");
};

const updateOrder = async (id, data) => {
  return await Order.findByIdAndUpdate(id, data, { new: true });
};

const deleteOrder = async (id) => {
  return await Order.findByIdAndDelete(id);
};

module.exports = { createOrder, getOrderById, updateOrder, deleteOrder };
